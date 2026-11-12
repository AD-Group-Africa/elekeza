import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { SubmissionInfo } from '@/features/assignments/api';
import type { AttemptResult } from '@/features/exams/api';
import { newestFirst, type LearnerAttendance } from '@/features/attendance/api';

/** GET /api/guardian/wards — a learner linked to the guardian. */
export interface Ward {
  id: number;
  name?: string;
  /** PARENT, CAREGIVER, OLDER_SIBLING, LEGAL_GUARDIAN, OTHER */
  relationship?: string;
  sneType?: string;
  grade?: string;
  lessonsCompleted?: number;
  lessonsPending?: number;
  averageScore?: number;
  lastActive?: string;
}

/** GET /api/guardian/wards/{id} */
export interface WardDetail extends Omit<Ward, 'id'> {
  recentQuizzes?: { lessonId?: number; score?: number; date?: string }[];
  progressHistory?: { date?: string; score?: number }[];
}

/** GET /api/guardian/wards/{id}/learning-support */
export interface WardLearningSupport {
  wardName?: string;
  summary?: string;
  profileConfiguredBy?: string[];
}

/** GET /api/guardian/wards/{id}/digest — composed server-side from real records. */
export interface WardDigest {
  learnerName?: string;
  learning?: { lessonsCompleted?: number; lessonsPending?: number; averageScore?: number | null };
  attendance?: { rate?: number | null; sessionsMarked?: number; today?: string | null };
  classwork?: {
    dueSoon?: Array<{ id: number; title: string; dueDate: string; submitted: boolean }>;
    missing?: Array<{ id: number; title: string; dueDate: string }>;
    recentFeedback?: Array<{ title: string; score: number | null; points: number; feedback: string | null }>;
  };
  fees?: { outstanding?: number };
}

/** GET /api/guardian/reports — one progress report per ward. */
export interface WardReport {
  id: number;
  title: string;
  date: string;
  wardName?: string;
  lessonsCompleted?: number;
  lessonsPending?: number;
  averageScore?: number;
}

/** GET /api/guardian/schedule — what each ward still needs to do. */
export interface ScheduleItem {
  title: string;
  date: string;
  time: string;
  type: string;
  lessonId?: number;
  wardName?: string;
}

export const guardianApi = {
  wards: () => apiClient.get<Ward[]>('/guardian/wards').then((r) => r.data ?? []),
  ward: (id: number | string) => apiClient.get<WardDetail>(`/guardian/wards/${id}`).then((r) => r.data),
  learningSupport: (id: number | string) =>
    apiClient.get<WardLearningSupport>(`/guardian/wards/${id}/learning-support`).then((r) => r.data),
  digest: (id: number | string) => apiClient.get<WardDigest>(`/guardian/wards/${id}/digest`).then((r) => r.data),
  reports: () => apiClient.get<WardReport[]>('/guardian/reports').then((r) => r.data ?? []),
  examResults: (id: number | string) =>
    apiClient.get<AttemptResult[]>(`/exams/guardian/${id}/results`).then((r) => r.data ?? []),
  submissions: (id: number | string) =>
    apiClient.get<SubmissionInfo[]>(`/assignments/guardian/wards/${id}/submissions`).then((r) => r.data ?? []),
  attendance: (id: number | string) =>
    apiClient.get<LearnerAttendance>(`/attendance/learners/${id}`).then((r) => newestFirst(r.data)),
  schedule: () => apiClient.get<ScheduleItem[]>('/guardian/schedule').then((r) => r.data ?? []),
};

export const guardianKeys = {
  wards: ['guardian', 'wards'] as const,
  ward: (id: number | string) => ['guardian', 'ward', String(id)] as const,
  support: (id: number | string) => ['guardian', 'support', String(id)] as const,
  digest: (id: number | string) => ['guardian', 'digest', String(id)] as const,
  reports: ['guardian', 'reports'] as const,
  exams: (id: number | string) => ['guardian', 'exams', String(id)] as const,
  submissions: (id: number | string) => ['guardian', 'submissions', String(id)] as const,
  attendance: (id: number | string) => ['guardian', 'attendance', String(id)] as const,
  schedule: ['guardian', 'schedule'] as const,
};

export const useWards = () => useQuery({ queryKey: guardianKeys.wards, queryFn: guardianApi.wards });

const RELATIONSHIP_LABELS: Record<string, string> = {
  PARENT: 'Parent',
  CAREGIVER: 'Caregiver',
  OLDER_SIBLING: 'Older sibling',
  LEGAL_GUARDIAN: 'Legal guardian',
  OTHER: 'Guardian',
};

/** Friendly label for a guardian-learner relationship. */
export const relationshipLabel = (r?: string) => (r && RELATIONSHIP_LABELS[r]) || 'Guardian';
