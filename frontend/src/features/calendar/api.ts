import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export type DeadlineType = 'EXAM' | 'ASSIGNMENT' | 'APPLICATION' | 'CURRICULUM' | 'SCHOOL_EVENT' | 'OTHER';

/** GET /api/deadlines — school dates visible to the signed-in user. */
export interface Deadline {
  id: number;
  title: string;
  deadlineType: DeadlineType;
  scope: 'NATIONAL' | 'REGIONAL' | 'INSTITUTION' | 'CLASS' | 'INDIVIDUAL';
  dueAt: string;
  description: string | null;
  createdBy: number;
}

export const DEADLINE_TYPE_LABEL: Record<DeadlineType, string> = {
  EXAM: 'Exam',
  ASSIGNMENT: 'Assignment due',
  APPLICATION: 'Application',
  CURRICULUM: 'Curriculum',
  SCHOOL_EVENT: 'School event',
  OTHER: 'Other',
};

export const calendarApi = {
  list: () => apiClient.get<Deadline[]>('/deadlines').then((r) => r.data ?? []),
  create: (input: { title: string; deadlineType: DeadlineType; dueAt: string; description?: string }) =>
    apiClient.post<Deadline>('/deadlines', { ...input, scope: 'INSTITUTION' }).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`/deadlines/${id}`),
};

export const calendarKeys = { list: ['calendar', 'deadlines'] as const };

/** School dates, soonest first. */
export const useDeadlines = () => useQuery({ queryKey: calendarKeys.list, queryFn: calendarApi.list });

/** Only dates from today onwards. */
export function upcoming(deadlines: Deadline[]): Deadline[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return deadlines.filter((d) => new Date(d.dueAt) >= startOfToday);
}
