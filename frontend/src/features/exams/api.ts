import { apiClient } from '@/lib/api';

export type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | string;

export interface ExamQuestion {
  id: number;
  question: string;
  qtype: QuestionType;
  options: (string | null)[];
  marks: number;
  orderIndex?: number;
}

/** Exam as listed for learners (available) and staff (all statuses). */
export interface ExamSummary {
  id: number;
  title: string;
  subject: string;
  description?: string | null;
  durationMinutes: number;
  questionCount: number;
  totalMarks: number;
  maxAttempts?: number;
  status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | string;
}

export interface ExamDetail extends ExamSummary {
  questions: ExamQuestion[];
}

export interface NewExamQuestion {
  question: string;
  qtype: QuestionType;
  options: string[];
  correctOption: string | null;
  correctText: string | null;
  marks: number;
}

export interface NewExam {
  title: string;
  subject: string;
  description: string | null;
  durationMinutes: number;
  maxAttempts: number;
  questions: NewExamQuestion[];
}

export interface StartedAttempt {
  attemptId: number;
  examId: number;
  expiresAt: string;
  remainingSeconds: number;
  questions: ExamQuestion[];
  savedAnswers: Record<string, string>;
}

/** One attempt in a results list (learner: own results; staff: per exam). */
export interface AttemptResult {
  attemptId: number;
  examTitle?: string;
  studentName?: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'TIMED_OUT' | string;
  score: number | null;
  totalMarks: number;
}

export interface BreakdownRow {
  questionId: number;
  question: string;
  qtype: QuestionType;
  studentAnswer: string | null;
  correct?: boolean | null;
  marksAwarded: number | null;
  marksPossible: number;
  feedback?: string | null;
}

export interface AttemptDetail extends AttemptResult {
  breakdown: BreakdownRow[];
}

export const examApi = {
  // staff
  list: () => apiClient.get<ExamSummary[]>('/exams').then((r) => r.data),
  create: (payload: NewExam) => apiClient.post('/exams', payload).then((r) => r.data),
  get: (id: number) => apiClient.get<ExamDetail>(`/exams/${id}`).then((r) => r.data),
  publish: (id: number) => apiClient.post(`/exams/${id}/publish`).then((r) => r.data),
  close: (id: number) => apiClient.post(`/exams/${id}/close`).then((r) => r.data),
  results: (id: number) => apiClient.get<AttemptResult[]>(`/exams/${id}/results`).then((r) => r.data),
  mark: (attemptId: number, questionId: number, marksAwarded: number, feedback?: string) =>
    apiClient
      .post<AttemptDetail>(`/exams/attempts/${attemptId}/mark`, { questionId, marksAwarded, feedback })
      .then((r) => r.data),
  // learner
  available: () => apiClient.get<ExamSummary[]>('/exams/available').then((r) => r.data),
  start: (id: number) => apiClient.post<StartedAttempt>(`/exams/${id}/start`).then((r) => r.data),
  saveAnswer: (attemptId: number, questionId: number, answer: string | null) =>
    apiClient.post(`/exams/attempts/${attemptId}/answers`, { questionId, answer }).then((r) => r.data),
  integrityEvent: (attemptId: number, eventType: string, detail?: string) =>
    apiClient.post(`/exams/attempts/${attemptId}/integrity`, { eventType, detail }).then((r) => r.data),
  submit: (attemptId: number, answers: Array<{ questionId: number; answer: string | null }>) =>
    apiClient
      .post<{ score: number | null; totalMarks: number }>(`/exams/attempts/${attemptId}/submit`, { answers })
      .then((r) => r.data),
  myResults: () => apiClient.get<AttemptResult[]>('/exams/results').then((r) => r.data),
  /** Attempt breakdown — the learner's own, or any attempt for staff marking. */
  resultDetail: (attemptId: number) => apiClient.get<AttemptDetail>(`/exams/results/${attemptId}`).then((r) => r.data),
};

export const examKeys = {
  all: ['exams'] as const,
  staffList: ['exams', 'staff'] as const,
  learner: ['exams', 'learner'] as const,
  results: (examId: number) => ['exams', 'results', examId] as const,
};
