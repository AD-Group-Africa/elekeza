import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { roleHome, type Role } from '@/lib/roles';
import { BOTTOM_NAV_BY_ROLE, COMMON_NAV, NAV_BY_ROLE } from './navigation';
import { canAccessRoute, routeRule } from './routes';

const ROLES: Role[] = ['STUDENT', 'TEACHER', 'GUARDIAN', 'SCHOOL_ADMIN', 'ADMIN'];

/** every page under app/(app), as a url with sample ids in the dynamic segments. */
function signedInPages(dir = join(__dirname, '../app/(app)'), base = ''): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (!statSync(path).isDirectory()) return name === 'page.tsx' && base ? [base] : [];
    const segment = name.startsWith('[') ? '1' : name;
    return signedInPages(path, `${base}/${segment}`);
  });
}

describe('route access', () => {
  it('has a rule for every signed-in page, so new pages are never left open by accident', () => {
    const pages = signedInPages();
    expect(pages.length).toBeGreaterThan(30);
    expect(pages.filter((p) => !routeRule(p))).toEqual([]);
  });

  it.each(ROLES)('lets %s open every page in its own menus and its home', (role) => {
    const hrefs = [
      roleHome(role),
      ...NAV_BY_ROLE[role].map((n) => n.href),
      ...COMMON_NAV.map((n) => n.href),
      ...(BOTTOM_NAV_BY_ROLE[role] ?? []).flatMap((n) => (n.href ? [n.href] : [])),
    ];
    expect(hrefs.filter((h) => !canAccessRoute(role, h))).toEqual([]);
  });

  it('keeps learners out of staff, guardian and admin pages', () => {
    for (const path of ['/teacher', '/teacher/students', '/guardian', '/admin', '/admin/staff', '/finance', '/super-admin'])
      expect(canAccessRoute('STUDENT', path), path).toBe(false);
  });

  it('keeps teachers out of guardian, school admin and learner-only pages', () => {
    for (const path of ['/guardian', '/admin', '/admin/staff', '/finance', '/student-home', '/super-admin'])
      expect(canAccessRoute('TEACHER', path), path).toBe(false);
  });

  it('keeps guardians on their own pages', () => {
    for (const path of ['/teacher', '/admin', '/finance', '/student-home', '/attendance'])
      expect(canAccessRoute('GUARDIAN', path), path).toBe(false);
    expect(canAccessRoute('GUARDIAN', '/guardian/wards/7')).toBe(true);
  });

  it('gives the platform page to platform admins only', () => {
    expect(canAccessRoute('ADMIN', '/super-admin')).toBe(true);
    expect(canAccessRoute('SCHOOL_ADMIN', '/super-admin')).toBe(false);
    expect(canAccessRoute('SCHOOL_ADMIN', '/admin/staff')).toBe(true);
  });

  it('lets staff preview lessons and school admins reach teacher pages they link to', () => {
    expect(canAccessRoute('TEACHER', '/lesson/3')).toBe(true);
    expect(canAccessRoute('SCHOOL_ADMIN', '/teacher/students')).toBe(true);
    expect(canAccessRoute('GUARDIAN', '/lesson/3')).toBe(false);
  });

  it('matches whole path segments, not prefixes of other pages', () => {
    expect(routeRule('/teacher-assignments')?.[0]).toBe('/teacher-assignments');
    expect(routeRule('/teachers')).toBeUndefined();
    expect(routeRule('/school/onboarding')).toBeUndefined();
  });

  it('allows shared pages for everyone and denies restricted ones to unknown roles', () => {
    expect(canAccessRoute('SOMETHING_NEW', '/dashboard/settings')).toBe(true);
    expect(canAccessRoute(undefined, '/teacher')).toBe(false);
  });
});
