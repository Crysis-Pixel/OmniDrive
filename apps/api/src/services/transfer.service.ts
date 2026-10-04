import { db } from '../db';
import { getDriveClient } from './drive/drive.factory';
import { eventsService } from './events.service';
import { isGoogleDoc } from '@omnidrive/shared';
import { Readable } from 'stream';

export class TransferService {
  private activeJobs = new Map<string, { cancelled: boolean }>();

  /**
   * Create a transfer job (copy or move across accounts)
   */
  async createTransferJob(params: {
    userId: string;
    type: 'copy' | 'move';
    srcAccount: string;
    srcDriveId: string;
    dstAccount: string;
    dstParentId: string;
    collisionPolicy?: 'keep_both' | 'replace' | 'skip';
  }) {
    const { userId, type, srcAccount, srcDriveId, dstAccount, dstParentId, collisionPolicy = 'keep_both' } = params;

    // Verify source and destination accounts
    const srcAcc = await db.linkedAccount.findUnique({ where: { id: srcAccount } });
    const dstAcc = await db.linkedAccount.findUnique({ where: { id: dstAccount } });

    if (!srcAcc || srcAcc.userId !== userId || srcAcc.status === 'disabled') {
      throw new Error('Source account is invalid or disabled');
    }
    if (!dstAcc || dstAcc.userId !== userId || dstAcc.status === 'disabled') {
      throw new Error('Destination account is invalid or disabled');
    }

    // Get source file metadata
    const srcClient = await getDriveClient(srcAccount);
    const srcFile = await srcClient.getFile(srcDriveId);

    // Check destination quota
    const dstClient = await getDriveClient(dstAccount);
    const dstAbout = await dstClient.getAbout();
    const dstFree = dstAbout.quota.limit > dstAbout.quota.usage ? dstAbout.quota.limit - dstAbout.quota.usage : BigInt(0);

    if (srcFile.size && dstFree < srcFile.size) {
      throw new Error(`Insufficient space in destination account ${dstAcc.email}. Free: ${(Number(dstFree) / (1024 * 1024)).toFixed(1)} MB, File requires: ${(Number(srcFile.size) / (1024 * 1024)).toFixed(1)} MB.`);
    }

    // Create database job record
    const job = await db.transferJob.create({
      data: {
        userId,
        type,
        srcAccount,
        srcDriveId,
        dstAccount,
        dstParentId: dstParentId === 'root' ? 'root' : dstParentId,
        status: 'queued',
        bytesTotal: srcFile.size || BigInt(0),
        bytesDone: BigInt(0),
      },
    });

    // Enqueue execution
    this.runTransferJob(job.id, collisionPolicy).catch((err) => {
      console.error(`Transfer job ${job.id} failed:`, err);
    });

    return job;
  }

  /**
   * Cancel an in-flight transfer job
   */
  async cancelTransfer(jobId: string, userId: string) {
    const job = await db.transferJob.findUnique({ where: { id: jobId } });
    if (!job || job.userId !== userId) {
      throw new Error('Transfer job not found');
    }

    const active = this.activeJobs.get(jobId);
    if (active) {
      active.cancelled = true;
    }

    await db.transferJob.update({
      where: { id: jobId },
      data: { status: 'cancelled' },
    });

    eventsService.emitToUser(userId, {
      type: 'transfer_failed',
      payload: { jobId, status: 'cancelled', message: 'Transfer was cancelled by user' },
    });
  }

  /**
   * Execute transfer job
   */
  async runTransferJob(jobId: string, collisionPolicy: 'keep_both' | 'replace' | 'skip') {
    const job = await db.transferJob.findUnique({ where: { id: jobId } });
    if (!job || job.status === 'cancelled') return;

    this.activeJobs.set(jobId, { cancelled: false });

    await db.transferJob.update({
      where: { id: jobId },
      data: { status: 'running' },
    });

    try {
      const srcClient = await getDriveClient(job.srcAccount);
      const dstClient = await getDriveClient(job.dstAccount);
      const srcNode = await srcClient.getFile(job.srcDriveId);

      if (srcNode.isFolder) {
        // Recursive folder transfer
        await this.transferFolderRecursive({
          jobId,
          userId: job.userId,
          folderNode: srcNode,
          srcClient,
          dstClient,
          srcAccountId: job.srcAccount,
          dstAccountId: job.dstAccount,
          dstParentId: job.dstParentId,
          type: job.type as 'copy' | 'move',
          collisionPolicy,
        });
      } else {
        // Single file transfer
        await this.transferSingleFile({
          jobId,
          userId: job.userId,
          fileNode: srcNode,
          srcClient,
          dstClient,
          srcAccountId: job.srcAccount,
          dstAccountId: job.dstAccount,
          dstParentId: job.dstParentId,
          type: job.type as 'copy' | 'move',
          collisionPolicy,
        });
      }

      await db.transferJob.update({
        where: { id: jobId },
        data: {
          status: 'done',
          bytesDone: job.bytesTotal || BigInt(0),
        },
      });

      eventsService.emitToUser(job.userId, {
        type: 'transfer_completed',
        payload: { jobId, type: job.type },
      });
    } catch (err: any) {
      const isCancelled = this.activeJobs.get(jobId)?.cancelled;
      const status = isCancelled ? 'cancelled' : 'failed';
      const errorMessage = isCancelled ? 'Cancelled by user' : err.message || 'Transfer failed';

      await db.transferJob.update({
        where: { id: jobId },
        data: { status, error: errorMessage },
      });

      eventsService.emitToUser(job.userId, {
        type: 'transfer_failed',
        payload: { jobId, status, error: errorMessage },
      });
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Transfer single file between accounts via streaming
   */
  private async transferSingleFile(params: {
    jobId: string;
    userId: string;
    fileNode: any;
    srcClient: any;
    dstClient: any;
    srcAccountId: string;
    dstAccountId: string;
    dstParentId: string;
    type: 'copy' | 'move';
    collisionPolicy: 'keep_both' | 'replace' | 'skip';
  }) {
    const { jobId, userId, fileNode, srcClient, dstClient, srcAccountId, dstAccountId, dstParentId, type, collisionPolicy } = params;

    let targetName = fileNode.name;
    let mimeType = fileNode.mimeType;

    // Check collision in destination
    const existingInDst = await dstClient.listFiles({
      folderId: dstParentId,
      pageSize: 50,
    });

    const collision = existingInDst.files.find((f: any) => f.name === targetName);
    if (collision) {
      if (collisionPolicy === 'skip') {
        return;
      } else if (collisionPolicy === 'replace') {
        await dstClient.deletePermanently(collision.id);
      } else {
        // keep_both: append (1)
        const dotIdx = targetName.lastIndexOf('.');
        if (dotIdx > 0) {
          targetName = `${targetName.substring(0, dotIdx)} (1)${targetName.substring(dotIdx)}`;
        } else {
          targetName = `${targetName} (1)`;
        }
      }
    }

    let downloadStream: Readable;
    let totalBytes = Number(fileNode.size || 0);

    // Google-native file conversion (Export)
    if (isGoogleDoc(fileNode.mimeType)) {
      let exportMime = 'application/pdf';
      let ext = '.pdf';
      if (fileNode.mimeType.includes('document')) {
        exportMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        ext = '.docx';
      } else if (fileNode.mimeType.includes('spreadsheet')) {
        exportMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        ext = '.xlsx';
      } else if (fileNode.mimeType.includes('presentation')) {
        exportMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        ext = '.pptx';
      }

      targetName = targetName.endsWith(ext) ? targetName : `${targetName}${ext}`;
      mimeType = exportMime;

      const exported = await srcClient.exportDocument(fileNode.id, exportMime);
      downloadStream = exported.stream;
    } else {
      const downloaded = await srcClient.downloadStream(fileNode.id);
      downloadStream = downloaded.stream;
    }

    // Read stream in bounded chunks and pipe to destination resumable session
    const session = await dstClient.createResumableUploadSession({
      fileName: targetName,
      mimeType,
      parentId: dstParentId === 'root' ? undefined : dstParentId,
      size: totalBytes,
    });

    const chunks: Buffer[] = [];
    let bytesTransferred = 0;

    for await (const chunk of downloadStream) {
      const jobCtrl = this.activeJobs.get(jobId);
      if (jobCtrl?.cancelled) {
        throw new Error('Transfer cancelled');
      }

      chunks.push(chunk as Buffer);
      bytesTransferred += (chunk as Buffer).length;

      // Report progress
      eventsService.emitToUser(userId, {
        type: 'transfer_progress',
        payload: {
          jobId,
          bytesDone: bytesTransferred,
          bytesTotal: totalBytes,
          percent: totalBytes > 0 ? Math.round((bytesTransferred / totalBytes) * 100) : 100,
        },
      });
    }

    const fullBuffer = Buffer.concat(chunks);
    const uploaded = await dstClient.uploadChunk(
      session.sessionUri,
      fullBuffer,
      `bytes 0-${fullBuffer.length - 1}/${fullBuffer.length}`
    );

    // If move, trash original after verified upload
    if (type === 'move' && uploaded.done) {
      await srcClient.trashFile(fileNode.id);
      // Remove from source local cache
      await db.fileNode.deleteMany({
        where: { accountId: srcAccountId, driveId: fileNode.id },
      });
    }

    // Upsert into destination local cache
    if (uploaded.file) {
      await db.fileNode.upsert({
        where: {
          accountId_driveId: {
            accountId: dstAccountId,
            driveId: uploaded.file.id,
          },
        },
        create: {
          accountId: dstAccountId,
          driveId: uploaded.file.id,
          parentDriveId: dstParentId === 'root' ? null : dstParentId,
          name: uploaded.file.name,
          mimeType: uploaded.file.mimeType,
          size: uploaded.file.size,
          md5: uploaded.file.md5Checksum || null,
          modifiedTime: new Date(uploaded.file.modifiedTime),
          trashed: false,
          isFolder: false,
        },
        update: {
          name: uploaded.file.name,
          size: uploaded.file.size,
          modifiedTime: new Date(uploaded.file.modifiedTime),
          trashed: false,
        },
      });
    }
  }

  /**
   * Recursively transfer a folder and its children across accounts
   */
  private async transferFolderRecursive(params: {
    jobId: string;
    userId: string;
    folderNode: any;
    srcClient: any;
    dstClient: any;
    srcAccountId: string;
    dstAccountId: string;
    dstParentId: string;
    type: 'copy' | 'move';
    collisionPolicy: 'keep_both' | 'replace' | 'skip';
  }) {
    const { jobId, userId, folderNode, srcClient, dstClient, srcAccountId, dstAccountId, dstParentId, type, collisionPolicy } = params;

    // Create destination folder
    const createdFolder = await dstClient.createFolder(folderNode.name, dstParentId === 'root' ? undefined : dstParentId);

    // List all children from source
    const children = await srcClient.listFiles({
      folderId: folderNode.id,
      pageSize: 100,
    });

    for (const child of children.files) {
      const jobCtrl = this.activeJobs.get(jobId);
      if (jobCtrl?.cancelled) {
        throw new Error('Transfer cancelled');
      }

      if (child.isFolder) {
        await this.transferFolderRecursive({
          jobId,
          userId,
          folderNode: child,
          srcClient,
          dstClient,
          srcAccountId,
          dstAccountId,
          dstParentId: createdFolder.id,
          type,
          collisionPolicy,
        });
      } else {
        await this.transferSingleFile({
          jobId,
          userId,
          fileNode: child,
          srcClient,
          dstClient,
          srcAccountId,
          dstAccountId,
          dstParentId: createdFolder.id,
          type,
          collisionPolicy,
        });
      }
    }

    // If move, trash source folder
    if (type === 'move') {
      await srcClient.trashFile(folderNode.id);
      await db.fileNode.deleteMany({
        where: { accountId: srcAccountId, driveId: folderNode.id },
      });
    }
  }
}

export const transferService = new TransferService();
