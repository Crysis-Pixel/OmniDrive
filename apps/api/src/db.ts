import { PrismaClient } from '@prisma/client';
import { config } from './config';

// Primary Prisma Client for PostgreSQL (Used on Render & Production)
export const prisma = new PrismaClient({
  log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// In-Memory Database store for tests and zero-setup local development
class MemoryStore {
  private _users = new Map<string, any>();
  private _userSettings = new Map<string, any>();
  private _linkedAccounts = new Map<string, any>();
  private _fileNodes = new Map<string, any>();
  private _transferJobs = new Map<string, any>();

  private idCounter = 1;

  private nextId(prefix: string) {
    return `${prefix}_${Date.now()}_${this.idCounter++}`;
  }

  user = {
    findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
      for (const u of this._users.values()) {
        if (where.id && u.id === where.id) return { ...u };
        if (where.email && u.email.toLowerCase() === where.email.toLowerCase()) return { ...u };
      }
      return null;
    },
    create: async ({ data }: { data: any }) => {
      const id = data.id || this.nextId('usr');
      const record = {
        id,
        email: data.email,
        passwordHash: data.passwordHash || null,
        createdAt: new Date(),
      };
      this._users.set(id, record);

      if (data.settings?.create) {
        await this.userSettings.upsert({
          where: { userId: id },
          create: { ...data.settings.create, userId: id },
          update: data.settings.create,
        });
      }
      return { ...record };
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const u = this._users.get(where.id);
      if (!u) throw new Error('User not found');
      const updated = { ...u, ...data };
      this._users.set(where.id, updated);
      return { ...updated };
    },
  };

  userSettings = {
    findUnique: async ({ where }: { where: { userId: string } }) => {
      const s = this._userSettings.get(where.userId);
      return s ? { ...s } : null;
    },
    upsert: async ({ where, create, update }: { where: { userId: string }; create: any; update: any }) => {
      const existing = this._userSettings.get(where.userId);
      if (existing) {
        const updated = { ...existing, ...update };
        this._userSettings.set(where.userId, updated);
        return { ...updated };
      } else {
        const record = {
          userId: where.userId,
          uploadStrategy: create.uploadStrategy || 'most_free',
          accountPriority: create.accountPriority || [],
        };
        this._userSettings.set(where.userId, record);
        return { ...record };
      }
    },
  };

  linkedAccount = {
    findMany: async ({ where }: { where?: { userId?: string; status?: string } } = {}) => {
      const results: any[] = [];
      for (const a of this._linkedAccounts.values()) {
        if (where?.userId && a.userId !== where.userId) continue;
        if (where?.status && a.status !== where.status) continue;
        results.push({ ...a });
      }
      return results;
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const a = this._linkedAccounts.get(where.id);
      return a ? { ...a } : null;
    },
    findFirst: async ({ where }: { where: { userId?: string; googleId?: string; id?: string } }) => {
      for (const a of this._linkedAccounts.values()) {
        if (where.id && a.id !== where.id) continue;
        if (where.userId && a.userId !== where.userId) continue;
        if (where.googleId && a.googleId !== where.googleId) continue;
        return { ...a };
      }
      return null;
    },
    create: async ({ data }: { data: any }) => {
      const id = data.id || this.nextId('acc');
      const record = {
        id,
        userId: data.userId,
        googleId: data.googleId,
        email: data.email,
        displayName: data.displayName || null,
        avatarUrl: data.avatarUrl || null,
        label: data.label || null,
        refreshTokenEnc: data.refreshTokenEnc,
        refreshTokenIv: data.refreshTokenIv,
        refreshTokenTag: data.refreshTokenTag,
        scopes: data.scopes || [],
        status: data.status || 'active',
        changesPageToken: data.changesPageToken || null,
        lastSyncAt: data.lastSyncAt || new Date(),
        quotaLimit: data.quotaLimit !== undefined ? BigInt(data.quotaLimit) : null,
        quotaUsage: data.quotaUsage !== undefined ? BigInt(data.quotaUsage) : null,
        quotaUsageInDrive: data.quotaUsageInDrive !== undefined ? BigInt(data.quotaUsageInDrive) : null,
        quotaUsageInTrash: data.quotaUsageInTrash !== undefined ? BigInt(data.quotaUsageInTrash) : null,
      };
      this._linkedAccounts.set(id, record);
      return { ...record };
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const a = this._linkedAccounts.get(where.id);
      if (!a) throw new Error('Account not found');
      const updated = { ...a, ...data };
      if (data.quotaLimit !== undefined) updated.quotaLimit = data.quotaLimit !== null ? BigInt(data.quotaLimit) : null;
      if (data.quotaUsage !== undefined) updated.quotaUsage = data.quotaUsage !== null ? BigInt(data.quotaUsage) : null;
      if (data.quotaUsageInDrive !== undefined) updated.quotaUsageInDrive = data.quotaUsageInDrive !== null ? BigInt(data.quotaUsageInDrive) : null;
      if (data.quotaUsageInTrash !== undefined) updated.quotaUsageInTrash = data.quotaUsageInTrash !== null ? BigInt(data.quotaUsageInTrash) : null;
      this._linkedAccounts.set(where.id, updated);
      return { ...updated };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const a = this._linkedAccounts.get(where.id);
      this._linkedAccounts.delete(where.id);
      // Cascade delete files
      for (const [key, node] of this._fileNodes.entries()) {
        if (node.accountId === where.id) {
          this._fileNodes.delete(key);
        }
      }
      return a;
    },
  };

  fileNode = {
    findMany: async ({ where, orderBy }: { where?: any; orderBy?: any } = {}) => {
      let results: any[] = [];
      for (const f of this._fileNodes.values()) {
        if (where?.accountId) {
          if (typeof where.accountId === 'object' && Array.isArray(where.accountId.in)) {
            if (!where.accountId.in.includes(f.accountId)) continue;
          } else if (f.accountId !== where.accountId) {
            continue;
          }
        }
        if (where?.parentDriveId !== undefined && f.parentDriveId !== where.parentDriveId) continue;
        if (where?.trashed !== undefined && f.trashed !== where.trashed) continue;
        if (where?.isFolder !== undefined && f.isFolder !== where.isFolder) continue;
        if (where?.name && typeof where.name.contains === 'string') {
          if (!f.name.toLowerCase().includes(where.name.contains.toLowerCase())) continue;
        }
        results.push({ ...f });
      }

      if (orderBy?.modifiedTime) {
        results.sort((a, b) => {
          const diff = new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime();
          return orderBy.modifiedTime === 'desc' ? diff : -diff;
        });
      } else {
        // Default sort: folders first, then alphabetically
        results.sort((a, b) => {
          if (a.isFolder && !b.isFolder) return -1;
          if (!a.isFolder && b.isFolder) return 1;
          return a.name.localeCompare(b.name);
        });
      }
      return results;
    },
    findUnique: async ({ where }: { where: { id?: string; accountId_driveId?: { accountId: string; driveId: string } } }) => {
      if (where.id) {
        return this._fileNodes.get(where.id) || null;
      }
      if (where.accountId_driveId) {
        const key = `${where.accountId_driveId.accountId}:${where.accountId_driveId.driveId}`;
        for (const f of this._fileNodes.values()) {
          if (`${f.accountId}:${f.driveId}` === key) return { ...f };
        }
      }
      return null;
    },
    findFirst: async ({ where }: { where: any }) => {
      for (const f of this._fileNodes.values()) {
        if (where.accountId && f.accountId !== where.accountId) continue;
        if (where.driveId && f.driveId !== where.driveId) continue;
        if (where.parentDriveId !== undefined && f.parentDriveId !== where.parentDriveId) continue;
        if (where.trashed !== undefined && f.trashed !== where.trashed) continue;
        return { ...f };
      }
      return null;
    },
    upsert: async ({ where, create, update }: { where: { accountId_driveId: { accountId: string; driveId: string } }; create: any; update: any }) => {
      const key = `${where.accountId_driveId.accountId}:${where.accountId_driveId.driveId}`;
      let existingNode: any = null;
      for (const f of this._fileNodes.values()) {
        if (`${f.accountId}:${f.driveId}` === key) {
          existingNode = f;
          break;
        }
      }

      if (existingNode) {
        const updated = { ...existingNode, ...update, syncedAt: new Date() };
        if (update.size !== undefined) updated.size = update.size !== null ? BigInt(update.size) : null;
        this._fileNodes.set(existingNode.id, updated);
        return { ...updated };
      } else {
        const id = this.nextId('node');
        const record = {
          id,
          accountId: create.accountId,
          driveId: create.driveId,
          parentDriveId: create.parentDriveId || null,
          name: create.name,
          mimeType: create.mimeType,
          size: create.size !== undefined && create.size !== null ? BigInt(create.size) : null,
          md5: create.md5 || null,
          modifiedTime: new Date(create.modifiedTime || Date.now()),
          trashed: create.trashed || false,
          isFolder: create.isFolder || false,
          shortcutTarget: create.shortcutTarget || null,
          headRevisionId: create.headRevisionId || null,
          thumbnailLink: create.thumbnailLink || null,
          webViewLink: create.webViewLink || null,
          syncedAt: new Date(),
        };
        this._fileNodes.set(id, record);
        return { ...record };
      }
    },
    update: async ({ where, data }: { where: any; data: any }) => {
      let targetId = where.id;
      if (!targetId && where.accountId_driveId) {
        const key = `${where.accountId_driveId.accountId}:${where.accountId_driveId.driveId}`;
        for (const f of this._fileNodes.values()) {
          if (`${f.accountId}:${f.driveId}` === key) {
            targetId = f.id;
            break;
          }
        }
      }
      const f = this._fileNodes.get(targetId);
      if (!f) throw new Error('FileNode not found');
      const updated = { ...f, ...data, syncedAt: new Date() };
      if (data.size !== undefined) updated.size = data.size !== null ? BigInt(data.size) : null;
      this._fileNodes.set(targetId, updated);
      return { ...updated };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const f = this._fileNodes.get(where.id);
      this._fileNodes.delete(where.id);
      return f;
    },
    deleteMany: async ({ where }: { where: any }) => {
      let count = 0;
      for (const [key, node] of this._fileNodes.entries()) {
        if (where.accountId && node.accountId !== where.accountId) continue;
        if (where.trashed !== undefined && node.trashed !== where.trashed) continue;
        this._fileNodes.delete(key);
        count++;
      }
      return { count };
    },
  };

  transferJob = {
    findMany: async ({ where }: { where?: any; orderBy?: any } = {}) => {
      const results: any[] = [];
      for (const j of this._transferJobs.values()) {
        if (where?.userId && j.userId !== where.userId) continue;
        if (where?.status && j.status !== where.status) continue;
        results.push({ ...j });
      }
      results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return results;
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const j = this._transferJobs.get(where.id);
      return j ? { ...j } : null;
    },
    create: async ({ data }: { data: any }) => {
      const id = data.id || this.nextId('trf');
      const now = new Date();
      const record = {
        id,
        userId: data.userId,
        type: data.type,
        srcAccount: data.srcAccount,
        srcDriveId: data.srcDriveId,
        dstAccount: data.dstAccount,
        dstParentId: data.dstParentId,
        status: data.status || 'queued',
        bytesTotal: data.bytesTotal !== undefined && data.bytesTotal !== null ? BigInt(data.bytesTotal) : null,
        bytesDone: data.bytesDone !== undefined ? BigInt(data.bytesDone) : BigInt(0),
        error: data.error || null,
        createdAt: now,
        updatedAt: now,
      };
      this._transferJobs.set(id, record);
      return { ...record };
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const j = this._transferJobs.get(where.id);
      if (!j) throw new Error('TransferJob not found');
      const updated = { ...j, ...data, updatedAt: new Date() };
      if (data.bytesTotal !== undefined) updated.bytesTotal = data.bytesTotal !== null ? BigInt(data.bytesTotal) : null;
      if (data.bytesDone !== undefined) updated.bytesDone = BigInt(data.bytesDone);
      this._transferJobs.set(where.id, updated);
      return { ...updated };
    },
  };
}

// Global Memory Store instance
export const memoryStore = new MemoryStore();

let isPostgresAvailable = false;
let checkDone = false;

export async function checkDatabaseConnection(): Promise<boolean> {
  if (checkDone) return isPostgresAvailable;
  try {
    // Quick test query
    await prisma.$queryRaw`SELECT 1`;
    isPostgresAvailable = true;
  } catch (err) {
    isPostgresAvailable = false;
  } finally {
    checkDone = true;
  }
  return isPostgresAvailable;
}

/**
 * Universal DB client: Uses real PostgreSQL Prisma if connected,
 * otherwise falls back seamlessly to in-memory store.
 */
export const db: any = new Proxy(
  {},
  {
    get(_target, prop: string) {
      if (prop === 'isPostgres') return isPostgresAvailable;
      if (prop === 'checkConnection') return checkDatabaseConnection;

      return new Proxy(
        {},
        {
          get(_targetModel, method: string) {
            return async (...args: any[]) => {
              if (isPostgresAvailable) {
                try {
                  return await (prisma as any)[prop][method](...args);
                } catch (err: any) {
                  // If postgres fails mid-flight, fallback
                  return await (memoryStore as any)[prop][method](...args);
                }
              }
              return await (memoryStore as any)[prop][method](...args);
            };
          },
        }
      );
    },
  }
);
