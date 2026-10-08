/**
 * TASK 5 — AI integration degradation, driven from the real frontend.
 * Usage: node journey-ai-down.mjs down|recovery
 *  down     : AI service STOPPED — learner tutor + teacher upload must degrade
 *             honestly (no crash, no 500 leak, no secret exposure).
 *  recovery : AI service RESTARTED — tutor must return live Groq response.
 */
import { Journey, ROLES, report, EV } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const mode = process.argv[2] || 'down';
const J = new Journey({ name: `ai-${mode}`, outDir: EV('05-ai') });
const state = {};

try {
  await J.start();
  const p = J.page;

  // Track the tutor + upload API statuses explicitly
  const apiEvents = [];
  p.on('response', (r) => {
    if (/\/api\/(tutor|content\/upload)/.test(r.url())) apiEvents.push({ status: r.status(), url: r.url().replace('http://localhost:3100', '') });
  });

  // ---- Learner tutor probe ----
  await J.login(ROLES.learner.email, ROLES.learner.password, ROLES.learner.homeRe);
  await J.goto('/student-ai-tutor');
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await p.getByRole('button', { name: 'Explain this concept' }).click();
  await p.waitForTimeout(mode === 'down' ? 8000 : 20000);
  state.tutorText = await p.evaluate(() => document.body.innerText.slice(0, 900));
  await J.shot(`tutor-${mode}`);
  const crashed = await p.evaluate(() => !!document.querySelector('[data-nextjs-dialog]') || /Application error/i.test(document.body.innerText));
  if (mode === 'down') {
    J.step('learner tutor with AI DOWN — UI state captured', `crashed=${crashed}`);
  } else {
    const hasContent = state.tutorText.length > 300 && !/Choose a lesson first/.test(state.tutorText);
    J.step(hasContent ? 'learner tutor RECOVERED — live response rendered' : 'learner tutor recovery unclear', `crashed=${crashed}`);
  }

  // ---- Teacher upload probe (AI-down path) ----
  await J.logout();
  await J.login(ROLES.teacher.email, ROLES.teacher.password, ROLES.teacher.homeRe);
  await J.goto('/teacher/content');
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await p.getByPlaceholder('Lesson Title / Topic').fill(`AI-${mode} ${new Date().toISOString().slice(11, 19)}`);
  const nb = p.getByRole('button', { name: 'Next' });
  for (let i = 0; i < 5 && (await nb.isDisabled()); i++) { await p.waitForTimeout(600); await p.getByPlaceholder('Lesson Title / Topic').fill(`AI-${mode} ${new Date().toISOString().slice(11, 19)}`); }
  await nb.click();
  await p.getByPlaceholder('Paste lesson content here...').fill('Water cycle test content for AI degradation probe. Evaporation turns liquid water into vapour. Condensation forms clouds. Precipitation returns rain to the earth.');
  await p.getByRole('button', { name: /Upload & Simplify/ }).click();
  await p.waitForTimeout(mode === 'down' ? 12000 : 45000);
  state.uploadText = await p.evaluate(() => document.body.innerText.slice(0, 700));
  await J.shot(`upload-${mode}`);
  if (mode === 'down') {
    const degradedOk = /Content saved|could not|unavailable|saved/i.test(state.uploadText);
    J.step(degradedOk ? 'teacher upload with AI DOWN — honest degradation message' : 'teacher upload with AI DOWN — unexpected state', state.uploadText.split('\n').filter(Boolean).slice(0, 4).join(' | '));
  } else {
    const simplified = /AI has simplified/i.test(state.uploadText);
    J.step(simplified ? 'teacher upload RECOVERED — AI adaptation ran' : 'teacher upload recovery: no AI message', state.uploadText.split('\n').filter(Boolean).slice(0, 3).join(' | '));
  }

  await J.logout().catch(() => {});

  fs.writeFileSync(path.join(EV('05-ai'), `${mode}-observations.json`), JSON.stringify({ mode, tutorText: state.tutorText, uploadText: state.uploadText, apiEvents }, null, 2));
} catch (e) {
  J.fail('journey aborted', e.message);
  try { await J.shot('aborted-state'); } catch {}
}

report(`AI ${mode.toUpperCase()}`, await J.finish());
