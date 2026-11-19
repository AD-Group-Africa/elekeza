import { apiClient } from '@/lib/api';
import { attendanceKeys, type ClassInfo } from '@/features/attendance/api';

export interface EnrolledLearner {
  learnerId: number;
  name: string;
  email: string;
}

/** Class creation (admins) and enrolment (staff). Listing lives in attendance (`useClasses`). */
export const classesApi = {
  create: (name: string, gradeLevel?: string) =>
    apiClient.post<ClassInfo>('/attendance/classes', { name, gradeLevel }).then((r) => r.data),
  learners: (classId: number) =>
    apiClient.get<EnrolledLearner[]>(`/attendance/classes/${classId}/learners`).then((r) => r.data),
  enroll: (classId: number, learnerIds: number[]) =>
    apiClient.post<EnrolledLearner[]>(`/attendance/classes/${classId}/learners`, { learnerIds }).then((r) => r.data),
  unenroll: (classId: number, learnerId: number) =>
    apiClient.delete(`/attendance/classes/${classId}/learners/${learnerId}`),
};

export const classKeys = {
  list: attendanceKeys.classes,
  learners: (classId: number) => ['classes', 'learners', classId] as const,
};
