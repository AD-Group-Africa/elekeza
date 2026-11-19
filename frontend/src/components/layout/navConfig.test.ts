import { describe, expect, it } from 'vitest';
import { adminItems, navItemsFor } from './navConfig';

/**
 * Wave 0 (UX-P1-01/FUNC-P1-03) regression tests.
 *
 * Before this change the same learner saw two different sidebars depending on
 * which page they opened, and `SCHOOL_ADMIN` was handled by string surgery on
 * one array inside a component. These tests pin the mapping itself.
 */
describe('navItemsFor', () => {
  it('gives teachers the attendance tool and no platform surface', () => {
    const hrefs = navItemsFor('TEACHER').map((i) => i.href);
    expect(hrefs).toContain('/attendance');
    expect(hrefs).toContain('/teacher/students');
    expect(hrefs).not.toContain('/super-admin');
    expect(hrefs).not.toContain('/guardian');
  });

  it('gives guardians only guardian surfaces', () => {
    const hrefs = navItemsFor('GUARDIAN').map((i) => i.href);
    expect(hrefs).toContain('/guardian/wards');
    expect(hrefs.every((h) => h.startsWith('/guardian') || h.startsWith('/dashboard'))).toBe(true);
    expect(hrefs).not.toContain('/finance');
  });

  it('gives learners no administrative or upload surface', () => {
    const hrefs = navItemsFor('STUDENT').map((i) => i.href);
    expect(hrefs).toContain('/student-home');
    // /upload only accepts TEACHER/SCHOOL_ADMIN/ADMIN, so advertising it to a
    // learner is a guaranteed 403 (SEC-P1-05).
    expect(hrefs).not.toContain('/upload');
    expect(hrefs).not.toContain('/admin');
    expect(hrefs).not.toContain('/finance');
  });

  it('never offers the platform surface to a school administrator', () => {
    const hrefs = navItemsFor('SCHOOL_ADMIN').map((i) => i.href);
    expect(hrefs).toContain('/admin');
    expect(hrefs).not.toContain('/super-admin');
  });

  it('offers the platform surface to the platform administrator', () => {
    expect(navItemsFor('ADMIN').map((i) => i.href)).toContain('/super-admin');
  });

  it('returns nothing for a missing or unknown role rather than guessing', () => {
    expect(navItemsFor(undefined)).toEqual([]);
    expect(navItemsFor(null)).toEqual([]);
    expect(navItemsFor('')).toEqual([]);
    expect(navItemsFor('WIZARD')).toEqual([]);
  });

  it('only exposes navigation targets that are unique', () => {
    for (const role of ['STUDENT', 'TEACHER', 'GUARDIAN', 'SCHOOL_ADMIN', 'ADMIN']) {
      const hrefs = navItemsFor(role).map((i) => i.href);
      expect(new Set(hrefs).size, `${role} has duplicate navigation targets`).toBe(hrefs.length);
    }
  });

  it('gives every role an accessible label on every item', () => {
    for (const role of ['STUDENT', 'TEACHER', 'GUARDIAN', 'SCHOOL_ADMIN', 'ADMIN']) {
      for (const item of navItemsFor(role)) {
        expect(item.label.trim().length, `${role} ${item.href} has no label`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the admin set intact for the platform role', () => {
    expect(navItemsFor('ADMIN')).toHaveLength(adminItems.length);
    expect(navItemsFor('SCHOOL_ADMIN')).toHaveLength(adminItems.length - 1);
  });
});
