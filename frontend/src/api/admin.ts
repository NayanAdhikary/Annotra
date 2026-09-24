import { api } from './client';

export type Role = 'admin' | 'manager' | 'annotator' | 'reviewer' | 'observer';

export interface AdminUser {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  role: Role;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  project_count: number;
  task_count: number;
  annotation_count: number;
  active_sessions: number;
}

export interface SystemStats {
  total_users: number;
  active_users_7d: number;
  total_projects: number;
  total_tasks: number;
  total_images: number;
  total_videos: number;
  total_annotations: number;
  annotations_today: number;
  storage_bytes: number;
  disk_free_bytes: number;
}

export interface AuditEntry {
  id: number;
  user_id: number | null;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  ip_address: string | null;
  meta: Record<string, any>;
  created_at: string;
}

export interface AuditPage { total: number; items: AuditEntry[]; }

export interface HealthReport {
  database: boolean;
  redis: boolean;
  storage_writable: boolean;
  celery_workers: number;
  pending_jobs: number;
  versions: Record<string, string>;
}

export const adminApi = {
  stats: async (): Promise<SystemStats> => (await api.get('/api/admin/stats')).data,

  listUsers: async (params: {
    q?: string; role?: Role; is_active?: boolean; limit?: number; offset?: number;
  } = {}): Promise<AdminUser[]> => (await api.get('/api/admin/users', { params })).data,

  getUser: async (id: number): Promise<AdminUser> =>
    (await api.get(`/api/admin/users/${id}`)).data,

  createUser: async (payload: {
    email: string; username: string; password: string; full_name?: string; role: Role;
  }): Promise<AdminUser> => (await api.post('/api/admin/users', payload)).data,

  updateUser: async (id: number, patch: Partial<{
    full_name: string; role: Role; is_active: boolean;
  }>): Promise<AdminUser> => (await api.patch(`/api/admin/users/${id}`, patch)).data,

  resetPassword: async (id: number, new_password: string): Promise<void> =>
    api.post(`/api/admin/users/${id}/reset-password`, { new_password }),

  revokeSessions: async (id: number): Promise<void> =>
    api.post(`/api/admin/users/${id}/revoke-sessions`),

  deleteUser: async (id: number): Promise<void> =>
    api.delete(`/api/admin/users/${id}`),

  audit: async (params: {
    action?: string; resource_type?: string; user_id?: number;
    since?: string; until?: string; limit?: number; offset?: number;
  } = {}): Promise<AuditPage> => (await api.get('/api/admin/audit', { params })).data,

  health: async (): Promise<HealthReport> => (await api.get('/api/admin/health')).data,
};