import { apiClient } from '@/lib/api';

export interface Notification {
  id: number;
  type?: string;
  title: string;
  body: string;
  read?: boolean;
  createdAt?: string;
}

export const notificationsApi = {
  list: () => apiClient.get<Notification[]>('/notifications').then((r) => (Array.isArray(r.data) ? r.data : [])),
  unread: () =>
    apiClient.get<Notification[]>('/notifications/unread').then((r) => (Array.isArray(r.data) ? r.data : [])),
  markRead: (id: number) => apiClient.post(`/notifications/${id}/read`),
  markAllRead: () => apiClient.post('/notifications/read-all'),
};

export const notificationKeys = {
  all: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
  unread: ['notifications', 'unread'] as const,
};
