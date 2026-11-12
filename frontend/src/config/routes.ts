/**
 * Route constants shared by navigation, redirects and the API client.
 * Change a URL here, not in individual screens.
 */

/** Pages that work without a session (no sidebar, no auth redirect). */
export const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/school/onboarding',
  '/waitlist',
] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export const ROUTES = {
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  schoolOnboarding: '/school/onboarding',
  settings: '/dashboard/settings',
  profile: '/dashboard/profile',
  lesson: (id: number | string) => `/lesson/${id}`,
  quiz: (lessonId: number | string) => `/quiz/${lessonId}`,
  quizReview: (quizId: number | string) => `/quiz/review/${quizId}`,
  ward: (id: number | string) => `/guardian/wards/${id}`,
  tutor: (lessonId?: number | string) => (lessonId ? `/student-ai-tutor?lessonId=${lessonId}` : '/student-ai-tutor'),
} as const;
