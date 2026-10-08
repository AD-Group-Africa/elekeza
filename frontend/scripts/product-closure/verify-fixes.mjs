/**
 * Fix-loop verification:
 *  A) EL-NEW-01 — fresh browser profile (NO localStorage a11y settings):
 *     learner enables ONLY the server-side read-aloud pref, then /lesson/3
 *     must now show Listen buttons (was the defect: they never appeared).
 *  B) EL-F-014 — axe scan of /attendance must show zero serious violations
 *     (was 4 serious color-contrast).
 */
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';

const B = 'http://localhost:3100';
const b = await chromium.launch();
const out = {};

// ---- A) server-pref-only Listen buttons ------------------------------------
{
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } }); // fresh profile
  const p = await ctx.newPage();
  await p.goto(B + '/login', { waitUntil: 'load' });
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await p.getByPlaceholder('Enter your email').fill('student@elekeza.app');
  await p.getByPlaceholder('Enter your password').fill('student123');
  await p.getByRole('button', { name: 'Login' }).click();
  await p.waitForURL(/\/student-home/, { timeout: 45000 });

  // Confirm localStorage a11y system is OFF (fresh profile)
  const localTts = await p.evaluate(() => {
    const s = localStorage.getItem('elekeza-settings');
    return s ? JSON.parse(s).textToSpeech === true || JSON.parse(s).readAloud === true : false;
  });

  // Set ONLY the server pref
  await p.goto(B + '/learner/preferences');
  await p.waitForSelector('fieldset', { timeout: 45000 });
  const sw = p.getByRole('switch', { name: 'Listen to lessons' });
  if ((await sw.getAttribute('aria-checked')) !== 'true') { await sw.click(); await p.waitForTimeout(800); }

  // Lesson must now surface Listen buttons from the server pref alone
  await p.goto(B + '/lesson/3');
  await p.waitForSelector('h1', { timeout: 60000 });
  let listenCount = 0;
  try {
    await p.locator('button[aria-label^="Listen to"]').first().waitFor({ timeout: 8000 });
    listenCount = await p.locator('button[aria-label^="Listen to"]').count();
  } catch { /* none */ }
  await p.screenshot({ path: '../e2e-evidence/02-user-journeys/learner/V-server-pref-listen.png' });
  out.el_new_01 = { localTtsSystemOn: localTts, serverPrefListenButtons: listenCount, pass: !localTts && listenCount > 0 };
  await ctx.close();
}

// ---- B) axe re-scan of /attendance ------------------------------------------
{
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(B + '/login', { waitUntil: 'load' });
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await p.getByPlaceholder('Enter your email').fill('teacher@elekeza.app');
  await p.getByPlaceholder('Enter your password').fill('teacher123');
  await p.getByRole('button', { name: 'Login' }).click();
  await p.waitForURL(/\/teacher/, { timeout: 45000 });
  await p.goto(B + '/attendance');
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const scan = await new AxeBuilder({ page: p }).analyze();
  const serious = scan.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  out.el_f_014 = {
    seriousOrCritical: serious.length,
    detail: serious.map(v => ({ id: v.id, nodes: v.nodes.length })),
    all: scan.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
    pass: serious.length === 0,
  };
  fs.writeFileSync('../e2e-evidence/03-security/axe-attendance-after-fix.json', JSON.stringify(scan.violations, null, 2));
  await ctx.close();
}

await b.close();
console.log(JSON.stringify(out, null, 2));
