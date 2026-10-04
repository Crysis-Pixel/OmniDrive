import { create } from 'zustand';
import { api } from '../api/endpoints';

export interface UploadItem {
  id: string; // uploadId or local id
  file: File;
  fileName: string;
  fileSize: number;
  mimeType: string;
  parent: string;
  strategy?: string;
  accountId?: string;
  bytesUploaded: number;
  progressPercent: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'paused';
  error?: string;
  uploadId?: string;
  abortController?: AbortController;
}

interface UploadStoreState {
  uploads: UploadItem[];
  addUpload: (file: File, parent: string, strategy?: string, accountId?: string) => Promise<void>;
  cancelUpload: (id: string) => void;
  clearCompleted: () => void;
  isManagerOpen: boolean;
  setManagerOpen: (open: boolean) => void;
}

const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB per spec

export const useUploadStore = create<UploadStoreState>((set, get) => ({
  uploads: [],
  isManagerOpen: false,
  setManagerOpen: (isManagerOpen) => set({ isManagerOpen }),

  addUpload: async (file: File, parent: string, strategy?: string, accountId?: string) => {
    const id = `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newItem: UploadItem = {
      id,
      file,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      parent,
      strategy,
      accountId,
      bytesUploaded: 0,
      progressPercent: 0,
      status: 'pending',
    };

    set((state) => ({
      uploads: [newItem, ...state.uploads],
      isManagerOpen: true,
    }));

    // Start upload asynchronously
    try {
      set((state) => ({
        uploads: state.uploads.map((u) => (u.id === id ? { ...u, status: 'uploading' } : u)),
      }));

      // 1. Initialize session
      const init = await api.uploads.init({
        parent,
        fileName: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        strategy,
        accountId,
      });

      const uploadId = init.uploadId;
      let offset = 0;
      const total = file.size;

      // Special case: 0 byte file
      if (total === 0) {
        await api.uploads.uploadChunk(uploadId, new Blob([]), `bytes 0-0/0`);
        set((state) => ({
          uploads: state.uploads.map((u) =>
            u.id === id ? { ...u, bytesUploaded: 0, progressPercent: 100, status: 'completed' } : u
          ),
        }));
        return;
      }

      // 2. Upload chunks sequentially
      while (offset < total) {
        const item = get().uploads.find((u) => u.id === id);
        if (!item || item.status === 'failed' || item.status === 'paused') {
          break;
        }

        const chunkEnd = Math.min(offset + CHUNK_SIZE, total);
        const chunkBlob = file.slice(offset, chunkEnd);
        const contentRange = `bytes ${offset}-${chunkEnd - 1}/${total}`;

        const chunkRes = await api.uploads.uploadChunk(uploadId, chunkBlob, contentRange);

        offset = chunkEnd;
        const percent = Math.min(100, Math.round((offset / total) * 100));

        set((state) => ({
          uploads: state.uploads.map((u) =>
            u.id === id ? { ...u, bytesUploaded: offset, progressPercent: percent } : u
          ),
        }));

        if (chunkRes.done) {
          set((state) => ({
            uploads: state.uploads.map((u) =>
              u.id === id ? { ...u, bytesUploaded: total, progressPercent: 100, status: 'completed' } : u
            ),
          }));
          break;
        }
      }
    } catch (err: any) {
      set((state) => ({
        uploads: state.uploads.map((u) =>
          u.id === id ? { ...u, status: 'failed', error: err.message || 'Upload failed' } : u
        ),
      }));
    }
  },

  cancelUpload: (id: string) => {
    set((state) => ({
      uploads: state.uploads.filter((u) => u.id !== id),
    }));
  },

  clearCompleted: () => {
    set((state) => ({
      uploads: state.uploads.filter((u) => u.status !== 'completed'),
    }));
  },
}));
