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
  /** null = nothing assessed yet (sprint 3 backend contract). */
  attendanceRate: number | null;
  periodFrom: string | null;
  periodTo: string | null;
  periodLabel: string;
  records: Array<{ date: string; status: string; note: string | null; className: string }>;
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
  learnerHistory: (learnerId: number) =>
    apiClient.get<LearnerAttendance>(`/attendance/learners/${learnerId}`).then((r) => r.data),
};

export const attendanceKeys = {
  classes: ['attendance', 'classes'] as const,
  roster: (classId: number, date: string) => ['attendance', 'roster', classId, date] as const,
};

/** The staff member's classes — shared by attendance, timetable and classwork. */
export function useClasses() {
  return useQuery({ queryKey: attendanceKeys.classes, queryFn: attendanceApi.classes });
}
