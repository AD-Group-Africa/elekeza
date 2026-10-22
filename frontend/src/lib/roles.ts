/**
 * Role helpers — the single place that knows each role's home page and label.
 * Roles mirror the backend enum `UserRole`.
 */
export type Role = 'STUDENT' | 'TEACHER' | 'GUARDIAN' | 'SCHOOL_ADMIN' | 'ADMIN';

const ROLE_HOME: Record<Role, string> = {
  STUDENT: '/student-home',
  TEACHER: '/teacher',
  GUARDIAN: '/guardian',
  SCHOOL_ADMIN: '/admin',
  ADMIN: '/admin',
};

const ROLE_LABEL: Record<Role, string> = {
  STUDENT: 'Learner',
  TEACHER: 'Teacher',
  GUARDIAN: 'Parent / Guardian',
  SCHOOL_ADMIN: 'School administrator',
  ADMIN: 'Platform administrator',
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && value in ROLE_HOME;
}

/** Home page for a role; unknown roles fall back to the learner home. */
export function roleHome(role: string | null | undefined): string {
  return isRole(role) ? ROLE_HOME[role] : ROLE_HOME.STUDENT;
}

/** Human-readable role name for display. */
export function roleLabel(role: string | null | undefined): string {
  return isRole(role) ? ROLE_LABEL[role] : role ?? '';
}

export function isStaff(role: string | null | undefined): boolean {
  return role === 'TEACHER' || role === 'SCHOOL_ADMIN' || role === 'ADMIN';
}

export function isSchoolAdmin(role: string | null | undefined): boolean {
  return role === 'SCHOOL_ADMIN' || role === 'ADMIN';
}
