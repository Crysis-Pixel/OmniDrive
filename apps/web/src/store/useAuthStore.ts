import { create } from 'zustand';
import { UserDTO, RegisterInput, LoginInput, UpdateSettingsInput } from '@omnidrive/shared';
import { api } from '../api/endpoints';

interface AuthState {
  user: UserDTO | null;
  isLoading: boolean;
  error: string | null;
  checkAuth: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  updateSettings: (input: UpdateSettingsInput) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  error: null,

  clearError: () => set({ error: null }),

  checkAuth: async () => {
    try {
      set({ isLoading: true, error: null });
      const { user } = await api.auth.me();
      set({ user, isLoading: false });
    } catch {
      localStorage.removeItem('omnidrive_token');
      set({ user: null, isLoading: false });
    }
  },

  login: async (input: LoginInput) => {
    set({ isLoading: true, error: null });
    try {
      const { user, token } = await api.auth.login(input);
      if (token) {
        localStorage.setItem('omnidrive_token', token);
      }
      set({ user, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  register: async (input: RegisterInput) => {
    set({ isLoading: true, error: null });
    try {
      const { user, token } = await api.auth.register(input);
      if (token) {
        localStorage.setItem('omnidrive_token', token);
      }
      set({ user, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.auth.logout();
    } finally {
      localStorage.removeItem('omnidrive_token');
      set({ user: null });
    }
  },

  updateSettings: async (input: UpdateSettingsInput) => {
    const { settings } = await api.auth.updateSettings(input);
    const currentUser = get().user;
    if (currentUser) {
      set({
        user: {
          ...currentUser,
          settings,
        },
      });
    }
  },
}));
