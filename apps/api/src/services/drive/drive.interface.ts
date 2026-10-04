import { Readable } from 'stream';

export interface DriveQuota {
  limit: bigint;
  usage: bigint;
  usageInDrive: bigint;
  usageInTrash: bigint;
}

export interface DriveUserInfo {
  displayName: string;
  emailAddress: string;
  photoLink?: string | null;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: bigint | null;
  md5Checksum?: string | null;
  modifiedTime: string;
  trashed: boolean;
  parents?: string[];
  headRevisionId?: string | null;
  thumbnailLink?: string | null;
  webViewLink?: string | null;
  isFolder: boolean;
}

export interface ListFilesResult {
  files: DriveFileItem[];
  nextPageToken?: string | null;
}

export interface ResumableSessionResult {
  sessionUri: string;
  fileId?: string;
}

export interface UploadChunkResult {
  done: boolean;
  bytesReceived: number;
  file?: DriveFileItem;
}

export interface DownloadStreamResult {
  stream: Readable;
  contentLength?: number;
  contentType: string;
  contentRange?: string;
  filename: string;
  headRevisionId?: string;
  md5Checksum?: string;
}

export interface IDriveClient {
  getAbout(): Promise<{ quota: DriveQuota; user: DriveUserInfo }>;
  
  listFiles(params: {
    folderId?: string;
    trashed?: boolean;
    pageToken?: string;
    pageSize?: number;
    query?: string;
  }): Promise<ListFilesResult>;

  getFile(fileId: string): Promise<DriveFileItem>;

  createFolder(name: string, parentId?: string): Promise<DriveFileItem>;

  renameFile(fileId: string, newName: string): Promise<DriveFileItem>;

  trashFile(fileId: string): Promise<DriveFileItem>;

  restoreFile(fileId: string): Promise<DriveFileItem>;

  deletePermanently(fileId: string): Promise<void>;

  moveFile(fileId: string, newParentId: string, oldParentId?: string): Promise<DriveFileItem>;

  copyFile(fileId: string, newParentId: string, newName?: string): Promise<DriveFileItem>;

  createResumableUploadSession(params: {
    fileName: string;
    mimeType: string;
    parentId?: string;
    size: number;
  }): Promise<ResumableSessionResult>;

  uploadChunk(sessionUri: string, chunk: Buffer, contentRange: string): Promise<UploadChunkResult>;

  downloadStream(fileId: string, range?: string): Promise<DownloadStreamResult>;

  exportDocument(fileId: string, exportMimeType: string): Promise<{ stream: Readable; contentType: string }>;

  updateFileContent(fileId: string, content: Buffer, ifMatchHeadRevision?: string): Promise<DriveFileItem>;
}
