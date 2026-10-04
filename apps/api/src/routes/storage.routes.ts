import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.middleware';
import { db } from '../db';
import { StorageSummaryResponse, StorageAccountBreakdown } from '@omnidrive/shared';

export async function storageRoutes(fastify: FastifyInstance) {
  // GET /api/storage/summary - Combined and per-account quota view
  fastify.get('/summary', { preHandler: [requireAuth] }, async (req) => {
    const accounts = await db.linkedAccount.findMany({
      where: { userId: req.user!.id },
    });

    let totalLimit = 0;
    let totalUsage = 0;
    let totalUsageInDrive = 0;
    let totalUsageInTrash = 0;

    const breakdown: StorageAccountBreakdown[] = accounts.map((acc: any) => {
      const limit = Number(acc.quotaLimit || BigInt(15 * 1024 * 1024 * 1024));
      const usage = Number(acc.quotaUsage || BigInt(0));
      const usageInDrive = Number(acc.quotaUsageInDrive || BigInt(0));
      const usageInTrash = Number(acc.quotaUsageInTrash || BigInt(0));
      const free = Math.max(0, limit - usage);
      const percentUsed = limit > 0 ? Math.min(100, Math.round((usage / limit) * 100)) : 0;

      if (acc.status === 'active') {
        totalLimit += limit;
        totalUsage += usage;
        totalUsageInDrive += usageInDrive;
        totalUsageInTrash += usageInTrash;
      }

      return {
        accountId: acc.id,
        email: acc.email,
        label: acc.label,
        status: acc.status,
        limit,
        usage,
        usageInDrive,
        usageInTrash,
        free,
        percentUsed,
      };
    });

    const totalFree = Math.max(0, totalLimit - totalUsage);
    const totalPercentUsed = totalLimit > 0 ? Math.min(100, Math.round((totalUsage / totalLimit) * 100)) : 0;

    const response: StorageSummaryResponse = {
      totalLimit,
      totalUsage,
      totalUsageInDrive,
      totalUsageInTrash,
      totalFree,
      totalPercentUsed,
      accounts: breakdown,
    };

    return response;
  });
}
