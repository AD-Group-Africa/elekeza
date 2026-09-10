'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import { Bell } from 'lucide-react';

interface NotificationItem {
  id: number;
  title: string;
  body: string;
  createdAt?: string;
}

export default function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    api.get('/notifications/unread')
      .then(res => setItems(res.data || []))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const markRead = (id: number) => {
    api.post(`/notifications/${id}/read`).then(load).catch(() => {});
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-purple-200 hover:bg-white/10 transition"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {items.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {items.length}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications"
          className="absolute right-0 mt-2 w-80 rounded-xl border p-3 z-50 max-h-96 overflow-auto shadow-xl"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}>
          <p className="text-sm font-semibold text-purple-200 mb-2">Notifications</p>
          {items.length === 0 ? (
            <p className="text-purple-300 text-sm py-2">No new notifications.</p>
          ) : (
            items.map(n => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                title="Mark as read"
                className="w-full text-left p-2 rounded-lg hover:bg-white/10 transition block"
              >
                <p className="text-sm text-purple-100 font-medium">{n.title}</p>
                <p className="text-xs text-purple-300 mt-0.5">{n.body}</p>
                {n.createdAt && (
                  <p className="text-[10px] text-purple-400 mt-1">
                    {new Date(n.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
