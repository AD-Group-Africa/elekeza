/**
 * Route constants shared by navigation, redirects and the API client.
 * Change a URL here, not in individual screens.
 */
import { isRole, type Role } from '@/lib/roles';

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

const LEARNER: readonly Role[] = ['STUDENT'];
const STAFF: readonly Role[] = ['TEACHER', 'SCHOOL_ADMIN', 'ADMIN'];
const SCHOOL_ADMINS: readonly Role[] = ['SCHOOL_ADMIN', 'ADMIN'];
const EVERYONE = 'any' as const;

/**
 * which roles may open each signed-in area. a rule matches its own path and
 * everything below it; the most specific (longest) match wins. these mirror
 * the backend's role checks, which stay the real enforcement: the guard only
 * stops a screen from rendering (and firing requests that would be refused)
 * for the wrong role. every page under app/(app) must be covered, which
 * routes.test.ts checks.
 */
export const ROUTE_ACCESS: ReadonlyArray<readonly [path: string, roles: readonly Role[] | typeof EVERYONE]> = [
  ['/dashboard', EVERYONE],
  ['/notifications', EVERYONE],
  ['/marketplace', EVERYONE],
  ['/government', EVERYONE],
  ['/therapist', EVERYONE],

  ['/student-home', LEARNER],
  ['/student-ai-tutor', LEARNER],
  ['/student-lessons', LEARNER],
  ['/student-quizzes', LEARNER],
  ['/student-exams', LEARNER],
  ['/assignments', LEARNER],
  ['/progress', LEARNER],
  ['/learner', LEARNER],
  ['/onboarding', LEARNER],
  ['/quiz', LEARNER],
  ['/exam', LEARNER],
  // teachers open their own lessons from the lessons list to preview them
  ['/lesson', ['STUDENT', ...STAFF]],

  ['/teacher', STAFF],
  ['/teacher-assignments', STAFF],
  ['/attendance', STAFF],

  ['/guardian', ['GUARDIAN']],

  ['/admin', SCHOOL_ADMINS],
  ['/school/import', SCHOOL_ADMINS],
  ['/school/payment', SCHOOL_ADMINS],
  ['/finance', SCHOOL_ADMINS],
  ['/analytics', SCHOOL_ADMINS],
  ['/super-admin', ['ADMIN']],
];

/** the access rule for a path, or undefined when no rule covers it. */
export function routeRule(pathname: string) {
  let best: (typeof ROUTE_ACCESS)[number] | undefined;
  for (const rule of ROUTE_ACCESS) {
    const [path] = rule;
    if ((pathname === path || pathname.startsWith(path + '/')) && (!best || path.length > best[0].length)) best = rule;
  }
  return best;
}

/**
 * whether a signed-in user with `role` may open `pathname`. paths without a
 * rule are allowed so unknown urls still reach the not-found page.
 */
export function canAccessRoute(role: string | null | undefined, pathname: string): boolean {
  const rule = routeRule(pathname);
  if (!rule) return true;
  const [, roles] = rule;
  if (roles === EVERYONE) return true;
  return isRole(role) && roles.includes(role);
}
