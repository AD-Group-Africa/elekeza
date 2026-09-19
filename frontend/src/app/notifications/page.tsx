'use client';
import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

interface Notif { id: number; type: string; title: string; body: string; read: boolean; createdAt: string; }

const TYPE_ICON: Record<string, string> = {
  QUIZ_COMPLETED: '🏆', LESSON_ASSIGNED: '📚', PROGRESS_REPORT: '📊'
};

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/notifications')
      .then(r => setNotifs(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id: number) => {
    await api.post(`/notifications/${id}/read`).catch(() => {});
    setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x));
  };

  const markAll = async () => {
    await api.post('/notifications/read-all').catch(() => {});
    setNotifs(n => n.map(x => ({ ...x, read: true })));
  };

  const unread = notifs.filter(n => !n.read).length;

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Notifications</h1>
            {unread > 0 && <p className="text-blue-200 text-sm mt-1">{unread} unread</p>}
          </div>
          {unread > 0 && (
            <button onClick={markAll} className="btn-outline text-sm bg-white/10 border-white/30 text-white hover:bg-white/20">
              Mark all read
            </button>
          )}
        </div>

        {loading && <p className="text-white text-center mt-20 animate-pulse">Loading…</p>}

        {!loading && notifs.length === 0 && (
          <div className="card text-center py-16">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-gray-600 text-lg">No notifications yet</p>
            <p className="text-purple-200 text-sm mt-2">You&apos;ll see quiz results and lesson updates here</p>
          </div>
        )}

        <div className="space-y-3">
          {notifs.map(n => (
            <div key={n.id} role="button" tabIndex={0}
              onClick={() => markRead(n.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); markRead(n.id); } }}
              aria-label={n.read ? `Notification: ${n.title}` : `Mark as read: ${n.title}`}
              className={`card cursor-pointer flex items-start gap-4 transition hover:shadow-lg ${!n.read ? 'border-l-4 border-purple-500' : 'opacity-75'}`}>
              <span className="text-2xl flex-shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? '🔔'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">{n.title}</p>
                <p className="text-purple-300 text-sm mt-0.5">{n.body}</p>
                <p className="text-gray-300 text-xs mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              {!n.read && <span className="w-2.5 h-2.5 bg-purple-500 rounded-full mt-2 flex-shrink-0"/>}
            </div>
          ))}
        </div>
      </div>
    </SidebarLayout>
  );
}


