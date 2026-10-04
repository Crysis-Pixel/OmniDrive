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

interface StoredFile extends DriveFileItem {
  content: Buffer;
  revisionCounter: number;
}

export class FakeDriveClient implements IDriveClient {
  public accountEmail: string;
  public displayName: string;
  private files = new Map<string, StoredFile>();
  private uploadSessions = new Map<string, {
    fileId: string;
    fileName: string;
    mimeType: string;
    parentId: string;
    totalSize: number;
    receivedBytes: number;
    chunks: Buffer[];
  }>();
  private quotaLimit: bigint = BigInt(15) * BigInt(1024 * 1024 * 1024); // 15 GB
  private idCounter = 100;

  constructor(email: string, displayName: string, seedDefaultFiles = true) {
    this.accountEmail = email;
    this.displayName = displayName;

    if (seedDefaultFiles) {
      this.seedInitialData();
    }
  }

  private seedInitialData() {
    // Root folder marker
    this.createFolderInternal('root', 'Root', undefined);

    // Some subfolders
    const projectsFolder = this.createFolderInternal('fld_projects', 'Projects & Docs', 'root');
    const mediaFolder = this.createFolderInternal('fld_media', 'Media & Assets', 'root');
    const sourceFolder = this.createFolderInternal('fld_source', 'Source Code', 'root');

    // Files in root
    this.createFileInternal({
      id: 'doc_welcome',
      name: 'Welcome to OmniDrive.md',
      mimeType: 'text/markdown',
      content: Buffer.from(`# Welcome to OmniDrive! 🚀\n\nOmniDrive unites all your Google Drive accounts into one cohesive workspace.\n\n### Key Features:\n- **Unified Virtual Filesystem**: Browse, search, and manage all your accounts from one place.\n- **Smart Uploads**: Automatic distribution based on highest free space or fill-first priority.\n- **Built-in Editor**: Edit code and markdown directly in the browser.\n- **Cross-Account Transfers**: Copy or move files between drives seamlessly.\n\nEnjoy the seamless cloud experience!\n`),
      parentId: 'root',
    });

    this.createFileInternal({
      id: 'gdoc_roadmap',
      name: 'Q4 Product Strategy',
      mimeType: 'application/vnd.google-apps.document',
      content: Buffer.from('Google Document: Q4 Product Strategy'),
      parentId: 'root',
    });

    // Files in Projects
    this.createFileInternal({
      id: 'doc_budget',
      name: '2026_Annual_Budget.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: Buffer.from('Mock spreadsheet binary data'),
      parentId: projectsFolder.id,
      size: BigInt(245760),
    });

    this.createFileInternal({
      id: 'doc_contract',
      name: 'Service_Agreement_Signed.pdf',
      mimeType: 'application/pdf',
      content: Buffer.from('%PDF-1.4 Mock PDF Content for Service Agreement'),
      parentId: projectsFolder.id,
      size: BigInt(512400),
    });

    // Files in Media
    this.createFileInternal({
      id: 'img_hero',
      name: 'banner_illustration.png',
      mimeType: 'image/png',
      content: Buffer.from('Mock PNG data'),
      parentId: mediaFolder.id,
      size: BigInt(1843200),
    });

    // Files in Source Code
    this.createFileInternal({
      id: 'code_app',
      name: 'server.ts',
      mimeType: 'text/typescript',
      content: Buffer.from(`import fastify from 'fastify';\n\nconst app = fastify({ logger: true });\n\napp.get('/health', async () => {\n  return { status: 'healthy', timestamp: new Date().toISOString() };\n});\n\napp.listen({ port: 3000 }, (err) => {\n  if (err) throw err;\n  console.log('Server running on port 3000');\n});\n`),
      parentId: sourceFolder.id,
    });

    this.createFileInternal({
      id: 'code_cfg',
      name: 'settings.json',
      mimeType: 'application/json',
      content: Buffer.from(JSON.stringify({ app: 'OmniDrive', version: '1.0.0', environment: 'production', cluster: { nodes: 3, replicas: 2 } }, null, 2)),
      parentId: sourceFolder.id,
    });
  }

  private createFolderInternal(id: string, name: string, parentId?: string): StoredFile {
    const folder: StoredFile = {
      id,
      name,
      mimeType: 'application/vnd.google-apps.folder',
      isFolder: true,
      size: null,
      trashed: false,
      modifiedTime: new Date().toISOString(),
      parents: parentId ? [parentId] : [],
      content: Buffer.alloc(0),
      revisionCounter: 1,
      headRevisionId: 'rev_1',
    };
    this.files.set(id, folder);
    return folder;
  }

  private createFileInternal(params: {
    id?: string;
    name: string;
    mimeType: string;
    content: Buffer;
    parentId?: string;
    size?: bigint;
  }): StoredFile {
    const id = params.id || `file_${this.idCounter++}`;
    const file: StoredFile = {
      id,
      name: params.name,
      mimeType: params.mimeType,
      isFolder: false,
      size: params.size !== undefined ? params.size : BigInt(params.content.length),
      md5Checksum: `md5_${id}`,
      trashed: false,
      modifiedTime: new Date().toISOString(),
      parents: params.parentId ? [params.parentId] : ['root'],
      content: params.content,
      revisionCounter: 1,
      headRevisionId: `rev_${id}_1`,
      webViewLink: `https://drive.google.com/open?id=${id}`,
    };
    this.files.set(id, file);
    return file;
  }

  async getAbout(): Promise<{ quota: DriveQuota; user: DriveUserInfo }> {
    let usageInDrive = BigInt(0);
    let usageInTrash = BigInt(0);

    for (const f of this.files.values()) {
      if (!f.isFolder && f.size) {
        if (f.trashed) {
          usageInTrash += f.size;
        } else {
          usageInDrive += f.size;
        }
      }
    }

    return {
      quota: {
        limit: this.quotaLimit,
        usage: usageInDrive + usageInTrash,
        usageInDrive,
        usageInTrash,
      },
      user: {
        displayName: this.displayName,
        emailAddress: this.accountEmail,
        photoLink: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(this.accountEmail)}`,
      },
    };
  }

  async listFiles(params: {
    folderId?: string;
    trashed?: boolean;
    pageToken?: string;
    pageSize?: number;
    query?: string;
  }): Promise<ListFilesResult> {
    const targetFolder = params.folderId === 'root' || !params.folderId ? 'root' : params.folderId;
    const isTrashed = params.trashed ?? false;
    const results: DriveFileItem[] = [];

    for (const f of this.files.values()) {
      if (f.id === 'root') continue;
      if (f.trashed !== isTrashed) continue;

      if (!isTrashed && targetFolder) {
        const parents = f.parents || ['root'];
        if (!parents.includes(targetFolder)) continue;
      }

      if (params.query) {
        const q = params.query.toLowerCase();
        if (!f.name.toLowerCase().includes(q)) continue;
      }

      results.push(this.stripContent(f));
    }

    // Folders first, then alphabetically
    results.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });

    return {
      files: results,
      nextPageToken: null,
    };
  }

  async getFile(fileId: string): Promise<DriveFileItem> {
    const f = this.files.get(fileId);
    if (!f) throw new Error(`File ${fileId} not found`);
    return this.stripContent(f);
  }

  async createFolder(name: string, parentId = 'root'): Promise<DriveFileItem> {
    const id = `fld_${this.idCounter++}`;
    const f = this.createFolderInternal(id, name, parentId);
    return this.stripContent(f);
  }

  async renameFile(fileId: string, newName: string): Promise<DriveFileItem> {
    const f = this.files.get(fileId);
    if (!f) throw new Error(`File ${fileId} not found`);
    f.name = newName;
    f.modifiedTime = new Date().toISOString();
    return this.stripContent(f);
  }

  async trashFile(fileId: string): Promise<DriveFileItem> {
    const f = this.files.get(fileId);
    if (!f) throw new Error(`File ${fileId} not found`);
    f.trashed = true;
    f.modifiedTime = new Date().toISOString();
    return this.stripContent(f);
  }

  async restoreFile(fileId: string): Promise<DriveFileItem> {
    const f = this.files.get(fileId);
    if (!f) throw new Error(`File ${fileId} not found`);
    f.trashed = false;
    f.modifiedTime = new Date().toISOString();
    return this.stripContent(f);
  }

  async deletePermanently(fileId: string): Promise<void> {
    this.files.delete(fileId);
  }

  async moveFile(fileId: string, newParentId: string, oldParentId?: string): Promise<DriveFileItem> {
    const f = this.files.get(fileId);
    if (!f) throw new Error(`File ${fileId} not found`);
    f.parents = [newParentId];
    f.modifiedTime = new Date().toISOString();
    return this.stripContent(f);
  }

  async copyFile(fileId: string, newParentId: string, newName?: string): Promise<DriveFileItem> {
    const src = this.files.get(fileId);
    if (!src) throw new Error(`File ${fileId} not found`);

    const copyName = newName || `Copy of ${src.name}`;
    const copy = this.createFileInternal({
      name: copyName,
      mimeType: src.mimeType,
      content: Buffer.from(src.content),
      parentId: newParentId,
      size: src.size ?? undefined,
    });
    return this.stripContent(copy);
  }

  async createResumableUploadSession(params: {
    fileName: string;
    mimeType: string;
    parentId?: string;
    size: number;
  }): Promise<ResumableSessionResult> {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.uploadSessions.set(uploadId, {
      fileId: `file_${this.idCounter++}`,
      fileName: params.fileName,
      mimeType: params.mimeType,
      parentId: params.parentId || 'root',
      totalSize: params.size,
      receivedBytes: 0,
      chunks: [],
    });
    return {
      sessionUri: uploadId,
    };
  }

  async uploadChunk(sessionUri: string, chunk: Buffer, contentRange: string): Promise<UploadChunkResult> {
    const session = this.uploadSessions.get(sessionUri);
    if (!session) throw new Error(`Upload session not found`);

    session.chunks.push(chunk);
    session.receivedBytes += chunk.length;

    // Check if finished according to Content-Range (e.g. bytes 0-1023/1024 or size reached)
    const isDone = session.receivedBytes >= session.totalSize;

    if (isDone) {
      const fullContent = Buffer.concat(session.chunks);
      const created = this.createFileInternal({
        id: session.fileId,
        name: session.fileName,
        mimeType: session.mimeType,
        content: fullContent,
        parentId: session.parentId,
        size: BigInt(fullContent.length),
      });
      this.uploadSessions.delete(sessionUri);
      return {
        done: true,
        bytesReceived: session.receivedBytes,
        file: this.stripContent(created),
      };
    }

    return {
      done: false,
      bytesReceived: session.receivedBytes,
    };
  }

  async downloadStream(fileId: string, range?: string): Promise<DownloadStreamResult> {
    const f = this.files.get(fileId);
    if (!f) throw new Error(`File ${fileId} not found`);

    let buffer = f.content;
    let contentRange: string | undefined;

    if (range && range.startsWith('bytes=')) {
      const parts = range.replace('bytes=', '').split('-');
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : buffer.length - 1;
      const clampedEnd = Math.min(end, buffer.length - 1);

      buffer = buffer.subarray(start, clampedEnd + 1);
      contentRange = `bytes ${start}-${clampedEnd}/${f.content.length}`;
    }

    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    return {
      stream,
      contentLength: buffer.length,
      contentType: f.mimeType,
      contentRange,
      filename: f.name,
      headRevisionId: f.headRevisionId || undefined,
      md5Checksum: f.md5Checksum || undefined,
    };
  }

  async exportDocument(fileId: string, exportMimeType: string): Promise<{ stream: Readable; contentType: string }> {
    const f = this.files.get(fileId);
    if (!f) throw new Error(`File ${fileId} not found`);

    const text = `Exported content of ${f.name} in ${exportMimeType} format.`;
    const stream = new Readable();
    stream.push(Buffer.from(text));
    stream.push(null);

    return {
      stream,
      contentType: exportMimeType,
    };
  }

  async updateFileContent(fileId: string, content: Buffer, ifMatchHeadRevision?: string): Promise<DriveFileItem> {
    const f = this.files.get(fileId);
    if (!f) throw new Error(`File ${fileId} not found`);

    // Concurrency conflict check
    if (ifMatchHeadRevision && f.headRevisionId && ifMatchHeadRevision !== f.headRevisionId) {
      const error: any = new Error('Remote file revision conflict: file has been modified elsewhere.');
      error.statusCode = 409;
      error.currentHeadRevision = f.headRevisionId;
      throw error;
    }

    f.content = content;
    f.size = BigInt(content.length);
    f.revisionCounter++;
    f.headRevisionId = `rev_${fileId}_${f.revisionCounter}`;
    f.modifiedTime = new Date().toISOString();

    return this.stripContent(f);
  }

  private stripContent(f: StoredFile): DriveFileItem {
    const { content, revisionCounter, ...rest } = f;
    return rest;
  }
}
