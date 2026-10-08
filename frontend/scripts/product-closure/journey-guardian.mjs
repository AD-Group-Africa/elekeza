/**
 * TASK 2C — GUARDIAN journey: dashboard, child detail, communication (send +
 * persistence loop), fees, reports, notifications.
 */
import { Journey, ROLES, report, EV } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const J = new Journey({ name: 'guardian', outDir: EV('02-user-journeys/guardian') });
const role = ROLES.guardian;
const state = {};
const msgText = `Automated closure check-in ${new Date().toISOString().slice(11, 19)}`;

try {
  await J.start();
  const p = J.page;

  // 1. Login → guardian dashboard
  await J.login(role.email, role.password, role.homeRe);
  J.step('login as guardian → guardian home');
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await J.shot('guardian-dashboard');
  state.children = await p.evaluate(() => Array.from(document.querySelectorAll('a[href^="/guardian/wards/"]')).map(a => ({ href: a.getAttribute('href'), name: a.textContent.trim() })));
  J.step('guardian dashboard rendered', `linked learners: ${state.children.map(c => c.name).join(', ') || '(none)'}`);

  // 2. Child detail (progress/attendance/results live here)
  if (state.children.length > 0) {
    await p.locator(`a[href="${state.children[0].href}"]`).first().click();
    await p.waitForURL(/\/guardian\/wards\/\d+/, { timeout: 45000 });
    await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    state.childText = (await p.evaluate(() => document.body.innerText)).slice(0, 600);
    await J.shot('child-detail');
    J.step('child detail rendered', state.childText.split('\n').filter(Boolean).slice(0, 3).join(' | '));
  } else {
    J.fail('linked learner present', 'guardian has no wards — cannot test child detail');
  }

  // 3. Communication — send message (persistence op)
  await J.goto('/guardian/communication');
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  state.threadBefore = (await p.evaluate(() => document.body.innerText)).slice(0, 300);
  await J.shot('communication-thread');
  await p.getByPlaceholder('Type a message to the teacher…').fill(msgText);
  await p.locator('button:has(svg.lucide-send)').first().click();
  await p.getByText(msgText).first().waitFor({ timeout: 30000 });
  await p.waitForTimeout(800);
  await J.shot('message-sent');
  J.step('guardian message sent', msgText);

  // 4. Fees (M-Pesa surface)
  await J.goto('/guardian/fees');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(1800);
  state.feesText = (await p.evaluate(() => document.body.innerText)).slice(0, 500);
  await J.shot('fees');
  J.step('fees page rendered', state.feesText.split('\n').filter(Boolean).slice(0, 3).join(' | '));

  // 5. Reports
  await J.goto('/guardian/reports');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(1800);
  await J.shot('reports');
  J.step('reports page rendered');

  // 6. Notifications
  await J.goto('/notifications');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(1800);
  await J.shot('notifications');
  J.step('notifications page rendered');

  // 7. Persistence loop — logout → login → message must still be in thread
  await J.logout();
  J.step('logout');
  await J.login(role.email, role.password, role.homeRe);
  J.step('re-login');
  await J.goto('/guardian/communication');
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await p.getByText(msgText).first().waitFor({ timeout: 30000 });
  await J.shot('message-persisted-after-relogin');
  J.step('PERSISTED: guardian message survives logout/login', msgText);

  fs.writeFileSync(path.join(EV('04-persistence'), 'guardian-ops.json'), JSON.stringify({
    messageSent: msgText, persisted: true,
    children: state.children, feesExcerpt: state.feesText,
  }, null, 2));
} catch (e) {
  J.fail('journey aborted', e.message);
  try { await J.shot('aborted-state'); } catch {}
}

report('GUARDIAN JOURNEY', await J.finish());
