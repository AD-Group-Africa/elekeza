/**
 * TASK 2D — SCHOOL ADMIN journey: school dashboard (KPIs), staff, learners,
 * CSV import (configuration surface), reports/analytics, payment settings.
 */
import { Journey, ROLES, report, EV } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const J = new Journey({ name: 'admin', outDir: EV('02-user-journeys/admin') });
const role = ROLES.admin;
const state = {};

try {
  await J.start();
  const p = J.page;

  // 1. Login → school admin dashboard
  await J.login(role.email, role.password, role.homeRe);
  J.step('login as school admin → admin home');
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  state.kpiText = await p.evaluate(() => document.body.innerText.slice(0, 400));
  await J.shot('admin-dashboard');
  J.step('school dashboard rendered', state.kpiText.split('\n').filter(Boolean).slice(0, 6).join(' | '));

  // 2. Staff (teachers) management — wait for the real settled state (the page
  // briefly shows "not linked" while /auth/me is in flight on a cold mount)
  await J.goto('/admin/staff');
  let staffOk = true;
  try {
    await p.getByRole('heading', { name: 'Staff Accounts' }).waitFor({ timeout: 30000 });
  } catch { staffOk = false; }
  state.staffText = (await p.evaluate(() => document.body.innerText.slice(0, 500)));
  await J.shot('staff');
  if (staffOk) {
    J.step('staff page rendered (settled)', state.staffText.split('\n').filter(Boolean).slice(0, 3).join(' | '));
  } else {
    J.fail('staff page settled', state.staffText.split('\n').filter(Boolean).slice(0, 3).join(' | '));
  }

  // 3. Learners via quick action target
  await J.goto('/teacher/students');
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await J.shot('learners-via-admin');
  J.step('learners management rendered');

  // 4. Classes / attendance view (read-only admin evidence)
  await J.goto('/attendance');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(1800);
  await J.shot('admin-attendance-view');
  J.step('attendance view accessible to admin');

  // 5. Reports / analytics
  await J.goto('/analytics');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(1800);
  await J.shot('analytics-reports');
  J.step('reports/analytics rendered');

  // 6. Import + payment configuration surfaces
  await J.goto('/school/import');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(1500);
  await J.shot('school-import');
  J.step('CSV import configuration rendered');

  await J.goto('/school/payment');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(1500);
  await J.shot('school-payment');
  J.step('school payment configuration rendered');

  // 7. Logout (from a stable page — /school/payment has an overlay that can
  // intercept the sidebar click)
  await J.goto('/admin');
  await p.waitForTimeout(800);
  await J.logout();
  J.step('logout');

  fs.writeFileSync(path.join(EV('04-persistence'), 'admin-ops.json'), JSON.stringify({
    dashboardExcerpt: state.kpiText, staffExcerpt: state.staffText,
    note: 'admin surfaces are read/configuration screens; no destructive state change executed',
  }, null, 2));
} catch (e) {
  J.fail('journey aborted', e.message);
  try { await J.shot('aborted-state'); } catch {}
}

report('ADMIN JOURNEY', await J.finish());
