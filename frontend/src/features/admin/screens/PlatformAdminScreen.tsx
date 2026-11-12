'use client';

/** Platform console for ADMIN users: overview, audit log, feature flags, system health, waitlist. */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Building2, GraduationCap, Users } from 'lucide-react';
import { Alert, Badge, Button, Card, LoadingState, PageHeader, Select, Switch, Tabs } from '@/components/ui';
import { notificationKeys, notificationsApi } from '@/features/notifications/api';
import { formatDateTime } from '@/lib/format';
import { adminApi, adminKeys } from '../api';

type Tab = 'overview' | 'audit' | 'flags' | 'health' | 'waitlist';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'audit', label: 'Audit log' },
  { key: 'flags', label: 'Feature flags' },
  { key: 'health', label: 'System health' },
  { key: 'waitlist', label: 'Waitlist' },
];
const AUDIT_CATEGORIES = ['', 'AUTH', 'ADMIN', 'CONTENT', 'PAYMENT', 'QUIZ', 'LEARNER', 'DEVICE'];

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

function Overview() {
  const overview = useQuery({ queryKey: adminKeys.platformOverview, queryFn: adminApi.platformOverview });
  const schools = useQuery({ queryKey: adminKeys.institutions, queryFn: adminApi.institutions });
  const notifications = useQuery({ queryKey: notificationKeys.list, queryFn: notificationsApi.list });
  return (
    <div className="space-y-6">
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
                • {n.title || n.body}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AuditLog() {
  const [category, setCategory] = useState('');
  const audit = useQuery({ queryKey: adminKeys.audit(category), queryFn: () => adminApi.audit(category) });
  return (
    <Card
      title="Recent activity"
      actions={
        <Select
          aria-label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-auto py-1.5 text-sm"
        >
          {AUDIT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c || 'All categories'}
            </option>
          ))}
        </Select>
      }
    >
      {audit.isLoading ? (
        <LoadingState />
      ) : audit.isError ? (
        <Alert tone="error">Could not load the audit log.</Alert>
      ) : (audit.data ?? []).length === 0 ? (
        <p className="text-sm text-purple-300">No entries.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-purple-200">
            <thead>
              <tr className="border-b border-white/10 text-left text-purple-300">
                {['When', 'Action', 'Category', 'User', 'Detail', 'Result'].map((h) => (
                  <th key={h} scope="col" className="p-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audit.data!.map((a) => (
                <tr key={a.id} className="border-b border-white/5 align-top">
                  <td className="whitespace-nowrap p-2">{formatDateTime(a.createdAt)}</td>
                  <td className="p-2 font-mono text-xs">{a.action}</td>
                  <td className="p-2">{a.category}</td>
                  <td className="p-2">{a.userId ?? '—'}</td>
                  <td className="max-w-xs break-words p-2 text-xs text-purple-300">{a.detail ?? ''}</td>
                  <td className="p-2">
                    {a.success ? <Badge tone="success">OK</Badge> : <Badge tone="danger">Failed</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function FeatureFlags() {
  const queryClient = useQueryClient();
  const flags = useQuery({ queryKey: adminKeys.flags, queryFn: adminApi.flags });
  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.flags });
  const set = useMutation({
    mutationFn: ({ name, enabled }: { name: string; enabled: boolean }) => adminApi.setFlag(name, enabled),
    onSuccess: refresh,
  });
  const clear = useMutation({ mutationFn: adminApi.clearFlag, onSuccess: refresh });
  const entries = Object.entries(flags.data ?? {}).sort(([a], [b]) => a.localeCompare(b));

  return (
    <Card title="Feature flags">
      <p className="mb-4 text-sm text-purple-300">
        Overrides apply immediately and last until the backend restarts. “Reset” returns a flag to its configured value.
      </p>
      {flags.isLoading ? (
        <LoadingState />
      ) : entries.length === 0 ? (
        <p className="text-sm text-purple-300">No feature flags are configured.</p>
      ) : (
        <ul className="divide-y divide-white/10">
          {entries.map(([name, flag]) => (
            <li key={name} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-mono text-sm text-purple-100">{name}</p>
                {flag.config?.description && <p className="text-xs text-purple-300">{flag.config.description}</p>}
                {flag.runtimeOverride != null && (
                  <Badge tone="warning" className="mt-1">
                    Overridden
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                {flag.runtimeOverride != null && (
                  <Button size="sm" variant="ghost" onClick={() => clear.mutate(name)}>
                    Reset
                  </Button>
                )}
                <Switch label={name} checked={flag.enabled} onChange={(enabled) => set.mutate({ name, enabled })} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SystemHealthPanel() {
  const health = useQuery({ queryKey: adminKeys.health, queryFn: adminApi.health, refetchInterval: 30_000 });
  if (health.isLoading) return <LoadingState />;
  if (!health.data) return <Alert tone="error">Could not reach the health endpoint.</Alert>;
  const h = health.data;
  const circuits = Object.entries(h.circuits ?? {});
  return (
    <div className="space-y-4">
      <Alert tone={h.status === 'HEALTHY' ? 'success' : h.status === 'WARNING' ? 'warning' : 'error'}>
        System status: <strong>{h.status}</strong> · checked {formatDateTime(h.timestamp)}
      </Alert>
      <Card title="Components">
        <ul className="space-y-2 text-sm text-purple-200">
          <li className="flex justify-between">
            <span>Database</span>
            {h.database.healthy ? <Badge tone="success">Healthy</Badge> : <Badge tone="danger">Down</Badge>}
          </li>
          {circuits.map(([name, c]) => (
            <li key={name} className="flex justify-between">
              <span>
                {name} <span className="text-xs text-purple-400">({c.failures} recent failures)</span>
              </span>
              <Badge tone={c.state === 'CLOSED' ? 'success' : c.state === 'OPEN' ? 'danger' : 'warning'}>
                {c.state}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Waitlist() {
  const list = useQuery({ queryKey: adminKeys.waitlist, queryFn: adminApi.waitlist });
  return (
    <Card title={`Waitlist${list.data ? ` (${list.data.total})` : ''}`}>
      {list.isLoading ? (
        <LoadingState />
      ) : (list.data?.data ?? []).length === 0 ? (
        <p className="text-sm text-purple-300">Nobody has joined the waitlist yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-purple-200">
            <thead>
              <tr className="border-b border-white/10 text-left text-purple-300">
                {['Name', 'Email', 'Role', 'School', 'Joined'].map((h) => (
                  <th key={h} scope="col" className="p-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data!.data.map((w) => (
                <tr key={w.id} className="border-b border-white/5">
                  <td className="p-2">{w.name}</td>
                  <td className="p-2">{w.email}</td>
                  <td className="p-2">{w.role}</td>
                  <td className="p-2">{w.school ?? '—'}</td>
                  <td className="whitespace-nowrap p-2">{formatDateTime(w.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function PlatformAdminScreen() {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <div className="space-y-6">
      <PageHeader title="Platform Administration" description="Platform-wide data, configuration and health." />
      <Tabs id="platform" label="Platform sections" tabs={TABS} value={tab} onChange={setTab}>
        {tab === 'overview' && <Overview />}
        {tab === 'audit' && <AuditLog />}
        {tab === 'flags' && <FeatureFlags />}
        {tab === 'health' && <SystemHealthPanel />}
        {tab === 'waitlist' && <Waitlist />}
      </Tabs>
    </div>
  );
}
