'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/notifications')
      .then(res => setNotifs(res.data))
      .catch(() => {});
  }, []);

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Notifications</h1>
      </div>
      <div className="space-y-3">
        {notifs.map(n => (
          <div key={n.id} className={`card flex justify-between ${!n.read ? 'border-l-4 border-purple-500' : ''}`}>
            <span className="text-gray-700">{n.message}</span>
            {!n.read && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">New</span>}
          </div>
        ))}
      </div>
    </SidebarLayout>
  );
}
