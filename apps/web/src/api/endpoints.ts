import { apiFetch } from './client';
import {
  UserDTO,
  LinkedAccountDTO,
  NodeListingResponse,
  FileNodeDTO,
  StorageSummaryResponse,
  TransferJobDTO,
  UploadSessionInitResponse,
  RegisterInput,
  LoginInput,
  UpdateSettingsInput,
  UpdateAccountInput,
} from '@omnidrive/shared';

export const api = {
  // Auth
  auth: {
    register: (input: RegisterInput) =>
      apiFetch<{ user: UserDTO; token: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    login: (input: LoginInput) =>
      apiFetch<{ user: UserDTO; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    logout: () => apiFetch('/auth/logout', { method: 'POST' }),
    me: () => apiFetch<{ user: UserDTO }>('/auth/me'),
    updateSettings: (input: UpdateSettingsInput) =>
      apiFetch<{ settings: any }>('/auth/settings', {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    getGoogleAuthUrl: () =>
      apiFetch<{ url: string | null; isConfigured: boolean; message?: string }>('/auth/google'),
  },

  // Accounts
  accounts: {
    list: () => apiFetch<{ accounts: LinkedAccountDTO[] }>('/accounts'),
    getConnectUrl: () => apiFetch<{ url: string | null; isConfigured: boolean; message?: string }>('/accounts/connect'),
    addDemoAccount: (email?: string, label?: string) =>
      apiFetch<{ account: LinkedAccountDTO }>('/accounts/demo', {
        method: 'POST',
        body: JSON.stringify({ email, label }),
      }),
    update: (id: string, input: UpdateAccountInput) =>
      apiFetch<{ account: LinkedAccountDTO }>(`/accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    unlink: (id: string) => apiFetch<{ success: boolean }>(`/accounts/${id}`, { method: 'DELETE' }),
    sync: (id: string) => apiFetch<{ success: boolean; result: any }>(`/accounts/${id}/sync`, { method: 'POST' }),
  },

  // Storage
  storage: {
    getSummary: () => apiFetch<StorageSummaryResponse>('/storage/summary'),
  },

  // Nodes (Virtual File System)
  nodes: {
    list: (params?: { parent?: string; pageToken?: string; sort?: string; order?: string }) => {
      const sp = new URLSearchParams();
      if (params?.parent) sp.set('parent', params.parent);
      if (params?.pageToken) sp.set('pageToken', params.pageToken);
      if (params?.sort) sp.set('sort', params.sort);
      if (params?.order) sp.set('order', params.order);
      return apiFetch<NodeListingResponse>(`/nodes?${sp.toString()}`);
    },
    get: (nodeId: string) => apiFetch<{ node: FileNodeDTO }>(`/nodes/${encodeURIComponent(nodeId)}`),
    createFolder: (parent: string, name: string) =>
      apiFetch<{ folder: FileNodeDTO }>('/nodes/folders', {
        method: 'POST',
        body: JSON.stringify({ parent, name }),
      }),
    rename: (nodeId: string, name: string) =>
      apiFetch<{ node: FileNodeDTO }>(`/nodes/${encodeURIComponent(nodeId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      }),
    move: (nodeId: string, destinationParent: string, collisionPolicy = 'keep_both') =>
      apiFetch<{ node?: FileNodeDTO; transferJob?: TransferJobDTO }>(
        `/nodes/${encodeURIComponent(nodeId)}/move`,
        {
          method: 'POST',
          body: JSON.stringify({ destinationParent, collisionPolicy }),
        }
      ),
    copy: (nodeId: string, destinationParent: string, name?: string, collisionPolicy = 'keep_both') =>
      apiFetch<{ node?: FileNodeDTO; transferJob?: TransferJobDTO }>(
        `/nodes/${encodeURIComponent(nodeId)}/copy`,
        {
          method: 'POST',
          body: JSON.stringify({ destinationParent, name, collisionPolicy }),
        }
      ),
    delete: (nodeId: string, permanent = false) =>
      apiFetch<{ success: boolean }>(
        `/nodes/${encodeURIComponent(nodeId)}?permanent=${permanent}`,
        { method: 'DELETE' }
      ),
    restore: (nodeId: string) =>
      apiFetch<{ node: FileNodeDTO }>(`/nodes/${encodeURIComponent(nodeId)}/restore`, {
        method: 'POST',
      }),
    getFileContentText: async (nodeId: string): Promise<string> => {
      const res = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}/content`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to load file content');
      }
      return res.text();
    },
    saveFileContent: async (nodeId: string, text: string, headRevisionId?: string | null): Promise<FileNodeDTO> => {
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain; charset=utf-8',
      };
      if (headRevisionId) {
        headers['If-Match'] = headRevisionId;
      }
      const res = await fetch(`/api/nodes/${encodeURIComponent(nodeId)}/content`, {
        method: 'PUT',
        credentials: 'include',
        headers,
        body: text,
      });

      if (res.status === 409) {
        const errorData = await res.json();
        const err: any = new Error(errorData?.error?.message || 'Revision conflict');
        err.statusCode = 409;
        err.currentHeadRevision = errorData?.error?.currentHeadRevision;
        throw err;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || 'Failed to save file');
      }

      const data = await res.json();
      return data.node;
    },
  },

  // Uploads
  uploads: {
    init: (data: {
      parent: string;
      fileName: string;
      size: number;
      mimeType: string;
      strategy?: string;
      accountId?: string;
    }) =>
      apiFetch<UploadSessionInitResponse>('/uploads', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    uploadChunk: async (
      uploadId: string,
      chunk: Blob,
      contentRange: string
    ): Promise<{ done: boolean; node?: FileNodeDTO; bytesReceived?: number }> => {
      const res = await fetch(`/api/uploads/${uploadId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Range': contentRange,
        },
        body: chunk,
      });

      if (res.status === 200 || res.status === 201) {
        const data = await res.json();
        return { done: true, node: data.node };
      } else if (res.status === 308) {
        const data = await res.json().catch(() => ({}));
        return { done: false, bytesReceived: data.bytesReceived };
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || `Chunk upload failed (${res.status})`);
      }
    },
    getStatus: (uploadId: string) => apiFetch<any>(`/uploads/${uploadId}`),
  },

  // Transfers
  transfers: {
    list: () => apiFetch<{ transfers: TransferJobDTO[] }>('/transfers'),
    get: (id: string) => apiFetch<{ transfer: TransferJobDTO }>(`/transfers/${id}`),
    cancel: (id: string) => apiFetch<{ success: boolean }>(`/transfers/${id}`, { method: 'DELETE' }),
  },

  // Search
  search: {
    query: (params: { q?: string; accounts?: string; type?: string; trashed?: boolean }) => {
      const sp = new URLSearchParams();
      if (params.q) sp.set('q', params.q);
      if (params.accounts) sp.set('accounts', params.accounts);
      if (params.type) sp.set('type', params.type);
      if (params.trashed !== undefined) sp.set('trashed', String(params.trashed));
      return apiFetch<{ items: FileNodeDTO[]; total: number; query?: string }>(`/search?${sp.toString()}`);
    },
  },

  // Trash
  trash: {
    list: () => apiFetch<{ items: FileNodeDTO[] }>('/nodes/trash/list'),
    empty: () => apiFetch<{ success: boolean; count: number }>('/nodes/trash', { method: 'DELETE' }),
  },
};
