import { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.middleware';
import { db } from '../db';
import { getDriveClient } from '../services/drive/drive.factory';
import { syncService } from '../services/sync.service';
import { transferService } from '../services/transfer.service';
import {
  createFolderSchema,
  renameNodeSchema,
  moveNodeSchema,
  copyNodeSchema,
  parseCompositeId,
  makeCompositeId,
  isGoogleDoc,
  FileNodeDTO,
  BreadcrumbItem,
  NodeListingResponse,
} from '@omnidrive/shared';

export async function nodesRoutes(fastify: FastifyInstance) {
  // GET /api/nodes - List virtual root or folder children
  fastify.get('/', { preHandler: [requireAuth] }, async (req, reply) => {
    const query = req.query as {
      parent?: string;
      pageToken?: string;
      sort?: string;
      order?: string;
    };
    const parent = query.parent || 'root';

    // -----------------------------------------------------------------------
    // Case 1: Virtual Root (parent === 'root' or empty) -> Return linked accounts as folders
    // -----------------------------------------------------------------------
    if (parent === 'root' || parent === '/') {
      const accounts = await db.linkedAccount.findMany({
        where: { userId: req.user!.id, status: 'active' },
      });

      const accountFolders: FileNodeDTO[] = accounts.map((acc: any) => ({
        id: `${acc.id}:root`,
        accountId: acc.id,
        driveId: 'root',
        parentDriveId: null,
        name: acc.label || acc.displayName || acc.email,
        mimeType: 'application/vnd.google-apps.folder',
        size: acc.quotaUsage ? acc.quotaUsage.toString() : '0',
        md5: null,
        modifiedTime: acc.lastSyncAt ? acc.lastSyncAt.toISOString() : new Date().toISOString(),
        trashed: false,
        isFolder: true,
        shortcutTarget: null,
        headRevisionId: null,
        thumbnailLink: null,
        webViewLink: null,
        syncedAt: new Date().toISOString(),
        accountEmail: acc.email,
        accountLabel: acc.label || acc.displayName,
      }));

      const res: NodeListingResponse = {
        isRoot: true,
        parent: null,
        breadcrumbs: [{ id: 'root', name: 'My Drives' }],
        items: accountFolders,
      };
      return res;
    }

    // -----------------------------------------------------------------------
    // Case 2: Folder inside an account -> compositeId "<accountId>:<driveId>"
    // -----------------------------------------------------------------------
    const parsed = parseCompositeId(parent);
    if (!parsed) {
      return reply.status(400).send({
        error: { code: 'INVALID_ID', message: `Invalid parent node ID: ${parent}` },
      });
    }

    const { accountId, driveId } = parsed;

    // Verify account ownership
    const account = await db.linkedAccount.findUnique({ where: { id: accountId } });
    if (!account || account.userId !== req.user!.id) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: 'Access denied to this drive account' },
      });
    }

    // Fetch children from local cache
    const parentFilter = driveId === 'root' ? null : driveId;
    const cachedNodes = await db.fileNode.findMany({
      where: {
        accountId,
        parentDriveId: parentFilter,
        trashed: false,
      },
    });

    // Trigger shallow background refresh
    syncService.syncFolder(accountId, driveId).catch(console.warn);

    // Build breadcrumbs
    const breadcrumbs: BreadcrumbItem[] = [
      { id: 'root', name: 'My Drives' },
      { id: `${accountId}:root`, name: account.label || account.displayName || account.email, accountId },
    ];

    let currentParentNode: FileNodeDTO | null = null;

    if (driveId !== 'root') {
      const parentRecord = await db.fileNode.findUnique({
        where: {
          accountId_driveId: { accountId, driveId },
        },
      });

      if (parentRecord) {
        currentParentNode = toDTO(parentRecord, account);
        breadcrumbs.push({
          id: parent,
          name: parentRecord.name,
          accountId,
        });
      }
    }

    const items: FileNodeDTO[] = cachedNodes.map((n: any) => toDTO(n, account));

    const response: NodeListingResponse = {
      isRoot: false,
      parent: currentParentNode,
      breadcrumbs,
      items,
    };
    return response;
  });

  // GET /api/nodes/:nodeId - Node metadata and breadcrumb chain
  fastify.get('/:nodeId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { nodeId } = req.params as { nodeId: string };
    const parsed = parseCompositeId(nodeId);
    if (!parsed) {
      return reply.status(400).send({
        error: { code: 'INVALID_ID', message: 'Invalid node ID' },
      });
    }

    const { accountId, driveId } = parsed;
    const account = await db.linkedAccount.findUnique({ where: { id: accountId } });
    if (!account || account.userId !== req.user!.id) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    if (driveId === 'root') {
      return {
        node: {
          id: nodeId,
          accountId,
          driveId: 'root',
          name: account.label || account.email,
          isFolder: true,
          mimeType: 'application/vnd.google-apps.folder',
        },
      };
    }

    const record = await db.fileNode.findUnique({
      where: { accountId_driveId: { accountId, driveId } },
    });

    if (!record) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'File not found' },
      });
    }

    return { node: toDTO(record, account) };
  });

  // POST /api/nodes/folders - Create folder
  fastify.post('/folders', { preHandler: [requireAuth] }, async (req, reply) => {
    const parseResult = createFolderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }

    const { parent, name } = parseResult.data;
    const parsed = parseCompositeId(parent);
    if (!parsed) {
      return reply.status(400).send({
        error: { code: 'INVALID_PARENT', message: 'Cannot create folder directly in virtual root. Choose a drive.' },
      });
    }

    const { accountId, driveId } = parsed;
    const account = await db.linkedAccount.findUnique({ where: { id: accountId } });
    if (!account || account.userId !== req.user!.id) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const client = await getDriveClient(accountId);
    const driveFolder = await client.createFolder(name, driveId === 'root' ? undefined : driveId);

    const created = await db.fileNode.upsert({
      where: {
        accountId_driveId: { accountId, driveId: driveFolder.id },
      },
      create: {
        accountId,
        driveId: driveFolder.id,
        parentDriveId: driveId === 'root' ? null : driveId,
        name: driveFolder.name,
        mimeType: driveFolder.mimeType,
        size: null,
        modifiedTime: new Date(driveFolder.modifiedTime),
        trashed: false,
        isFolder: true,
      },
      update: {
        name: driveFolder.name,
        modifiedTime: new Date(driveFolder.modifiedTime),
      },
    });

    return { folder: toDTO(created, account) };
  });

  // PATCH /api/nodes/:nodeId - Rename node
  fastify.patch('/:nodeId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { nodeId } = req.params as { nodeId: string };
    const parseResult = renameNodeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }

    const parsed = parseCompositeId(nodeId);
    if (!parsed) {
      return reply.status(400).send({ error: { code: 'INVALID_ID', message: 'Invalid node ID' } });
    }

    const { accountId, driveId } = parsed;
    const account = await db.linkedAccount.findUnique({ where: { id: accountId } });
    if (!account || account.userId !== req.user!.id) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const client = await getDriveClient(accountId);
    const updatedDrive = await client.renameFile(driveId, parseResult.data.name);

    const updated = await db.fileNode.update({
      where: {
        accountId_driveId: { accountId, driveId },
      },
      data: {
        name: updatedDrive.name,
        modifiedTime: new Date(updatedDrive.modifiedTime),
      },
    });

    return { node: toDTO(updated, account) };
  });

  // POST /api/nodes/:nodeId/move - Same-account or cross-account move
  fastify.post('/:nodeId/move', { preHandler: [requireAuth] }, async (req, reply) => {
    const { nodeId } = req.params as { nodeId: string };
    const parseResult = moveNodeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }

    const srcParsed = parseCompositeId(nodeId);
    const dstParsed = parseCompositeId(parseResult.data.destinationParent);

    if (!srcParsed || !dstParsed) {
      return reply.status(400).send({ error: { code: 'INVALID_ID', message: 'Invalid source or destination ID' } });
    }

    // Same-account move: use Drive API directly
    if (srcParsed.accountId === dstParsed.accountId) {
      const client = await getDriveClient(srcParsed.accountId);
      const moved = await client.moveFile(
        srcParsed.driveId,
        dstParsed.driveId === 'root' ? 'root' : dstParsed.driveId
      );

      const updated = await db.fileNode.update({
        where: {
          accountId_driveId: { accountId: srcParsed.accountId, driveId: srcParsed.driveId },
        },
        data: {
          parentDriveId: dstParsed.driveId === 'root' ? null : dstParsed.driveId,
          modifiedTime: new Date(moved.modifiedTime),
        },
      });

      const account = await db.linkedAccount.findUnique({ where: { id: srcParsed.accountId } });
      return { node: toDTO(updated, account) };
    }

    // Cross-account move: create TransferJob
    const job = await transferService.createTransferJob({
      userId: req.user!.id,
      type: 'move',
      srcAccount: srcParsed.accountId,
      srcDriveId: srcParsed.driveId,
      dstAccount: dstParsed.accountId,
      dstParentId: dstParsed.driveId,
      collisionPolicy: parseResult.data.collisionPolicy,
    });

    return { transferJob: job, message: 'Cross-account transfer queued' };
  });

  // POST /api/nodes/:nodeId/copy - Same-account or cross-account copy
  fastify.post('/:nodeId/copy', { preHandler: [requireAuth] }, async (req, reply) => {
    const { nodeId } = req.params as { nodeId: string };
    const parseResult = copyNodeSchema.safeParse(req.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.errors[0].message },
      });
    }

    const srcParsed = parseCompositeId(nodeId);
    const dstParsed = parseCompositeId(parseResult.data.destinationParent);

    if (!srcParsed || !dstParsed) {
      return reply.status(400).send({ error: { code: 'INVALID_ID', message: 'Invalid ID' } });
    }

    // Same-account copy: use Drive API directly
    if (srcParsed.accountId === dstParsed.accountId) {
      const client = await getDriveClient(srcParsed.accountId);
      const copied = await client.copyFile(
        srcParsed.driveId,
        dstParsed.driveId === 'root' ? 'root' : dstParsed.driveId,
        parseResult.data.name
      );

      const created = await db.fileNode.create({
        data: {
          accountId: srcParsed.accountId,
          driveId: copied.id,
          parentDriveId: dstParsed.driveId === 'root' ? null : dstParsed.driveId,
          name: copied.name,
          mimeType: copied.mimeType,
          size: copied.size,
          modifiedTime: new Date(copied.modifiedTime),
          trashed: false,
          isFolder: false,
        },
      });

      const account = await db.linkedAccount.findUnique({ where: { id: srcParsed.accountId } });
      return { node: toDTO(created, account) };
    }

    // Cross-account copy: create TransferJob
    const job = await transferService.createTransferJob({
      userId: req.user!.id,
      type: 'copy',
      srcAccount: srcParsed.accountId,
      srcDriveId: srcParsed.driveId,
      dstAccount: dstParsed.accountId,
      dstParentId: dstParsed.driveId,
      collisionPolicy: parseResult.data.collisionPolicy,
    });

    return { transferJob: job, message: 'Cross-account copy queued' };
  });

  // DELETE /api/nodes/:nodeId - Trash or delete permanently
  fastify.delete('/:nodeId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { nodeId } = req.params as { nodeId: string };
    const { permanent } = req.query as { permanent?: string };
    const isPermanent = permanent === 'true';

    const parsed = parseCompositeId(nodeId);
    if (!parsed) {
      return reply.status(400).send({ error: { code: 'INVALID_ID', message: 'Invalid node ID' } });
    }

    const { accountId, driveId } = parsed;
    const account = await db.linkedAccount.findUnique({ where: { id: accountId } });
    if (!account || account.userId !== req.user!.id) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const client = await getDriveClient(accountId);

    if (isPermanent) {
      await client.deletePermanently(driveId);
      await db.fileNode.deleteMany({ where: { accountId, driveId } }).catch(() => {});
    } else {
      await client.trashFile(driveId);
      try {
        await db.fileNode.update({
          where: { accountId_driveId: { accountId, driveId } },
          data: { trashed: true },
        });
      } catch (err) {
        console.warn('Could not update fileNode trashed state in DB:', err);
      }
    }

    return { success: true, permanent: isPermanent };
  });

  // POST /api/nodes/:nodeId/restore - Restore from trash
  fastify.post('/:nodeId/restore', { preHandler: [requireAuth] }, async (req, reply) => {
    const { nodeId } = req.params as { nodeId: string };
    const parsed = parseCompositeId(nodeId);
    if (!parsed) {
      return reply.status(400).send({ error: { code: 'INVALID_ID', message: 'Invalid node ID' } });
    }

    const { accountId, driveId } = parsed;
    const account = await db.linkedAccount.findUnique({ where: { id: accountId } });
    if (!account || account.userId !== req.user!.id) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const client = await getDriveClient(accountId);
    await client.restoreFile(driveId);

    try {
      const updated = await db.fileNode.update({
        where: { accountId_driveId: { accountId, driveId } },
        data: { trashed: false },
      });
      return { node: toDTO(updated, account) };
    } catch {
      return { success: true, restored: true };
    }
  });

  // GET /api/trash - List trashed files across all accounts
  fastify.get('/trash/list', { preHandler: [requireAuth] }, async (req) => {
    const accounts = await db.linkedAccount.findMany({
      where: { userId: req.user!.id },
    });

    const accountIds = accounts.map((a: any) => a.id);
    const trashedNodes = await db.fileNode.findMany({
      where: {
        accountId: { in: accountIds },
        trashed: true,
      },
    });

    const accountMap = new Map(accounts.map((a: any) => [a.id, a]));
    const items = trashedNodes.map((n: any) => toDTO(n, accountMap.get(n.accountId)));

    return { items };
  });

  // DELETE /api/trash - Empty trash
  fastify.delete('/trash', { preHandler: [requireAuth] }, async (req) => {
    const accounts = await db.linkedAccount.findMany({
      where: { userId: req.user!.id },
    });

    let count = 0;
    for (const acc of accounts) {
      try {
        const trashed = await db.fileNode.findMany({
          where: { accountId: acc.id, trashed: true },
        });

        const client = await getDriveClient(acc.id);
        for (const item of trashed) {
          await client.deletePermanently(item.driveId).catch(console.warn);
          await db.fileNode.delete({ where: { id: item.id } }).catch(console.warn);
          count++;
        }
      } catch (err) {
        console.warn(`Empty trash failed for account ${acc.id}:`, err);
      }
    }

    return { success: true, count };
  });

  // GET /api/nodes/:nodeId/content - Stream content with Range support
  fastify.get('/:nodeId/content', { preHandler: [requireAuth] }, async (req, reply) => {
    const { nodeId } = req.params as { nodeId: string };
    const { download } = req.query as { download?: string };
    const rangeHeader = req.headers.range;

    const parsed = parseCompositeId(nodeId);
    if (!parsed) {
      return reply.status(400).send({ error: { code: 'INVALID_ID', message: 'Invalid node ID' } });
    }

    const { accountId, driveId } = parsed;
    const client = await getDriveClient(accountId);
    const meta = await client.getFile(driveId);

    if (isGoogleDoc(meta.mimeType)) {
      return reply.status(400).send({
        error: {
          code: 'GOOGLE_NATIVE_DOC',
          message: 'Google Docs cannot be downloaded as binary. Use the /export endpoint instead.',
          exportUrl: `/api/nodes/${encodeURIComponent(nodeId)}/export?format=pdf`,
        },
      });
    }

    const { stream, contentLength, contentType, contentRange, filename, headRevisionId } =
      await client.downloadStream(driveId, rangeHeader);

    // Security headers per Section 9
    reply.header('X-Content-Type-Options', 'nosniff');
    if (headRevisionId) {
      reply.header('ETag', `"${headRevisionId}"`);
    }

    if (contentRange) {
      reply.status(206);
      reply.header('Content-Range', contentRange);
      reply.header('Accept-Ranges', 'bytes');
    }

    if (contentLength) {
      reply.header('Content-Length', contentLength.toString());
    }

    reply.header('Content-Type', contentType || 'application/octet-stream');

    if (download === '1') {
      const sanitized = filename.replace(/["\r\n]/g, '_');
      reply.header('Content-Disposition', `attachment; filename="${sanitized}"`);
    } else {
      reply.header('Content-Disposition', `inline; filename="${filename}"`);
    }

    return reply.send(stream);
  });

  // GET /api/nodes/:nodeId/export - Export Google Docs
  fastify.get('/:nodeId/export', { preHandler: [requireAuth] }, async (req, reply) => {
    const { nodeId } = req.params as { nodeId: string };
    const { format = 'pdf' } = req.query as { format?: string };

    const parsed = parseCompositeId(nodeId);
    if (!parsed) {
      return reply.status(400).send({ error: { code: 'INVALID_ID', message: 'Invalid node ID' } });
    }

    const { accountId, driveId } = parsed;
    const client = await getDriveClient(accountId);
    const meta = await client.getFile(driveId);

    let exportMime = 'application/pdf';
    let ext = '.pdf';

    switch (format.toLowerCase()) {
      case 'docx':
        exportMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        ext = '.docx';
        break;
      case 'xlsx':
        exportMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        ext = '.xlsx';
        break;
      case 'pptx':
        exportMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        ext = '.pptx';
        break;
      case 'txt':
        exportMime = 'text/plain';
        ext = '.txt';
        break;
      case 'csv':
        exportMime = 'text/csv';
        ext = '.csv';
        break;
      default:
        exportMime = 'application/pdf';
        ext = '.pdf';
    }

    const { stream, contentType } = await client.exportDocument(driveId, exportMime);
    const downloadFilename = `${meta.name}${meta.name.endsWith(ext) ? '' : ext}`;

    reply.header('Content-Type', contentType);
    reply.header('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    return reply.send(stream);
  });

  // PUT /api/nodes/:nodeId/content - Save edited file with revision concurrency check
  fastify.put('/:nodeId/content', { preHandler: [requireAuth] }, async (req, reply) => {
    const { nodeId } = req.params as { nodeId: string };
    const ifMatch = req.headers['if-match'] as string | undefined;

    const parsed = parseCompositeId(nodeId);
    if (!parsed) {
      return reply.status(400).send({ error: { code: 'INVALID_ID', message: 'Invalid node ID' } });
    }

    const { accountId, driveId } = parsed;
    const account = await db.linkedAccount.findUnique({ where: { id: accountId } });
    if (!account || account.userId !== req.user!.id) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    const client = await getDriveClient(accountId);

    // Read request body as buffer
    const bodyBuffer = req.body as Buffer;
    const content = Buffer.isBuffer(bodyBuffer) ? bodyBuffer : Buffer.from(String(bodyBuffer || ''));

    try {
      const cleanIfMatch = ifMatch ? ifMatch.replace(/"/g, '') : undefined;
      const updatedDrive = await client.updateFileContent(driveId, content, cleanIfMatch);

      const updated = await db.fileNode.update({
        where: { accountId_driveId: { accountId, driveId } },
        data: {
          size: updatedDrive.size,
          modifiedTime: new Date(updatedDrive.modifiedTime),
          headRevisionId: updatedDrive.headRevisionId,
        },
      });

      return { node: toDTO(updated, account) };
    } catch (err: any) {
      if (err.statusCode === 409 || err.message?.includes('conflict')) {
        return reply.status(409).send({
          error: {
            code: 'REVISION_CONFLICT',
            message: 'Remote file revision conflict: the file has been modified elsewhere.',
            currentHeadRevision: err.currentHeadRevision,
          },
        });
      }
      throw err;
    }
  });
}

function toDTO(node: any, account?: any): FileNodeDTO {
  return {
    id: makeCompositeId(node.accountId, node.driveId),
    accountId: node.accountId,
    driveId: node.driveId,
    parentDriveId: node.parentDriveId,
    name: node.name,
    mimeType: node.mimeType,
    size: node.size !== null && node.size !== undefined ? node.size.toString() : null,
    md5: node.md5,
    modifiedTime: new Date(node.modifiedTime).toISOString(),
    trashed: node.trashed,
    isFolder: node.isFolder,
    shortcutTarget: node.shortcutTarget,
    headRevisionId: node.headRevisionId,
    thumbnailLink: node.thumbnailLink,
    webViewLink: node.webViewLink,
    syncedAt: node.syncedAt ? new Date(node.syncedAt).toISOString() : new Date().toISOString(),
    accountEmail: account?.email,
    accountLabel: account?.label || account?.displayName,
  };
}
