import { chromium } from 'playwright';

const B = 'http://localhost:3100';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
const p = await ctx.newPage();
p.on('response', r => { if (r.url().includes('/api/')) console.log('  api:', r.status(), r.request().method(), r.url().replace(B, '')); });

await p.goto(B + '/login', { waitUntil: 'load' });
await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await p.getByPlaceholder('Enter your email').fill('admin@elekeza.app');
await p.getByPlaceholder('Enter your password').fill('teacher123');
await p.getByRole('button', { name: 'Login' }).click();
await p.waitForURL(/\/(admin|school)/, { timeout: 45000 });
console.log('landed:', p.url());

await p.goto(B + '/admin/staff', { waitUntil: 'load' });
for (let i = 0; i < 8; i++) {
  await p.waitForTimeout(1500);
  const txt = await p.evaluate(() => document.body.innerText.slice(0, 200));
  console.log(`t+${(i + 1) * 1.5}s:`, txt.replace(/\n/g, ' | '));
  if (!txt.includes('not linked')) break;
}
await p.screenshot({ path: '../e2e-evidence/03-security/admin-staff-recheck.png' });
await b.close();
