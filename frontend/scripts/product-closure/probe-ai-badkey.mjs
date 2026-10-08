/**
 * TASK 5 — invalid provider credentials probe: AI service running with a
 * deliberately INVALID GROQ_API_KEY. Learner tutor + teacher upload must
 * degrade honestly (structured error / deterministic fallback), no crash,
 * no secret exposure in the browser.
 */
import { chromium } from 'playwright';

const B = 'http://localhost:3100';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 } });
const p = await ctx.newPage();
const apiEvents = [];
p.on('response', (r) => {
  if (/\/api\/(tutor|content\/upload)/.test(r.url())) apiEvents.push({ status: r.status(), url: r.url().replace(B, '') });
});

// learner tutor
await p.goto(B + '/login', { waitUntil: 'load' });
await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await p.getByPlaceholder('Enter your email').fill('student@elekeza.app');
await p.getByPlaceholder('Enter your password').fill('student123');
await p.getByRole('button', { name: 'Login' }).click();
await p.waitForURL(/\/student-home/, { timeout: 45000 });
await p.goto(B + '/student-ai-tutor');
await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await p.getByRole('button', { name: 'Explain this concept' }).click();
await p.waitForTimeout(10000);
const tutorText = await p.evaluate(() => document.body.innerText.slice(0, 700));
await p.screenshot({ path: '../e2e-evidence/05-ai/A02-tutor-badkey.png' });

// teacher upload
await p.locator('[aria-label="Logout"]').first().click();
await p.waitForURL(/\/login/, { timeout: 30000 });
await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await p.getByPlaceholder('Enter your email').fill('teacher@elekeza.app');
await p.getByPlaceholder('Enter your password').fill('teacher123');
await p.getByRole('button', { name: 'Login' }).click();
await p.waitForURL(/\/teacher/, { timeout: 45000 });
await p.goto(B + '/teacher/content');
await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
await p.getByPlaceholder('Lesson Title / Topic').fill(`BadKey probe ${new Date().toISOString().slice(11, 19)}`);
const nb = p.getByRole('button', { name: 'Next' });
for (let i = 0; i < 5 && (await nb.isDisabled()); i++) { await p.waitForTimeout(600); await p.getByPlaceholder('Lesson Title / Topic').fill(`BadKey probe ${new Date().toISOString().slice(11, 19)}`); }
await nb.click();
await p.getByPlaceholder('Paste lesson content here...').fill('Bad key probe. The sun is a star. It gives light and heat to the earth.');
await p.getByRole('button', { name: /Upload & Simplify/ }).click();
await p.waitForTimeout(15000);
const uploadText = await p.evaluate(() => document.body.innerText.slice(0, 700));
await p.screenshot({ path: '../e2e-evidence/05-ai/A03-upload-badkey.png' });

console.log('TUTOR (badkey):', JSON.stringify(tutorText.slice(0, 400)));
console.log('UPLOAD (badkey):', JSON.stringify(uploadText.split('\n').filter(Boolean).slice(-4).join(' | ')));
console.log('API:', JSON.stringify(apiEvents));

// secret exposure scan: page content + localStorage/cookies must not contain key material
const leaked = await p.evaluate(() => {
  const s = document.body.innerText + JSON.stringify(localStorage) + document.cookie;
  return /sk-|gsk_[A-Za-z0-9]{10,}|INTERNAL_SECRET/i.test(s);
});
console.log('SECRET_EXPOSED_IN_BROWSER:', leaked);

await b.close();
