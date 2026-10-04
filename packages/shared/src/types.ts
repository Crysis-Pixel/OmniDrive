export type AccountStatus = 'active' | 'needs_reauth' | 'disabled';

export type UploadPlacementStrategy = 'manual' | 'most_free' | 'fill_first';

export type TransferType = 'copy' | 'move';

export type TransferStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export type CollisionPolicy = 'keep_both' | 'replace' | 'skip';

export interface UserDTO {
  id: string;
  email: string;
  createdAt: string;
  settings?: UserSettingsDTO | null;
}

export interface UserSettingsDTO {
  userId: string;
  uploadStrategy: UploadPlacementStrategy;
  accountPriority: string[];
}

export interface LinkedAccountDTO {
  id: string;
  userId: string;
  googleId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  label: string | null;
  scopes: string[];
  status: AccountStatus;
  lastSyncAt: string | null;
  quotaLimit: string | null; // serialized BigInt
  quotaUsage: string | null;
  quotaUsageInDrive: string | null;
  quotaUsageInTrash: string | null;
  freeBytes?: string | null;
  percentUsed?: number;
}

export interface FileNodeDTO {
  id: string; // composite id: "<accountId>:<driveId>"
  accountId: string;
  driveId: string;
  parentDriveId: string | null;
  name: string;
  mimeType: string;
  size: string | null; // serialized BigInt (null for folders/google docs)
  md5: string | null;
  modifiedTime: string;
  trashed: boolean;
  isFolder: boolean;
  shortcutTarget: string | null;
  headRevisionId: string | null;
  thumbnailLink: string | null;
  webViewLink: string | null;
  syncedAt: string;
  accountEmail?: string;
  accountLabel?: string;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
  accountId?: string;
}

export interface NodeListingResponse {
  parent: FileNodeDTO | null;
  breadcrumbs: BreadcrumbItem[];
  items: FileNodeDTO[];
  nextPageToken?: string | null;
  isRoot?: boolean;
}

export interface StorageAccountBreakdown {
  accountId: string;
  email: string;
  label: string | null;
  status: AccountStatus;
  limit: number;
  usage: number;
  usageInDrive: number;
  usageInTrash: number;
  free: number;
  percentUsed: number;
}

export interface StorageSummaryResponse {
  totalLimit: number;
  totalUsage: number;
  totalUsageInDrive: number;
  totalUsageInTrash: number;
  totalFree: number;
  totalPercentUsed: number;
  accounts: StorageAccountBreakdown[];
}

export interface TransferJobDTO {
  id: string;
  userId: string;
  type: TransferType;
  srcAccount: string;
  srcDriveId: string;
  srcName?: string;
  dstAccount: string;
  dstParentId: string;
  status: TransferStatus;
  bytesTotal: string | null;
  bytesDone: string;
  percentDone?: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadSessionInitResponse {
  uploadId: string;
  accountId: string;
  sessionUri?: string;
  targetFileName: string;
  targetFolderId: string;
  strategyUsed: UploadPlacementStrategy;
  chunkSize: number;
}

export interface UploadStatusResponse {
  uploadId: string;
  bytesReceived: number;
  totalBytes: number;
  status: 'uploading' | 'completed' | 'failed' | 'aborted';
  fileNode?: FileNodeDTO;
}

export interface SSEEventData {
  type: 'transfer_progress' | 'transfer_completed' | 'transfer_failed' | 'sync_progress' | 'sync_completed' | 'account_updated';
  payload: any;
}
