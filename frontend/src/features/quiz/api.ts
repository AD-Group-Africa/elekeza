import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface QuizQuestion {
  id: string | number;
  questionText?: string;
  question?: string;
  /** An array, or one option per line. */
  options?: string[] | string;
}

export interface QuizAttempt {
  quizId: string | number;
  questions: QuizQuestion[];
}

export interface AnswerResult {
  correct: boolean;
  learnerMessage?: string;
  directive?: string;
}

export interface QuizFeedback {
  correct: boolean;
  correctOption?: string;
  explanation?: string;
}

export interface QuizCompletion {
  score: number;
  feedback?: QuizFeedback[];
}

export interface QuizReview {
  questions: Array<{
    correct: boolean;
    question: string;
    userAnswer: string;
    correctAnswer?: string;
    explanation?: string;
  }>;
}

export const quizApi = {
  /** Opens (or resumes) the practice quiz for a lesson. */
  start: (lessonId: string | number) => apiClient.get<QuizAttempt>(`/quiz/${lessonId}/start`).then((r) => r.data),
  answer: (
    quizId: string | number,
    questionId: string | number,
    selectedOptionId: string,
    latencyMs?: number,
    idempotencyKey?: string,
  ) =>
    apiClient
      .post<AnswerResult>(
        `/quiz/${quizId}/answer`,
        { questionId, selectedOptionId, latencyMs },
        idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined,
      )
      .then((r) => r.data),
  complete: (quizId: string | number, answers: Array<{ questionId: string | number; selectedOption: string }>) =>
    apiClient.post<QuizCompletion>(`/quiz/${quizId}/complete`, answers).then((r) => r.data),
  review: (quizId: string | number) => apiClient.get<QuizReview>(`/quiz/${quizId}/review`).then((r) => r.data),
};

export const quizKeys = {
  start: (lessonId: string | number) => ['quiz', 'start', String(lessonId)] as const,
  review: (quizId: string | number) => ['quiz', 'review', String(quizId)] as const,
};

/**
 * The practice quiz for a lesson. Shared by the lesson page (to show whether
 * practice exists) and the quiz page, so opening the quiz reuses the same
 * attempt instead of starting a second one.
 */
export function useLessonQuiz(lessonId: string | number | undefined, enabled = true) {
  return useQuery({
    queryKey: quizKeys.start(lessonId ?? ''),
    queryFn: () => quizApi.start(lessonId!),
    enabled: enabled && lessonId !== undefined && lessonId !== '',
    retry: false,
  });
}

/** Options may arrive as an array or as newline-separated text. */
export function optionsOf(q: QuizQuestion): string[] {
  if (!q.options) return [];
  return Array.isArray(q.options) ? q.options : q.options.split('\n').filter((o) => o.trim().length > 0);
}

/** A, B, C… for option index 0, 1, 2… */
export const optionLetter = (index: number) => String.fromCharCode(65 + index);
