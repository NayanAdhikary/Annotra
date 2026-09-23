import { api } from './client';
import type { AuthUser } from '../store/authStore';

export const authApi = {
  register: async (payload: { email: string; username: string; password: string; full_name?: string }) => {
    const { data } = await api.post('/api/auth/register', payload);
    return data;
  },
  login: async (email: string, password: string) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    return data;
  },
  me: async (): Promise<AuthUser> => {
    const { data } = await api.get('/api/auth/me');
    return data;
  },
  logout: async (refresh_token: string) => {
    await api.post('/api/auth/logout', { refresh_token });
  },
};
