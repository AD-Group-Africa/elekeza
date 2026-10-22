'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, Building2, GraduationCap, Users } from 'lucide-react';
import { Card, PageHeader } from '@/components/ui';
import { notificationKeys, notificationsApi } from '@/features/notifications/api';
import { adminApi, adminKeys } from '../api';

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="flex flex-col items-center">
      <span aria-hidden="true" className="mb-2">
        {icon}
      </span>
      <p className="text-sm text-purple-300">{label}</p>
      <p className="text-2xl font-bold text-purple-100">{value}</p>
    </Card>
  );
}

/** Platform-wide overview for ADMIN users. */
export default function PlatformAdminScreen() {
  const overview = useQuery({ queryKey: adminKeys.platformOverview, queryFn: adminApi.platformOverview });
  const schools = useQuery({ queryKey: adminKeys.institutions, queryFn: adminApi.institutions });
  const notifications = useQuery({ queryKey: notificationKeys.list, queryFn: notificationsApi.list });

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Administration" />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Kpi
          icon={<Building2 size={24} className="text-blue-400" />}
          label="Total Schools"
          value={overview.data?.institutions ?? '—'}
        />
        <Kpi
          icon={<Users size={24} className="text-green-400" />}
          label="Total Users"
          value={overview.data?.totalUsers ?? 0}
        />
        <Kpi
          icon={<GraduationCap size={24} className="text-purple-400" />}
          label="Enrolled Learners"
          value={overview.data?.students ?? 0}
        />
      </div>

      <Card title="Schools">
        {(schools.data ?? []).length === 0 ? (
          <p className="text-purple-300">No schools registered yet.</p>
        ) : (
          <ul className="space-y-1 text-purple-200">
            {schools.data!.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={
          <span className="flex items-center gap-2">
            <Bell size={18} aria-hidden="true" /> Notifications
          </span>
        }
      >
        {(notifications.data ?? []).length === 0 ? (
          <p className="text-purple-300">No notifications yet.</p>
        ) : (
          <ul className="space-y-2 text-purple-300">
            {notifications.data!.slice(0, 8).map((n) => (
              <li key={n.id} className="truncate">
                • {n.title || n.body || 'Notification'}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
