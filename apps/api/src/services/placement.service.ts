import { db } from '../db';
import { UploadPlacementStrategy } from '@omnidrive/shared';

export interface PlacementResult {
  accountId: string;
  targetFolderId: string;
  strategyUsed: UploadPlacementStrategy;
}

export class PlacementService {
  /**
   * Determine which linked account should receive the uploaded file
   */
  async resolveTargetAccount(params: {
    userId: string;
    fileSize: number;
    parent: string; // "root" or composite id "<accountId>:<driveId>"
    strategy?: UploadPlacementStrategy;
    explicitAccountId?: string;
  }): Promise<PlacementResult> {
    const { userId, fileSize, parent, explicitAccountId } = params;

    // 1. If uploaded inside a specific account folder, ALWAYS use that account
    if (parent && parent !== 'root' && parent !== '/') {
      const parts = parent.split(':');
      if (parts.length >= 2) {
        const accountId = parts[0];
        const folderId = parts.slice(1).join(':');

        const account = await db.linkedAccount.findUnique({ where: { id: accountId } });
        if (!account || account.userId !== userId || account.status === 'disabled') {
          throw new Error('Target account is invalid or disabled');
        }

        // Check if file fits in target account
        const limit = account.quotaLimit ? BigInt(account.quotaLimit) : BigInt(15 * 1024 * 1024 * 1024);
        const usage = account.quotaUsage ? BigInt(account.quotaUsage) : BigInt(0);
        const free = limit > usage ? limit - usage : BigInt(0);

        if (free < BigInt(fileSize)) {
          throw new Error(`Insufficient storage in account ${account.email}. Available: ${(Number(free) / (1024 * 1024)).toFixed(1)} MB, Needed: ${(fileSize / (1024 * 1024)).toFixed(1)} MB.`);
        }

        return {
          accountId,
          targetFolderId: folderId,
          strategyUsed: 'manual',
        };
      }
    }

    // 2. If explicit account was requested (e.g. via UI selector)
    if (explicitAccountId) {
      const account = await db.linkedAccount.findUnique({ where: { id: explicitAccountId } });
      if (!account || account.userId !== userId || account.status === 'disabled') {
        throw new Error('Selected account is invalid or disabled');
      }

      const limit = account.quotaLimit ? BigInt(account.quotaLimit) : BigInt(15 * 1024 * 1024 * 1024);
      const usage = account.quotaUsage ? BigInt(account.quotaUsage) : BigInt(0);
      const free = limit > usage ? limit - usage : BigInt(0);

      if (free < BigInt(fileSize)) {
        throw new Error(`Selected account ${account.email} does not have enough free space.`);
      }

      return {
        accountId: explicitAccountId,
        targetFolderId: 'root',
        strategyUsed: 'manual',
      };
    }

    // 3. User settings & strategy resolution
    const settings = await db.userSettings.findUnique({ where: { userId } });
    const strategy: UploadPlacementStrategy =
      params.strategy || (settings?.uploadStrategy as UploadPlacementStrategy) || 'most_free';

    const activeAccounts = await db.linkedAccount.findMany({
      where: { userId, status: 'active' },
    });

    if (activeAccounts.length === 0) {
      throw new Error('No active linked Google Drive accounts found. Please link an account first.');
    }

    // Calculate free space for each account
    const accountFreeSpace = activeAccounts.map((acc: any) => {
      const limit = acc.quotaLimit ? BigInt(acc.quotaLimit) : BigInt(15 * 1024 * 1024 * 1024);
      const usage = acc.quotaUsage ? BigInt(acc.quotaUsage) : BigInt(0);
      const free = limit > usage ? limit - usage : BigInt(0);
      return {
        account: acc,
        free,
        canFit: free >= BigInt(fileSize),
      };
    });

    const fittingAccounts = accountFreeSpace.filter((a: any) => a.canFit);

    if (fittingAccounts.length === 0) {
      const breakdown = accountFreeSpace
        .map((a: any) => `${a.account.email}: ${(Number(a.free) / (1024 * 1024)).toFixed(1)} MB free`)
        .join(', ');
      throw new Error(`No linked account has enough free space for this file (${(fileSize / (1024 * 1024)).toFixed(1)} MB). Account free spaces: ${breakdown}`);
    }

    // Strategy 2: Most free space
    if (strategy === 'most_free') {
      fittingAccounts.sort((a: any, b: any) => {
        if (b.free > a.free) return 1;
        if (b.free < a.free) return -1;
        return 0;
      });
      return {
        accountId: fittingAccounts[0].account.id,
        targetFolderId: 'root',
        strategyUsed: 'most_free',
      };
    }

    // Strategy 3: Fill-first according to priority list
    if (strategy === 'fill_first') {
      const priorityOrder: string[] = settings?.accountPriority || [];
      // Pick first account in priority list that can fit
      for (const accId of priorityOrder) {
        const candidate = fittingAccounts.find((a: any) => a.account.id === accId);
        if (candidate) {
          return {
            accountId: candidate.account.id,
            targetFolderId: 'root',
            strategyUsed: 'fill_first',
          };
        }
      }
      // If none from priority matched, default to the first candidate that fits
      return {
        accountId: fittingAccounts[0].account.id,
        targetFolderId: 'root',
        strategyUsed: 'fill_first',
      };
    }

    // Default fallback
    return {
      accountId: fittingAccounts[0].account.id,
      targetFolderId: 'root',
      strategyUsed: 'most_free',
    };
  }
}

export const placementService = new PlacementService();
