import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'admin' | 'manager' | 'annotator' | 'reviewer' | 'observer';

export interface AuthUser {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (user: AuthUser, access: string, refresh: string) => void;
  setUser: (user: AuthUser) => void;
  setTokens: (access: string, refresh: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: (user, access, refresh) =>
        set({ user, accessToken: access, refreshToken: refresh }),
      setUser: (user) => set({ user }),
      setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'annotra.auth' },
  ),
);
