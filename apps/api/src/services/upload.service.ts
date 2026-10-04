import { db } from '../db';
import { getDriveClient } from './drive/drive.factory';
import { placementService } from './placement.service';
import { config } from '../config';
import { FileNodeDTO, UploadSessionInitResponse, UploadStatusResponse } from '@omnidrive/shared';

interface ActiveUploadSession {
  uploadId: string;
  userId: string;
  accountId: string;
  driveSessionUri: string;
  fileName: string;
  mimeType: string;
  totalSize: number;
  receivedBytes: number;
  targetFolderId: string;
  createdAt: Date;
}

const activeUploads = new Map<string, ActiveUploadSession>();

export class UploadService {
  /**
   * Initialize a chunked resumable upload session
   */
  async initUpload(params: {
    userId: string;
    parent: string;
    fileName: string;
    size: number;
    mimeType: string;
    strategy?: any;
    accountId?: string;
  }): Promise<UploadSessionInitResponse> {
    const { userId, parent, fileName, size, mimeType, strategy, accountId } = params;

    // 1. Resolve target account via PlacementService
    const placement = await placementService.resolveTargetAccount({
      userId,
      fileSize: size,
      parent,
      strategy,
      explicitAccountId: accountId,
    });

    const client = await getDriveClient(placement.accountId);

    // 2. Create Drive resumable session
    const sessionRes = await client.createResumableUploadSession({
      fileName,
      mimeType,
      parentId: placement.targetFolderId,
      size,
    });

    const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    activeUploads.set(uploadId, {
      uploadId,
      userId,
      accountId: placement.accountId,
      driveSessionUri: sessionRes.sessionUri,
      fileName,
      mimeType,
      totalSize: size,
      receivedBytes: 0,
      targetFolderId: placement.targetFolderId,
      createdAt: new Date(),
    });

    return {
      uploadId,
      accountId: placement.accountId,
      sessionUri: sessionRes.sessionUri,
      targetFileName: fileName,
      targetFolderId: placement.targetFolderId,
      strategyUsed: placement.strategyUsed,
      chunkSize: config.UPLOAD_CHUNK_BYTES,
    };
  }

  /**
   * Upload a chunk to the resumable session
   */
  async uploadChunk(params: {
    uploadId: string;
    userId: string;
    chunk: Buffer;
    contentRange: string;
  }): Promise<{ isDone: boolean; bytesReceived: number; node?: FileNodeDTO }> {
    const { uploadId, userId, chunk, contentRange } = params;

    const session = activeUploads.get(uploadId);
    if (!session) {
      throw new Error(`Upload session ${uploadId} not found or expired`);
    }

    if (session.userId !== userId) {
      throw new Error('Unauthorized access to upload session');
    }

    const client = await getDriveClient(session.accountId);

    // Stream chunk to Drive's resumable session
    const result = await client.uploadChunk(session.driveSessionUri, chunk, contentRange);
    session.receivedBytes = result.bytesReceived;

    if (result.done && result.file) {
      // Upsert into local FileNode cache
      const parentId = session.targetFolderId === 'root' ? null : session.targetFolderId;
      const fileNode = await db.fileNode.upsert({
        where: {
          accountId_driveId: {
            accountId: session.accountId,
            driveId: result.file.id,
          },
        },
        create: {
          accountId: session.accountId,
          driveId: result.file.id,
          parentDriveId: parentId,
          name: result.file.name,
          mimeType: result.file.mimeType,
          size: result.file.size,
          md5: result.file.md5Checksum || null,
          modifiedTime: new Date(result.file.modifiedTime),
          trashed: false,
          isFolder: false,
          headRevisionId: result.file.headRevisionId || null,
          thumbnailLink: result.file.thumbnailLink || null,
          webViewLink: result.file.webViewLink || null,
        },
        update: {
          name: result.file.name,
          mimeType: result.file.mimeType,
          size: result.file.size,
          md5: result.file.md5Checksum || null,
          parentDriveId: parentId,
          modifiedTime: new Date(result.file.modifiedTime),
          trashed: false,
          syncedAt: new Date(),
        },
      });

      // Update account quota usage
      const account = await db.linkedAccount.findUnique({ where: { id: session.accountId } });
      if (account) {
        await db.linkedAccount.update({
          where: { id: session.accountId },
          data: {
            quotaUsage: BigInt(account.quotaUsage || 0) + BigInt(session.totalSize),
            quotaUsageInDrive: BigInt(account.quotaUsageInDrive || 0) + BigInt(session.totalSize),
          },
        });
      }

      activeUploads.delete(uploadId);

      return {
        isDone: true,
        bytesReceived: session.totalSize,
        node: {
          id: `${fileNode.accountId}:${fileNode.driveId}`,
          accountId: fileNode.accountId,
          driveId: fileNode.driveId,
          parentDriveId: fileNode.parentDriveId,
          name: fileNode.name,
          mimeType: fileNode.mimeType,
          size: fileNode.size !== null ? fileNode.size.toString() : null,
          md5: fileNode.md5,
          modifiedTime: fileNode.modifiedTime.toISOString(),
          trashed: fileNode.trashed,
          isFolder: fileNode.isFolder,
          shortcutTarget: fileNode.shortcutTarget,
          headRevisionId: fileNode.headRevisionId,
          thumbnailLink: fileNode.thumbnailLink,
          webViewLink: fileNode.webViewLink,
          syncedAt: fileNode.syncedAt.toISOString(),
        },
      };
    }

    return {
      isDone: false,
      bytesReceived: result.bytesReceived,
    };
  }

  /**
   * Get upload progress so client can resume
   */
  async getUploadStatus(uploadId: string, userId: string): Promise<UploadStatusResponse> {
    const session = activeUploads.get(uploadId);
    if (!session) {
      throw new Error(`Upload session ${uploadId} not found`);
    }

    if (session.userId !== userId) {
      throw new Error('Unauthorized');
    }

    return {
      uploadId,
      bytesReceived: session.receivedBytes,
      totalBytes: session.totalSize,
      status: 'uploading',
    };
  }
}

export const uploadService = new UploadService();
