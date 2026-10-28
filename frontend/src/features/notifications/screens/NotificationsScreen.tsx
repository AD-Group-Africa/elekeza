'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, EmptyState, LoadingState, PageHeader } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { notificationKeys, notificationsApi, type Notification } from '../api';

const TYPE_ICON: Record<string, string> = {
  QUIZ_COMPLETED: '🏆',
  LESSON_ASSIGNED: '📚',
  PROGRESS_REPORT: '📊',
};

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: notificationKeys.list,
    queryFn: notificationsApi.list,
  });

  const setRead = (ids: number[] | 'all') =>
    queryClient.setQueryData<Notification[]>(notificationKeys.list, (rows = []) =>
      rows.map((n) => (ids === 'all' || ids.includes(n.id) ? { ...n, read: true } : n)),
    );

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: (_res, id) => {
      setRead([id]);
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unread });
    },
  });
  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      setRead('all');
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unread });
    },
  });

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : undefined}
        actions={
          unread > 0 && (
            <Button variant="secondary" size="sm" onClick={() => markAll.mutate()} loading={markAll.isPending}>
              Mark all read
            </Button>
          )
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<span className="text-5xl">📭</span>}
          title="No notifications yet"
          description="You'll see quiz results and lesson updates here"
        />
      ) : (
        <ul className="space-y-3">
          {notifications.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => !n.read && markRead.mutate(n.id)}
                aria-label={n.read ? `Notification: ${n.title}` : `Mark as read: ${n.title}`}
                className={cn(
                  'glass-card flex w-full items-start gap-4 p-4 text-left transition',
                  !n.read ? 'border-l-4 border-purple-500' : 'opacity-75',
                )}
              >
                <span className="mt-0.5 flex-shrink-0 text-2xl" aria-hidden="true">
                  {TYPE_ICON[n.type ?? ''] ?? '🔔'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-purple-100">{n.title}</span>
                  <span className="mt-0.5 block text-sm text-purple-300">{n.body}</span>
                  {n.createdAt && (
                    <span className="mt-1 block text-xs text-purple-400">{formatDateTime(n.createdAt)}</span>
                  )}
                </span>
                {!n.read && (
                  <span className="mt-2 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-purple-500" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
