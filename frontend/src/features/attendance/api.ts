import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface ClassInfo {
  id: number;
  name: string;
  gradeLevel?: string | null;
  learnerCount: number;
}
export interface RosterEntry {
  learnerId: number;
  learnerName: string;
  status: string | null;
  note: string | null;
}
export interface AttendanceEntry {
  learnerId: number;
  status: string;
  note?: string | null;
}
export interface AttendanceRecord {
  learnerId: number;
  learnerName: string;
  status: string;
  note?: string | null;
}
export interface AttendanceSessionInfo {
  sessionId: number;
  classId: number;
  className: string;
  date: string;
  recordedBy: number;
  counts: Record<string, number>;
  records: AttendanceRecord[];
}
export interface LearnerAttendance {
  learnerId: number;
  learnerName: string;
  className: string | null;
  sessionsMarked: number;
  counts: Record<string, number>;
  attendanceRate: number;
  records: Array<{ date: string; status: string; note: string | null; className: string }>;
}

/** Learner history with the most recent school day first. */
export const newestFirst = (h: LearnerAttendance): LearnerAttendance => ({
  ...h,
  records: [...(h.records ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
});

/** GET /api/attendance/summary — whole school, school admins only. */
export interface AttendanceSummary {
  from: string;
  to: string;
  sessions: number;
  records: number;
  counts: Record<'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED', number>;
  attendanceRate: number;
}

export const attendanceApi = {
  /** Classes the signed-in staff member can see (also used by timetable and classwork). */
  classes: () => apiClient.get<ClassInfo[]>('/attendance/classes').then((r) => r.data),
  roster: (classId: number, date: string) =>
    apiClient.get<RosterEntry[]>(`/attendance/classes/${classId}/roster`, { params: { date } }).then((r) => r.data),
  save: (classId: number, date: string, records: AttendanceEntry[]) =>
    apiClient
      .post<AttendanceSessionInfo>(`/attendance/classes/${classId}/sessions`, { records }, { params: { date } })
      .then((r) => r.data),
  summary: () => apiClient.get<AttendanceSummary>('/attendance/summary').then((r) => r.data),
  learnerHistory: (learnerId: number) =>
    apiClient.get<LearnerAttendance>(`/attendance/learners/${learnerId}`).then((r) => newestFirst(r.data)),
};

export const attendanceKeys = {
  classes: ['attendance', 'classes'] as const,
  roster: (classId: number, date: string) => ['attendance', 'roster', classId, date] as const,
  summary: ['attendance', 'summary'] as const,
};

/** The staff member's classes — shared by attendance, timetable and classwork. */
export function useClasses() {
  return useQuery({ queryKey: attendanceKeys.classes, queryFn: attendanceApi.classes });
}
