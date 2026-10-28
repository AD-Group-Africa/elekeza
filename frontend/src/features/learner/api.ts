import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

/** GET /api/progress/dashboard — the learner's headline progress. */
export interface ProgressDashboard {
  name?: string;
  streak?: number;
  learningStreak?: number;
  completedLessons?: number;
  quizzesTaken?: number;
  averageScore?: number;
  upcomingQuizzes?: Array<{ id?: number; lessonId?: number; title?: string }>;
  recentLessons?: Array<{ id?: number; title?: string; quizScore?: number; completedAt?: string }>;
}

/** GET /api/progress/lessons — lessons assigned to the learner. */
export interface AssignedLesson {
  id: number;
  title: string;
  score: number | null;
  completed: boolean;
}

/** GET /api/gamification/student */
export interface Gamification {
  level: number;
  levelName: string;
  points: number;
  nextLevelPoints: number;
  stars: number;
  achievements: string[];
}

/** GET /api/analytics/student */
export interface LearnerAnalytics {
  learningStreak?: number;
  weeklyActivity?: Array<{ day: string; minutes: number }>;
  quizHistory?: Array<{ lessonId?: number; score?: number; date?: string }>;
}

/** GET /api/mastery/learner — explainable per-lesson mastery and next step. */
export interface MasteryRow {
  contentId: number;
  title: string;
  attempts: number;
  bestScore: number | null;
  recentAverage?: number | null;
  state: string;
  stateLabel?: string;
  reason: string;
  nextAction?: string;
  nextLabel?: string;
  nextReason?: string;
}

/** A learning preference with where its value came from. */
export interface EffectivePreference {
  value: string;
  source: 'EXPLICIT' | 'TEACHER' | 'GUARDIAN' | 'OBSERVED' | 'SYSTEM' | string;
  confidence?: number;
}
export type PreferenceMap = Record<string, EffectivePreference>;

export interface OnboardingProfile {
  preferredLanguage: string;
  ageGroup: string;
  learningGoal: string | null;
  cognitiveProfiles: string[];
}

export const learnerApi = {
  dashboard: () => apiClient.get<ProgressDashboard>('/progress/dashboard').then((r) => r.data),
  lessons: () => apiClient.get<AssignedLesson[]>('/progress/lessons').then((r) => r.data),
  gamification: () => apiClient.get<Gamification>('/gamification/student').then((r) => r.data),
  analytics: () => apiClient.get<LearnerAnalytics>('/analytics/student').then((r) => r.data),
  mastery: () => apiClient.get<MasteryRow[]>('/mastery/learner').then((r) => (Array.isArray(r.data) ? r.data : [])),
  preferences: () =>
    apiClient.get<{ effective: PreferenceMap }>('/learner/preferences').then((r) => r.data.effective ?? {}),
  setPreference: (key: string, value: string) =>
    apiClient
      .put<{ effective: PreferenceMap }>('/learner/preferences', { key, value })
      .then((r) => r.data.effective ?? {}),
  // onboarding
  saveProfile: (profile: OnboardingProfile) => apiClient.post('/onboarding/profile', profile),
  savePlacement: (score: number, totalQuestions: number) =>
    apiClient.post('/onboarding/placement', { score, totalQuestions }),
  linkGuardian: (guardian: { fullName: string; relationship: string; phone: string | null; email: string | null }) =>
    apiClient.post('/onboarding/guardian-link', guardian),
  completeOnboarding: () => apiClient.post('/onboarding/complete', {}),
};

export const learnerKeys = {
  dashboard: ['learner', 'dashboard'] as const,
  lessons: ['learner', 'lessons'] as const,
  gamification: ['learner', 'gamification'] as const,
  analytics: ['learner', 'analytics'] as const,
  mastery: ['learner', 'mastery'] as const,
  preferences: ['learner', 'preferences'] as const,
};

export const useProgressDashboard = () => useQuery({ queryKey: learnerKeys.dashboard, queryFn: learnerApi.dashboard });
export const useAssignedLessons = () => useQuery({ queryKey: learnerKeys.lessons, queryFn: learnerApi.lessons });
export const useGamification = () => useQuery({ queryKey: learnerKeys.gamification, queryFn: learnerApi.gamification });

/** The learner's effective presentation preferences (shared with the lesson page). */
export const useLearnerPreferences = (enabled = true) =>
  useQuery({ queryKey: learnerKeys.preferences, queryFn: learnerApi.preferences, enabled });
