'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { notificationKeys, notificationsApi, safeLink } from '../api';

const POLL_MS = 30_000;

/** Unread-notification bell with a dropdown; polls every 30s while visible. */
export default function NotificationBell() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: items = [] } = useQuery({
    queryKey: notificationKeys.unread,
    queryFn: notificationsApi.unread,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const count = items.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-purple-200 transition hover:bg-white/10"
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={20} aria-hidden="true" />
        {count > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
            aria-hidden="true"
          >
            {count}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 max-h-96 w-80 overflow-auto rounded-xl border border-line bg-surface p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-purple-200">Notifications</p>
            <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs text-purple-300 underline">
              See all
            </Link>
          </div>
          {count === 0 ? (
            <p className="py-2 text-sm text-purple-300">No new notifications.</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      markRead.mutate(n.id);
                      const href = safeLink(n.link);
                      if (href) {
                        setOpen(false);
                        router.push(href);
                      }
                    }}
                    title={safeLink(n.link) ? 'Open' : 'Mark as read'}
                    className="block w-full rounded-lg p-2 text-left transition hover:bg-white/10"
                  >
                    <span className="block text-sm font-medium text-purple-100">{n.title}</span>
                    <span className="mt-0.5 block text-xs text-purple-300">{n.body}</span>
                    {n.createdAt && (
                      <span className="mt-1 block text-[10px] text-purple-400">{formatDateTime(n.createdAt)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
