import { apiClient } from '@/lib/api';

export type DeviceStatus = 'PENDING' | 'ACTIVE' | 'LOST' | 'REVOKED';

/** GET /api/devices — the school's registered tablets/phones. */
export interface Device {
  id: number;
  deviceCode: string;
  label: string | null;
  status: DeviceStatus;
  assignedLearnerId: number | null;
  lastSeenAt: string | null;
}

export const devicesApi = {
  list: () => apiClient.get<Device[]>('/devices').then((r) => r.data ?? []),
  register: (deviceCode: string, label?: string) =>
    apiClient.post<Device>('/devices', { deviceCode, label }).then((r) => r.data),
  setStatus: (id: number, status: DeviceStatus) =>
    apiClient.patch<Device>(`/devices/${id}/status`, null, { params: { status } }).then((r) => r.data),
  assign: (id: number, learnerId: number) =>
    apiClient.post<Device>(`/devices/${id}/assign/${learnerId}`).then((r) => r.data),
};

export const deviceKeys = { list: ['devices', 'list'] as const };
