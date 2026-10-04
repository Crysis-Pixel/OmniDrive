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
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  error: null,

  checkAuth: async () => {
    try {
      set({ isLoading: true, error: null });
      const { user } = await api.auth.me();
      set({ user, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  login: async (input: LoginInput) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = await api.auth.login(input);
      set({ user, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  register: async (input: RegisterInput) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = await api.auth.register(input);
      set({ user, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await api.auth.logout();
    set({ user: null });
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
