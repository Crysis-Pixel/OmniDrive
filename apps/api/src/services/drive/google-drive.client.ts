import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import {
  IDriveClient,
  DriveQuota,
  DriveUserInfo,
  DriveFileItem,
  ListFilesResult,
  ResumableSessionResult,
  UploadChunkResult,
  DownloadStreamResult,
} from './drive.interface';
import { config } from '../../config';

const DRIVE_FILE_FIELDS =
  'id,name,mimeType,size,modifiedTime,md5Checksum,parents,trashed,iconLink,thumbnailLink,webViewLink,headRevisionId';

export class GoogleDriveClient implements IDriveClient {
  private drive: drive_v3.Drive;
  private oauth2Client: any;
  private activeRequests = 0;
  private maxConcurrent = 5;
  private queue: (() => void)[] = [];

  constructor(refreshToken: string) {
    this.oauth2Client = new google.auth.OAuth2(
      config.GOOGLE_CLIENT_ID,
      config.GOOGLE_CLIENT_SECRET,
      config.GOOGLE_REDIRECT_URI
    );

    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    this.drive = google.drive({
      version: 'v3',
      auth: this.oauth2Client,
    });
  }

  /**
   * Concurrency limiter and exponential backoff retry wrapper
   */
  private async withLimiter<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeRequests >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.activeRequests++;

    try {
      return await this.withBackoff(fn);
    } finally {
      this.activeRequests--;
      const next = this.queue.shift();
      if (next) next();
    }
  }

  /**
   * Exponential backoff with jitter on 429, 403 rate limits, and 5xx
   */
  private async withBackoff<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (err: any) {
        attempt++;
        const status = err?.status || err?.code || err?.response?.status;
        const message = err?.message || '';
        const isRateLimit =
          status === 429 ||
          (status === 403 &&
            (message.includes('rateLimitExceeded') ||
              message.includes('userRateLimitExceeded') ||
              message.includes('Quota exceeded')));
        const isServerError = status >= 500 && status < 600;

        if (attempt <= maxRetries && (isRateLimit || isServerError)) {
          // Exponential delay + random jitter
          const baseDelay = Math.pow(2, attempt) * 500;
          const jitter = Math.random() * 300;
          const delay = baseDelay + jitter;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        // If invalid_grant, rethrow with specific status
        if (message.includes('invalid_grant')) {
          err.isAuthError = true;
        }

        throw err;
      }
    }
  }

  async getAbout(): Promise<{ quota: DriveQuota; user: DriveUserInfo }> {
    return this.withLimiter(async () => {
      const res = await this.drive.about.get({
        fields: 'storageQuota,user',
      });

      const q = res.data.storageQuota || {};
      const u = res.data.user || {};

      return {
        quota: {
          limit: q.limit ? BigInt(q.limit) : BigInt(15 * 1024 * 1024 * 1024),
          usage: q.usage ? BigInt(q.usage) : BigInt(0),
          usageInDrive: q.usageInDrive ? BigInt(q.usageInDrive) : BigInt(0),
          usageInTrash: q.usageInDriveTrash ? BigInt(q.usageInDriveTrash) : BigInt(0),
        },
        user: {
          displayName: u.displayName || 'Google Drive User',
          emailAddress: u.emailAddress || '',
          photoLink: u.photoLink || null,
        },
      };
    });
  }

  async listFiles(params: {
    folderId?: string;
    trashed?: boolean;
    pageToken?: string;
    pageSize?: number;
    query?: string;
  }): Promise<ListFilesResult> {
    return this.withLimiter(async () => {
      const qParts: string[] = [];
      const isTrashed = params.trashed ?? false;
      qParts.push(`trashed = ${isTrashed}`);

      if (!isTrashed && params.folderId) {
        const folder = params.folderId === 'root' ? 'root' : params.folderId;
        qParts.push(`'${folder}' in parents`);
      }

      if (params.query) {
        // Safe string escaping for Drive query
        const sanitized = params.query.replace(/'/g, "\\'");
        qParts.push(`name contains '${sanitized}'`);
      }

      const res = await this.drive.files.list({
        q: qParts.join(' and '),
        fields: `nextPageToken, files(${DRIVE_FILE_FIELDS})`,
        pageSize: params.pageSize || 100,
        pageToken: params.pageToken || undefined,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const files: DriveFileItem[] = (res.data.files || []).map((f) => ({
        id: f.id!,
        name: f.name || 'Untitled',
        mimeType: f.mimeType || 'application/octet-stream',
        size: f.size ? BigInt(f.size) : null,
        md5Checksum: f.md5Checksum || null,
        modifiedTime: f.modifiedTime || new Date().toISOString(),
        trashed: f.trashed || false,
        parents: f.parents || [],
        headRevisionId: f.headRevisionId || null,
        thumbnailLink: f.thumbnailLink || null,
        webViewLink: f.webViewLink || null,
        isFolder: f.mimeType === 'application/vnd.google-apps.folder',
      }));

      return {
        files,
        nextPageToken: res.data.nextPageToken || null,
      };
    });
  }

  async getFile(fileId: string): Promise<DriveFileItem> {
    return this.withLimiter(async () => {
      const res = await this.drive.files.get({
        fileId,
        fields: DRIVE_FILE_FIELDS,
        supportsAllDrives: true,
      });

      const f = res.data;
      return {
        id: f.id!,
        name: f.name || 'Untitled',
        mimeType: f.mimeType || 'application/octet-stream',
        size: f.size ? BigInt(f.size) : null,
        md5Checksum: f.md5Checksum || null,
        modifiedTime: f.modifiedTime || new Date().toISOString(),
        trashed: f.trashed || false,
        parents: f.parents || [],
        headRevisionId: f.headRevisionId || null,
        thumbnailLink: f.thumbnailLink || null,
        webViewLink: f.webViewLink || null,
        isFolder: f.mimeType === 'application/vnd.google-apps.folder',
      };
    });
  }

  async createFolder(name: string, parentId = 'root'): Promise<DriveFileItem> {
    return this.withLimiter(async () => {
      const res = await this.drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        },
        fields: DRIVE_FILE_FIELDS,
        supportsAllDrives: true,
      });

      const f = res.data;
      return {
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        size: null,
        modifiedTime: f.modifiedTime || new Date().toISOString(),
        trashed: false,
        parents: f.parents || [parentId],
        isFolder: true,
      };
    });
  }

  async renameFile(fileId: string, newName: string): Promise<DriveFileItem> {
    return this.withLimiter(async () => {
      const res = await this.drive.files.update({
        fileId,
        requestBody: { name: newName },
        fields: DRIVE_FILE_FIELDS,
        supportsAllDrives: true,
      });
      const f = res.data;
      return {
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        size: f.size ? BigInt(f.size) : null,
        modifiedTime: f.modifiedTime || new Date().toISOString(),
        trashed: f.trashed || false,
        parents: f.parents || [],
        headRevisionId: f.headRevisionId || null,
        isFolder: f.mimeType === 'application/vnd.google-apps.folder',
      };
    });
  }

  async trashFile(fileId: string): Promise<DriveFileItem> {
    return this.withLimiter(async () => {
      const res = await this.drive.files.update({
        fileId,
        requestBody: { trashed: true },
        fields: DRIVE_FILE_FIELDS,
        supportsAllDrives: true,
      });
      const f = res.data;
      return {
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        size: f.size ? BigInt(f.size) : null,
        modifiedTime: f.modifiedTime || new Date().toISOString(),
        trashed: true,
        isFolder: f.mimeType === 'application/vnd.google-apps.folder',
      };
    });
  }

  async restoreFile(fileId: string): Promise<DriveFileItem> {
    return this.withLimiter(async () => {
      const res = await this.drive.files.update({
        fileId,
        requestBody: { trashed: false },
        fields: DRIVE_FILE_FIELDS,
        supportsAllDrives: true,
      });
      const f = res.data;
      return {
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        size: f.size ? BigInt(f.size) : null,
        modifiedTime: f.modifiedTime || new Date().toISOString(),
        trashed: false,
        isFolder: f.mimeType === 'application/vnd.google-apps.folder',
      };
    });
  }

  async deletePermanently(fileId: string): Promise<void> {
    return this.withLimiter(async () => {
      await this.drive.files.delete({
        fileId,
        supportsAllDrives: true,
      });
    });
  }

  async moveFile(fileId: string, newParentId: string, oldParentId?: string): Promise<DriveFileItem> {
    return this.withLimiter(async () => {
      const file = await this.getFile(fileId);
      const previousParents = oldParentId ? oldParentId : (file.parents || []).join(',');

      const res = await this.drive.files.update({
        fileId,
        addParents: newParentId,
        removeParents: previousParents,
        fields: DRIVE_FILE_FIELDS,
        supportsAllDrives: true,
      });
      const f = res.data;
      return {
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        size: f.size ? BigInt(f.size) : null,
        modifiedTime: f.modifiedTime || new Date().toISOString(),
        trashed: f.trashed || false,
        parents: f.parents || [newParentId],
        isFolder: f.mimeType === 'application/vnd.google-apps.folder',
      };
    });
  }

  async copyFile(fileId: string, newParentId: string, newName?: string): Promise<DriveFileItem> {
    return this.withLimiter(async () => {
      const res = await this.drive.files.copy({
        fileId,
        requestBody: {
          name: newName,
          parents: [newParentId],
        },
        fields: DRIVE_FILE_FIELDS,
        supportsAllDrives: true,
      });
      const f = res.data;
      return {
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        size: f.size ? BigInt(f.size) : null,
        modifiedTime: f.modifiedTime || new Date().toISOString(),
        trashed: false,
        parents: f.parents || [newParentId],
        isFolder: false,
      };
    });
  }

  async createResumableUploadSession(params: {
    fileName: string;
    mimeType: string;
    parentId?: string;
    size: number;
  }): Promise<ResumableSessionResult> {
    return this.withLimiter(async () => {
      const token = (await this.oauth2Client.getAccessToken()).token;
      const metadata = {
        name: params.fileName,
        mimeType: params.mimeType,
        parents: params.parentId ? [params.parentId] : ['root'],
      };

      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': params.mimeType,
            'X-Upload-Content-Length': params.size.toString(),
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create resumable upload session: ${response.status} ${errorText}`);
      }

      const sessionUri = response.headers.get('location');
      if (!sessionUri) {
        throw new Error('Drive did not return resumable location header');
      }

      return { sessionUri };
    });
  }

  async uploadChunk(sessionUri: string, chunk: Buffer, contentRange: string): Promise<UploadChunkResult> {
    return this.withLimiter(async () => {
      const response = await fetch(sessionUri, {
        method: 'PUT',
        headers: {
          'Content-Length': chunk.length.toString(),
          'Content-Range': contentRange,
        },
        body: chunk as any,
      });

      // 308 Resume Incomplete = chunk received, more expected
      if (response.status === 308) {
        const range = response.headers.get('Range');
        let bytesReceived = 0;
        if (range) {
          const match = range.match(/bytes=0-(\d+)/);
          if (match) bytesReceived = parseInt(match[1], 10) + 1;
        }
        return { done: false, bytesReceived };
      }

      // 200 or 201 = upload complete!
      if (response.status === 200 || response.status === 201) {
        const fileJson: any = await response.json();
        const file: DriveFileItem = {
          id: fileJson.id,
          name: fileJson.name,
          mimeType: fileJson.mimeType,
          size: fileJson.size ? BigInt(fileJson.size) : null,
          modifiedTime: fileJson.modifiedTime || new Date().toISOString(),
          trashed: false,
          isFolder: false,
        };
        return { done: true, bytesReceived: chunk.length, file };
      }

      const errorText = await response.text();
      throw new Error(`Upload chunk failed with status ${response.status}: ${errorText}`);
    });
  }

  async downloadStream(fileId: string, range?: string): Promise<DownloadStreamResult> {
    return this.withLimiter(async () => {
      const meta = await this.getFile(fileId);
      const headers: Record<string, string> = {};
      if (range) {
        headers['Range'] = range;
      }

      const res = await this.drive.files.get(
        {
          fileId,
          alt: 'media',
          supportsAllDrives: true,
        },
        {
          responseType: 'stream',
          headers,
        }
      );

      return {
        stream: res.data as Readable,
        contentLength: res.headers['content-length'] ? parseInt(res.headers['content-length'] as string, 10) : undefined,
        contentType: (res.headers['content-type'] as string) || meta.mimeType,
        contentRange: res.headers['content-range'] as string | undefined,
        filename: meta.name,
        headRevisionId: meta.headRevisionId || undefined,
        md5Checksum: meta.md5Checksum || undefined,
      };
    });
  }

  async exportDocument(fileId: string, exportMimeType: string): Promise<{ stream: Readable; contentType: string }> {
    return this.withLimiter(async () => {
      const res = await this.drive.files.export(
        {
          fileId,
          mimeType: exportMimeType,
        },
        {
          responseType: 'stream',
        }
      );

      return {
        stream: res.data as Readable,
        contentType: exportMimeType,
      };
    });
  }

  async updateFileContent(fileId: string, content: Buffer, ifMatchHeadRevision?: string): Promise<DriveFileItem> {
    return this.withLimiter(async () => {
      if (ifMatchHeadRevision) {
        const current = await this.getFile(fileId);
        if (current.headRevisionId && current.headRevisionId !== ifMatchHeadRevision) {
          const err: any = new Error('Remote file conflict: file has been modified elsewhere.');
          err.statusCode = 409;
          err.currentHeadRevision = current.headRevisionId;
          throw err;
        }
      }

      const stream = new Readable();
      stream.push(content);
      stream.push(null);

      const res = await this.drive.files.update({
        fileId,
        media: {
          mimeType: 'application/octet-stream',
          body: stream,
        },
        fields: DRIVE_FILE_FIELDS,
        supportsAllDrives: true,
      });

      const f = res.data;
      return {
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        size: f.size ? BigInt(f.size) : null,
        modifiedTime: f.modifiedTime || new Date().toISOString(),
        trashed: f.trashed || false,
        headRevisionId: f.headRevisionId || null,
        isFolder: false,
      };
    });
  }
}
