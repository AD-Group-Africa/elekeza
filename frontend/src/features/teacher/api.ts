import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { MasteryRow } from '@/features/learner/api';

/** GET /api/teacher/students — learners in the teacher's school. */
export interface Student {
  id: number;
  name: string;
  email: string;
  sneType?: string;
  grade?: string;
  guardianUserId?: number | null;
  guardianName?: string | null;
}

export interface NewStudent {
  email: string;
  fullName: string;
  password: string;
  sneType: string;
}

/** GET /api/teacher/student/{id}/learning-support */
export interface LearningSupport {
  studentId?: number;
  studentName?: string;
  mastery?: number;
  respondsWellTo?: string[];
  currentlyBenefitsFrom?: { lessonId?: number; note?: string }[];
  presentation?: Record<string, string>;
  aiConfidence?: string;
  profileSource?: string[];
}

/** GET /api/analytics/teacher */
export interface TeacherDashboard {
  totalLearners: number;
  activeLearners: number;
  lessonsCreated: number;
  lessonsAssigned: number;
  completionRate: number;
  averageScore: number;
  atRiskStudents: number;
  weeklyActivity: { day: string; completed: number }[];
  totalQuizzes: number;
}

/** GET /api/teacher/student/progress */
export interface StudentProgress {
  studentId: number | string;
  studentName: string;
  completedLessons: number;
  averageScore: number;
}

/** GET /api/analytics/teacher/quiz-results — one row per answered question. */
export interface QuizResultRow {
  studentName: string;
  lessonTitle: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  correct: boolean;
}

export interface SupportSignal {
  id: number;
  learnerId: number;
  learnerName: string;
  signalType: string;
  status: string;
  reasons: string[];
}

export interface Intervention {
  id: number;
  learnerId: number;
  type: string;
  target: string;
  status: string;
  startDate: string;
  reviewDate: string | null;
}

export interface NewIntervention {
  learnerId: number;
  type: string;
  target: string;
  startDate: string;
  reviewDate: string | null;
}

export interface TimetableSlot {
  dayOfWeek: string;
  period: number;
  subject: string;
}

export const teacherApi = {
  students: () => apiClient.get<Student[]>('/teacher/students').then((r) => r.data),
  createStudent: (student: NewStudent) => apiClient.post('/teacher/student', student),
  learningSupport: (studentId: number) =>
    apiClient.get<LearningSupport>(`/teacher/student/${studentId}/learning-support`).then((r) => r.data),
  applyGuidance: (studentId: number, key: string, value: string) =>
    apiClient
      .post<{ source: string }>(`/teacher/student/${studentId}/learning-preferences`, { key, value })
      .then((r) => r.data),
  learnerMastery: (studentId: number) =>
    apiClient.get<MasteryRow[]>(`/mastery/learner/${studentId}`).then((r) => (Array.isArray(r.data) ? r.data : [])),
  dashboard: () => apiClient.get<TeacherDashboard>('/analytics/teacher').then((r) => r.data),
  classProgress: () => apiClient.get<StudentProgress[]>('/teacher/student/progress').then((r) => r.data ?? []),
  quizResults: () => apiClient.get<QuizResultRow[]>('/analytics/teacher/quiz-results').then((r) => r.data ?? []),
  supportSignals: () => apiClient.get<SupportSignal[]>('/teacher/support-signals').then((r) => r.data ?? []),
  actOnSignal: (id: number, action: 'acknowledge' | 'dismiss') =>
    apiClient.post(`/teacher/support-signals/${id}/${action}`),
  interventions: () => apiClient.get<Intervention[]>('/teacher/interventions').then((r) => r.data ?? []),
  createIntervention: (payload: NewIntervention) => apiClient.post('/teacher/interventions', payload),
  timetable: (classId: number) => apiClient.get<TimetableSlot[]>(`/timetable/${classId}`).then((r) => r.data),
  saveSlot: (classId: number, day: string, period: number, subject: string) =>
    apiClient.post('/timetable/slot', { classId, day, period, subject }),
  clearSlot: (classId: number, day: string, period: number) =>
    apiClient.delete(`/timetable/${classId}/${day}/${period}`),
};

export const teacherKeys = {
  students: ['teacher', 'students'] as const,
  support: (studentId: number) => ['teacher', 'learning-support', studentId] as const,
  mastery: (studentId: number) => ['teacher', 'mastery', studentId] as const,
  dashboard: ['teacher', 'dashboard'] as const,
  classProgress: ['teacher', 'class-progress'] as const,
  quizResults: ['teacher', 'quiz-results'] as const,
  signals: ['teacher', 'support-signals'] as const,
  interventions: ['teacher', 'interventions'] as const,
  timetable: (classId: number) => ['teacher', 'timetable', classId] as const,
};

/** Learners in the teacher's school (also used for lesson assignment and messaging). */
export const useStudents = () => useQuery({ queryKey: teacherKeys.students, queryFn: teacherApi.students });
