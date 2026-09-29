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
  database: { ok: boolean; ping_ms: number; pool: any };
  redis: { ok: boolean; ping_ms: number };
  celery: { workers: number };
  storage: { total_gb: number; used_gb: number; free_gb: number; percent: number };
  uptime_sec: number;
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

  getConfig: async (): Promise<any[]> => (await api.get('/api/admin/config')).data,
  patchConfig: async (updates: any[]): Promise<void> => (await api.patch('/api/admin/config', updates)).data,
  listAllProjects: async (params?: any): Promise<any[]> => (await api.get('/api/admin/projects', { params })).data,
  listAllTasks: async (params?: any): Promise<any[]> => (await api.get('/api/admin/tasks', { params })).data,
  createTask: async (projectId: number, payload: { name: string; task_type: 'image' | 'video'; priority?: string }): Promise<any> => (await api.post(`/api/projects/${projectId}/tasks`, payload)).data,
  assignTask: async (taskId: number, userId: number, role: string): Promise<void> => (await api.post(`/api/admin/tasks/${taskId}/assign`, { user_id: userId, role })).data,
  unassignTask: async (taskId: number, userId: number, role: string): Promise<void> => (await api.delete(`/api/admin/tasks/${taskId}/assign/${userId}?role=${role}`)).data,
  listNotifications: async (): Promise<any[]> => (await api.get('/api/admin/notifications')).data,
  createNotification: async (payload: any): Promise<void> => (await api.post('/api/admin/notifications', payload)).data,
  deleteNotification: async (id: number): Promise<void> => (await api.delete(`/api/admin/notifications/${id}`)).data,
  listUserSessions: async (userId: number): Promise<any[]> => (await api.get(`/api/admin/users/${userId}/sessions`)).data,
  killSession: async (sessionId: number | string): Promise<void> => (await api.delete(`/api/admin/sessions/${sessionId}`)).data,
  impersonate: async (userId: number): Promise<any> => (await api.post(`/api/admin/users/${userId}/impersonate`)).data,
  listApiKeys: async (): Promise<any[]> => (await api.get('/api/admin/api-keys')).data,
  createApiKey: async (name: string, expires_days?: number): Promise<any> => (await api.post('/api/admin/api-keys', { name, expires_days })).data,
  revokeApiKey: async (keyId: string | number): Promise<void> => (await api.delete(`/api/admin/api-keys/${keyId}`)).data,
  analytics: async (...args: any[]): Promise<any> => (await api.get('/api/admin/analytics')).data,
};