import { api } from './client';

export interface NotificationItem {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  resource_type: string | null;
  resource_id: number | null;
  created_at: string;
}

export const notificationsApi = {
  list: async (onlyUnread = false): Promise<{ unread: number; items: NotificationItem[] }> =>
    (await api.get('/api/notifications', { params: { only_unread: onlyUnread } })).data,
  markRead: async (id: number): Promise<void> =>
    api.post(`/api/notifications/${id}/read`),
  markAllRead: async (): Promise<void> =>
    api.post('/api/notifications/read-all'),
};
