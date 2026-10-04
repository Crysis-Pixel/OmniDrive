import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.middleware';
import { db } from '../db';
import { searchQuerySchema, FileNodeDTO, getFileTypeCategory } from '@omnidrive/shared';

export async function searchRoutes(fastify: FastifyInstance) {
  // GET /api/search - Unified cross-account search
  fastify.get('/', { preHandler: [requireAuth] }, async (req, reply) => {
    const parseResult = searchQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }

    const { q, accounts, type, trashed } = parseResult.data;

    // Get user's active accounts
    const userAccounts = await db.linkedAccount.findMany({
      where: { userId: req.user!.id },
    });

    let targetAccountIds = userAccounts.map((a: any) => a.id);
    if (accounts) {
      const requestedIds = accounts.split(',').map((s) => s.trim());
      targetAccountIds = targetAccountIds.filter((id: string) => requestedIds.includes(id));
    }

    if (targetAccountIds.length === 0) {
      return { items: [], total: 0 };
    }

    // Query file nodes
    const where: any = {
      accountId: { in: targetAccountIds },
      trashed: trashed ?? false,
    };

    if (q && q.trim().length > 0) {
      where.name = { contains: q.trim() };
    }

    let nodes = await db.fileNode.findMany({
      where,
      orderBy: { modifiedTime: 'desc' },
    });

    // Apply type filter in memory
    if (type && type !== 'all') {
      nodes = nodes.filter((n: any) => {
        const cat = getFileTypeCategory(n.mimeType, n.name);
        return cat === type;
      });
    }

    const accountMap = new Map<string, any>(userAccounts.map((a: any) => [a.id, a]));

    const dtos: FileNodeDTO[] = nodes.map((n: any) => {
      const acc = accountMap.get(n.accountId);
      return {
        id: `${n.accountId}:${n.driveId}`,
        accountId: n.accountId,
        driveId: n.driveId,
        parentDriveId: n.parentDriveId,
        name: n.name,
        mimeType: n.mimeType,
        size: n.size !== null && n.size !== undefined ? n.size.toString() : null,
        md5: n.md5,
        modifiedTime: new Date(n.modifiedTime).toISOString(),
        trashed: n.trashed,
        isFolder: n.isFolder,
        shortcutTarget: n.shortcutTarget,
        headRevisionId: n.headRevisionId,
        thumbnailLink: n.thumbnailLink,
        webViewLink: n.webViewLink,
        syncedAt: n.syncedAt ? new Date(n.syncedAt).toISOString() : new Date().toISOString(),
        accountEmail: acc?.email,
        accountLabel: acc?.label || acc?.displayName,
      };
    });

    return {
      items: dtos,
      total: dtos.length,
      query: q,
      type,
    };
  });
}
