import { db } from '../db';
import { getDriveClient } from './drive/drive.factory';
import { eventsService } from './events.service';

export class SyncService {
  /**
   * Sync a linked account's quota and file metadata
   */
  async syncAccount(accountId: string): Promise<{ added: number; updated: number; removed: number }> {
    const account = await db.linkedAccount.findUnique({
      where: { id: accountId },
    });

    if (!account || account.status === 'disabled') {
      return { added: 0, updated: 0, removed: 0 };
    }

    try {
      const client = await getDriveClient(accountId);

      // 1. Sync Quota
      const about = await client.getAbout();
      await db.linkedAccount.update({
        where: { id: accountId },
        data: {
          quotaLimit: about.quota.limit,
          quotaUsage: about.quota.usage,
          quotaUsageInDrive: about.quota.usageInDrive,
          quotaUsageInTrash: about.quota.usageInTrash,
          lastSyncAt: new Date(),
          status: 'active',
        },
      });

      // 2. Fetch all files from Drive
      let pageToken: string | undefined = undefined;
      let added = 0;
      let updated = 0;
      const remoteDriveIds = new Set<string>();

      do {
        const res = await client.listFiles({
          pageToken,
          pageSize: 100,
        });

        for (const file of res.files) {
          remoteDriveIds.add(file.id);
          const parentDriveId = file.parents && file.parents.length > 0 ? file.parents[0] : 'root';

          const existing = await db.fileNode.findUnique({
            where: {
              accountId_driveId: {
                accountId,
                driveId: file.id,
              },
            },
          });

          await db.fileNode.upsert({
            where: {
              accountId_driveId: {
                accountId,
                driveId: file.id,
              },
            },
            create: {
              accountId,
              driveId: file.id,
              parentDriveId: parentDriveId === 'root' ? null : parentDriveId,
              name: file.name,
              mimeType: file.mimeType,
              size: file.size,
              md5: file.md5Checksum || null,
              modifiedTime: new Date(file.modifiedTime),
              trashed: file.trashed,
              isFolder: file.isFolder,
              headRevisionId: file.headRevisionId || null,
              thumbnailLink: file.thumbnailLink || null,
              webViewLink: file.webViewLink || null,
            },
            update: {
              name: file.name,
              mimeType: file.mimeType,
              size: file.size,
              md5: file.md5Checksum || null,
              parentDriveId: parentDriveId === 'root' ? null : parentDriveId,
              modifiedTime: new Date(file.modifiedTime),
              trashed: file.trashed,
              isFolder: file.isFolder,
              headRevisionId: file.headRevisionId || null,
              thumbnailLink: file.thumbnailLink || null,
              webViewLink: file.webViewLink || null,
              syncedAt: new Date(),
            },
          });

          if (existing) {
            updated++;
          } else {
            added++;
          }
        }

        pageToken = res.nextPageToken || undefined;
      } while (pageToken);

      // 3. Mark removed files if not trashed
      const localNodes = await db.fileNode.findMany({
        where: { accountId },
      });

      let removed = 0;
      for (const node of localNodes) {
        if (!remoteDriveIds.has(node.driveId)) {
          await db.fileNode.delete({ where: { id: node.id } });
          removed++;
        }
      }

      // Notify via SSE
      eventsService.emitToUser(account.userId, {
        type: 'sync_completed',
        payload: {
          accountId,
          added,
          updated,
          removed,
          lastSyncAt: new Date().toISOString(),
        },
      });

      return { added, updated, removed };
    } catch (err: any) {
      if (err.isAuthError || err.message?.includes('invalid_grant')) {
        await db.linkedAccount.update({
          where: { id: accountId },
          data: { status: 'needs_reauth' },
        });
        eventsService.emitToUser(account.userId, {
          type: 'account_updated',
          payload: { accountId, status: 'needs_reauth' },
        });
      }
      throw err;
    }
  }

  /**
   * Sync a specific folder on demand (shallow refresh)
   */
  async syncFolder(accountId: string, folderDriveId: string): Promise<void> {
    try {
      const client = await getDriveClient(accountId);
      const res = await client.listFiles({
        folderId: folderDriveId,
        pageSize: 100,
      });

      for (const file of res.files) {
        const parentId = folderDriveId === 'root' ? null : folderDriveId;
        await db.fileNode.upsert({
          where: {
            accountId_driveId: {
              accountId,
              driveId: file.id,
            },
          },
          create: {
            accountId,
            driveId: file.id,
            parentDriveId: parentId,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            md5: file.md5Checksum || null,
            modifiedTime: new Date(file.modifiedTime),
            trashed: file.trashed,
            isFolder: file.isFolder,
            headRevisionId: file.headRevisionId || null,
            thumbnailLink: file.thumbnailLink || null,
            webViewLink: file.webViewLink || null,
          },
          update: {
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            parentDriveId: parentId,
            modifiedTime: new Date(file.modifiedTime),
            trashed: file.trashed,
            syncedAt: new Date(),
          },
        });
      }
    } catch (err) {
      // Non-fatal background refresh error
      console.warn(`Folder background sync warning for ${accountId}/${folderDriveId}:`, err);
    }
  }
}

export const syncService = new SyncService();
