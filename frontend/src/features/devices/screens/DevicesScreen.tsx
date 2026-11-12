'use client';

/**
 * Device registry — the school's learning tablets/phones. Register a device
 * by its code, activate it, assign it to a learner, mark it lost or revoke it.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tablet } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  Select,
  TextInput,
} from '@/components/ui';
import { useStudents } from '@/features/teacher/api';
import { getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { deviceKeys, devicesApi, type Device, type DeviceStatus } from '../api';

const STATUS_TONE = { PENDING: 'warning', ACTIVE: 'success', LOST: 'danger', REVOKED: 'neutral' } as const;
const STATUS_LABEL: Record<DeviceStatus, string> = {
  PENDING: 'Waiting to activate',
  ACTIVE: 'Active',
  LOST: 'Lost',
  REVOKED: 'Revoked',
};

function DeviceRow({
  device,
  learners,
  notify,
}: {
  device: Device;
  learners: Array<{ id: number; name: string }>;
  notify: (ok: boolean, text: string) => void;
}) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: deviceKeys.list });
  const status = useMutation({
    mutationFn: (s: DeviceStatus) => devicesApi.setStatus(device.id, s),
    onSuccess: async (_d, s) => {
      notify(true, `${device.deviceCode}: ${STATUS_LABEL[s]}.`);
      await refresh();
    },
    onError: (e) => notify(false, getErrorMessage(e, 'Could not change the status.')),
  });
  const assign = useMutation({
    mutationFn: (learnerId: number) => devicesApi.assign(device.id, learnerId),
    onSuccess: async () => {
      notify(true, `${device.deviceCode} assigned.`);
      await refresh();
    },
    onError: (e) => notify(false, getErrorMessage(e, 'Could not assign the device.')),
  });
  const holder = learners.find((l) => l.id === device.assignedLearnerId);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/5 p-3">
      <div>
        <p className="font-mono text-sm text-purple-100">{device.deviceCode}</p>
        <p className="text-xs text-purple-300">
          {device.label ?? 'No label'} · {holder ? `with ${holder.name}` : 'not assigned'}
          {device.lastSeenAt ? ` · last seen ${formatDateTime(device.lastSeenAt)}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Badge tone={STATUS_TONE[device.status]}>{STATUS_LABEL[device.status]}</Badge>
        {device.status === 'ACTIVE' && (
          <Select
            aria-label={`Assign ${device.deviceCode} to a learner`}
            value={device.assignedLearnerId ?? ''}
            onChange={(e) => e.target.value && assign.mutate(Number(e.target.value))}
            className="w-48 py-1.5 text-sm"
          >
            <option value="">Assign to…</option>
            {learners.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        )}
        {device.status !== 'ACTIVE' && device.status !== 'REVOKED' && (
          <Button size="sm" variant="success" onClick={() => status.mutate('ACTIVE')}>
            Activate
          </Button>
        )}
        {device.status === 'ACTIVE' && (
          <Button size="sm" variant="secondary" onClick={() => status.mutate('LOST')}>
            Mark lost
          </Button>
        )}
        {device.status !== 'REVOKED' && (
          <Button size="sm" variant="ghost" onClick={() => status.mutate('REVOKED')}>
            Revoke
          </Button>
        )}
      </div>
    </li>
  );
}

export default function DevicesScreen() {
  const queryClient = useQueryClient();
  const devices = useQuery({ queryKey: deviceKeys.list, queryFn: devicesApi.list });
  const students = useStudents();
  const learners = (students.data ?? []).map((s) => ({ id: s.id, name: s.name }));
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const notify = (ok: boolean, text: string) => setMessage({ tone: ok ? 'success' : 'error', text });

  const register = useMutation({
    mutationFn: () => devicesApi.register(code.trim(), label.trim() || undefined),
    onSuccess: async (d) => {
      notify(true, `Device ${d.deviceCode} registered. Activate it when it is handed out.`);
      setCode('');
      setLabel('');
      await queryClient.invalidateQueries({ queryKey: deviceKeys.list });
    },
    onError: (e) => notify(false, getErrorMessage(e, 'Could not register the device.')),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Devices" description="Learning tablets and phones owned by your school." />
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Card title="Register a device">
        <form
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            register.mutate();
          }}
        >
          <Field id="device-code" label="Device code (printed on the device)">
            <TextInput
              id="device-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. TAB-0042"
              required
            />
          </Field>
          <Field id="device-label" label="Label (optional)">
            <TextInput
              id="device-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Grade 4 cart, slot 12"
            />
          </Field>
          <Button type="submit" loading={register.isPending}>
            Register
          </Button>
        </form>
      </Card>
      {devices.isLoading ? (
        <LoadingState />
      ) : (devices.data ?? []).length === 0 ? (
        <EmptyState icon={<Tablet size={48} />} title="No devices registered yet." />
      ) : (
        <Card title={`Registered devices (${devices.data!.length})`}>
          <ul className="space-y-2">
            {devices.data!.map((d) => (
              <DeviceRow key={d.id} device={d} learners={learners} notify={notify} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
