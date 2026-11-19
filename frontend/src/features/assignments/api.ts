import { apiClient } from '@/lib/api';

/** Class assignment (the "Classwork" domain — not lesson assignment). */
export interface AssignmentInfo {
  id: number;
  classId: number;
  className: string | null;
  title: string;
  instructions: string | null;
  dueDate: string | null;
  points: number;
  status: string;
  createdBy: number;
  submissionCount: number;
  gradedCount: number;
}
export interface SubmissionInfo {
  id: number;
  assignmentId: number;
  learnerId: number;
  learnerName: string | null;
  content: string;
  submittedAt: string;
  score: number | null;
  feedback: string | null;
  graded: boolean;
}

export const assignmentsApi = {
  // staff
  create: (payload: { classId: number; title: string; instructions?: string; dueDate?: string; points?: number }) =>
    apiClient.post<AssignmentInfo>('/assignments', payload).then((r) => r.data),
  classAssignments: (classId: number) =>
    apiClient.get<AssignmentInfo[]>(`/assignments/classes/${classId}`).then((r) => r.data),
  submissions: (id: number) => apiClient.get<SubmissionInfo[]>(`/assignments/${id}/submissions`).then((r) => r.data),
  grade: (submissionId: number, score: number, feedback?: string) =>
    apiClient
      .post<SubmissionInfo>(`/assignments/submissions/${submissionId}/grade`, { score, feedback })
      .then((r) => r.data),
  // learner
  mine: () => apiClient.get<AssignmentInfo[]>('/assignments/learner/mine').then((r) => r.data),
  submit: (id: number, content: string) =>
    apiClient.post<SubmissionInfo>(`/assignments/${id}/submit`, { content }).then((r) => r.data),
  mySubmissions: () => apiClient.get<SubmissionInfo[]>('/assignments/learner/submissions').then((r) => r.data),
};

export const assignmentKeys = {
  mine: ['assignments', 'mine'] as const,
  mySubmissions: ['assignments', 'my-submissions'] as const,
  forClass: (classId: number) => ['assignments', 'class', classId] as const,
  submissions: (assignmentId: number) => ['assignments', 'submissions', assignmentId] as const,
};
