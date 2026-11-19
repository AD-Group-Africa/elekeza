import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Wave 0 (UX-P1-01) regression tests — application shell ownership.
 *
 * The "sidebar disappears" defect was structural: a route only received a
 * sidebar if it imported one itself, and several pages did not. Fixing pages
 * one at a time leaves the trap open for the next page, so these tests assert
 * the invariant instead:
 *
 *   Every authenticated route either inherits a shell from an ancestor
 *   `layout.tsx` or wraps itself — exactly once, never twice.
 */

const APP_DIR = path.resolve(process.cwd(), 'src/app');

const SHELL_IMPORT =
  /from\s+['"]@\/components\/(layout\/SidebarLayout|DashboardLayout)['"]/;
const SELF_WRAPS = /<(SidebarLayout|DashboardLayout)>/;

/** Routes that must render inside the application shell. */
const REQUIRES_SHELL = [
  'attendance',
  'admin',
  'admin/staff',
  'finance',
  'analytics',
  'teacher-assignments',
  'guardian',
  'teacher',
  'super-admin',
  'school/import',
  'school/payment',
];

/** Public routes that legitimately render without the signed-in shell. */
const PUBLIC_ROUTES = new Set([
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'waitlist',
  'school/onboarding',
]);

function isFile(p: string): boolean {
  return existsSync(p) && statSync(p).isFile();
}

/** Walk all page.tsx files, returning their route directory. */
function allPageDirs(dir = APP_DIR, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      allPageDirs(full, acc);
    } else if (entry === 'page.tsx') {
      acc.push(dir);
    }
  }
  return acc;
}

function relativeRoute(dir: string): string {
  return path.relative(APP_DIR, dir).split(path.sep).join('/');
}

/** The nearest ancestor layout.tsx that actually installs a shell. */
function inheritedShell(dir: string): string | null {
  let current = dir;
  for (;;) {
    const layout = path.join(current, 'layout.tsx');
    if (isFile(layout) && SHELL_IMPORT.test(readFileSync(layout, 'utf8'))) {
      return layout;
    }
    const parent = path.dirname(current);
    if (parent === current || current === APP_DIR) return null;
    current = parent;
  }
}

describe('application shell ownership', () => {
  const pageDirs = allPageDirs();

  it('finds the application routes', () => {
    expect(pageDirs.length).toBeGreaterThan(50);
  });

  it('gives every audited authenticated route a shell', () => {
    const missing = REQUIRES_SHELL.filter((route) => {
      const dir = path.join(APP_DIR, ...route.split('/'));
      if (!existsSync(dir)) return false; // route does not exist; not this test's job
      const selfWraps = SELF_WRAPS.test(readFileSync(path.join(dir, 'page.tsx'), 'utf8'));
      return inheritedShell(dir) === null && !selfWraps;
    });
    expect(missing, `routes with no application shell: ${missing.join(', ')}`).toEqual([]);
  });

  it('never nests two shells on one route', () => {
    const doubled: string[] = [];
    for (const dir of pageDirs) {
      const page = readFileSync(path.join(dir, 'page.tsx'), 'utf8');
      if (!SELF_WRAPS.test(page)) continue;
      const shell = inheritedShell(dir);
      if (shell) doubled.push(`${relativeRoute(dir)} (page wraps, ${path.basename(path.dirname(shell))} also wraps)`);
    }
    expect(doubled, `double-shelled routes: ${doubled.join(', ')}`).toEqual([]);
  });

  it('does not demand a shell from public pages', () => {
    for (const route of PUBLIC_ROUTES) {
      const dir = path.join(APP_DIR, ...route.split('/'));
      if (!existsSync(dir)) continue;
      const layout = path.join(dir, 'layout.tsx');
      const parentLayout = path.join(path.dirname(dir), 'layout.tsx');
      if (isFile(layout)) {
        expect(SHELL_IMPORT.test(readFileSync(layout, 'utf8')), `${route} should not require auth shell`).toBe(false);
      }
      if (isFile(parentLayout)) {
        expect(SHELL_IMPORT.test(readFileSync(parentLayout, 'utf8')), `${route} inherited an auth shell`).toBe(false);
      }
    }
  });

  it('keeps the shell component free of a hard-coded per-page nav switch', () => {
    // The role mapping lives in navConfig so it can be tested; a switch inside
    // the component is how the two divergent menus appeared in the first place.
    const shell = readFileSync(path.resolve(process.cwd(), 'src/components/layout/SidebarLayout.tsx'), 'utf8');
    expect(shell).toContain("from '@/components/layout/navConfig'");
    expect(shell).not.toMatch(/case 'TEACHER':/);
  });
});
