import { apiClient } from '@/lib/api';

export type TutorAction = 'EXPLAIN' | 'PRACTICE' | 'TRANSLATE' | 'SUMMARY' | 'DIAGRAM';

export interface TutorRequest {
  action: TutorAction;
  lessonId?: number;
  text?: string;
  practiceId?: string;
  answerIndex?: number;
  variant?: string;
}

export interface PracticeQuestion {
  practiceId: string;
  question: string;
  options: string[];
  lessonTitle: string;
}
export interface PracticeFeedback {
  correct: boolean;
  explanation: string;
  canRetry: boolean;
}
export interface TutorDiagram {
  title: string;
  altText: string;
  nodes: { id: string; label: string }[];
  edges: { from: string; to: string; label: string }[];
}

export interface TutorResponse {
  action: TutorAction | string;
  intro?: string | null;
  content?: string | null;
  practice?: PracticeQuestion;
  feedback?: PracticeFeedback;
  originalText?: string | null;
  translatedBy?: string;
  diagram?: TutorDiagram;
  source?: string;
}

export const tutorApi = {
  ask: (request: TutorRequest) => apiClient.post<TutorResponse>('/tutor', request).then((r) => r.data),
};
