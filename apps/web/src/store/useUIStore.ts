import { create } from 'zustand';
import { FileNodeDTO } from '@omnidrive/shared';

export type ViewMode = 'grid' | 'list';
export type ModalType = 'newFolder' | 'move' | 'copy' | 'rename' | 'linkAccount' | null;

interface UIState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  selectedNodeIds: string[];
  selectNode: (id: string, multi?: boolean) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;

  activeViewerNode: FileNodeDTO | null;
  setActiveViewerNode: (node: FileNodeDTO | null) => void;

  activeContextMenu: { x: number; y: number; node: FileNodeDTO } | null;
  setContextMenu: (menu: { x: number; y: number; node: FileNodeDTO } | null) => void;

  activeModal: ModalType;
  modalTargetNode: FileNodeDTO | null;
  openModal: (type: ModalType, targetNode?: FileNodeDTO | null) => void;
  closeModal: () => void;

  isTransfersOpen: boolean;
  setTransfersOpen: (open: boolean) => void;

  isDetailsOpen: boolean;
  setDetailsOpen: (open: boolean) => void;
  toggleDetails: () => void;

  selectedFileForDetails: FileNodeDTO | null;
  setSelectedFileForDetails: (node: FileNodeDTO | null) => void;

  // Search input and filters
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchType: string;
  setSearchType: (type: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  viewMode: 'grid',
  setViewMode: (viewMode) => set({ viewMode }),

  selectedNodeIds: [],
  selectNode: (id, multi = false) => {
    set((state) => {
      if (multi) {
        const exists = state.selectedNodeIds.includes(id);
        const next = exists
          ? state.selectedNodeIds.filter((item) => item !== id)
          : [...state.selectedNodeIds, id];
        return { selectedNodeIds: next };
      }
      return { selectedNodeIds: [id] };
    });
  },
  selectAll: (ids) => set({ selectedNodeIds: ids }),
  clearSelection: () => set({ selectedNodeIds: [] }),

  activeViewerNode: null,
  setActiveViewerNode: (activeViewerNode) => set({ activeViewerNode }),

  activeContextMenu: null,
  setContextMenu: (activeContextMenu) => set({ activeContextMenu }),

  activeModal: null,
  modalTargetNode: null,
  openModal: (activeModal, modalTargetNode = null) => set({ activeModal, modalTargetNode }),
  closeModal: () => set({ activeModal: null, modalTargetNode: null }),

  isTransfersOpen: false,
  setTransfersOpen: (isTransfersOpen) => set({ isTransfersOpen }),

  isDetailsOpen: false,
  setDetailsOpen: (isDetailsOpen) => set({ isDetailsOpen }),
  toggleDetails: () => set((state) => ({ isDetailsOpen: !state.isDetailsOpen })),

  selectedFileForDetails: null,
  setSelectedFileForDetails: (node) => set({ selectedFileForDetails: node, isDetailsOpen: !!node }),

  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  searchType: 'all',
  setSearchType: (searchType) => set({ searchType }),
}));
