/**
 * TASK 2B — TEACHER journey: dashboard, learners, lessons, upload → AI simplify
 * → preview, quizzes/results, attendance (saved + persisted), progress, assignments.
 */
import { Journey, ROLES, report, EV } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const J = new Journey({ name: 'teacher', outDir: EV('02-user-journeys/teacher') });
const role = ROLES.teacher;
const state = {};

try {
  await J.start();
  const p = J.page;

  // 1. Login → teacher dashboard
  await J.goto('/login');
  await J.shot('login-page');
  await J.login(role.email, role.password, role.homeRe);
  J.step('login as teacher → teacher home');
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  state.dashText = (await p.evaluate(() => document.body.innerText)).slice(0, 500);
  await J.shot('teacher-dashboard');
  J.step('teacher dashboard rendered', state.dashText.split('\n').filter(Boolean).slice(0, 4).join(' | '));

  // 2. Learners
  await J.goto('/teacher/students');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(1500);
  state.studentsText = (await p.evaluate(() => document.body.innerText)).slice(0, 400);
  await J.shot('students');
  J.step('learners page rendered');

  // 3. Lessons
  await J.goto('/teacher/lessons');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(1500);
  await J.shot('lessons');
  J.step('lessons page rendered');

  // 4. Content upload → AI simplify (Groq Stage 2) → preview
  await J.goto('/teacher/content');
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}); // hydration before controlled-input fill
  await p.getByPlaceholder('Lesson Title / Topic').waitFor({ timeout: 60000 });
  const uniq = `Closure Audit ${new Date().toISOString().slice(11, 19)}`;
  const titleInput = p.getByPlaceholder('Lesson Title / Topic');
  await titleInput.fill(uniq);
  // Guard: controlled input must reach React state (Next enables only when topic non-empty)
  const nextBtn = p.getByRole('button', { name: 'Next' });
  for (let i = 0; i < 5 && (await nextBtn.isDisabled()); i++) {
    await p.waitForTimeout(700);
    await titleInput.fill(uniq);
  }
  if (await nextBtn.isDisabled()) throw new Error('Lesson Title fill did not reach React state (hydration)');
  await p.getByPlaceholder('Subject (e.g., Mathematics)').fill('Science');
  await nextBtn.click();
  await p.getByPlaceholder('Paste lesson content here...').waitFor({ timeout: 20000 });
  await p.getByPlaceholder('Paste lesson content here...').fill(
    'How Plants Make Food. Plants make their own food using sunlight, water and air. ' +
    'The green part of a leaf called chlorophyll catches the sunlight. The plant mixes ' +
    'water from the roots with carbon dioxide from the air to make sugar. This process ' +
    'is called photosynthesis. The plant gives out oxygen which people and animals breathe.'
  );
  await J.shot('upload-step');
  await p.getByRole('button', { name: /Upload & Simplify/ }).click();
  // Preview step shows the AI adaptation message
  await p.getByText(/AI has simplified|Content saved/).waitFor({ timeout: 90000 });
  state.uploadMsg = await p.getByText(/AI has simplified|Content saved/).textContent();
  await J.shot('ai-simplify-preview');
  J.step('content upload → AI simplify → preview', state.uploadMsg?.trim());
  state.aiAdapted = /AI has simplified/i.test(state.uploadMsg || '');

  // 5. Preview lesson as rendered learner content
  const previewLink = p.getByRole('link', { name: /Preview Lesson/ });
  if (await previewLink.isVisible().catch(() => false)) {
    await previewLink.click();
    await p.waitForURL(/\/lesson\/\d+/, { timeout: 45000 });
    await p.waitForSelector('h1', { timeout: 45000 });
    state.newLessonTitle = await p.locator('h1').first().textContent();
    await J.shot('new-lesson-as-learner-view');
    J.step('uploaded lesson renders at /lesson/{id}', state.newLessonTitle?.trim());
  } else {
    J.fail('Preview Lesson link visible', 'upload preview did not provide lesson link');
  }

  // 6. Quiz results
  await J.goto('/teacher/quiz-results');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(1500);
  await J.shot('quiz-results');
  J.step('quiz results page rendered');

  // 7. Attendance — mark register and save
  await J.goto('/attendance');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(2000);
  await J.shot('attendance-page');
  const presentRadios = p.getByRole('radio', { name: 'PRESENT', exact: true });
  const n = await presentRadios.count();
  for (let i = 0; i < n; i++) {
    await presentRadios.nth(i).click();
    await p.waitForTimeout(150);
  }
  await J.shot('attendance-marked');
  await p.getByRole('button', { name: 'Save register' }).click();
  await p.getByRole('status').filter({ hasText: /./ }).first().waitFor({ timeout: 30000 });
  state.attMsg = await p.getByRole('status').filter({ hasText: /./ }).first().textContent();
  await J.shot('attendance-saved');
  J.step('attendance register saved', `${n} learners — ${state.attMsg?.trim().slice(0, 120)}`);

  // 8. Attendance persistence — reload, open history of first learner
  await J.goto('/attendance');
  await p.waitForLoadState('domcontentloaded');
  // Same-URL reload: wait for hydration to settle (dev server recompiles
  // chunks; a fixed 2s wait raced mount and read an unhydrated page).
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const historyBtn = p.getByRole('button', { name: 'History' }).first();
  if (await historyBtn.isVisible().catch(() => false)) {
    await historyBtn.click();
    await p.waitForTimeout(1500);
    state.historyText = (await p.evaluate(() => document.body.innerText)).slice(0, 500);
    await J.shot('attendance-history-persisted');
    const today = new Date().toISOString().slice(0, 10);
    if (state.historyText.includes(today)) {
      J.step('PERSISTED: attendance record visible in history after reload', `date ${today} shown`);
    } else {
      J.fail('PERSISTED: attendance history', `today (${today}) not found in history view`);
    }
  } else {
    J.fail('attendance history button', 'no History control after reload');
  }

  // 9. Class progress
  await J.goto('/teacher/progress');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(1500);
  await J.shot('teacher-progress');
  J.step('class progress page rendered');

  // 10. Assignments (known LOW defect: raw IDs)
  await J.goto('/teacher/assignments');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(1500);
  state.assignText = (await p.evaluate(() => document.body.innerText)).slice(0, 400);
  await J.shot('assignments');
  J.step('assignments page rendered', state.assignText.split('\n').filter(Boolean).slice(0, 3).join(' | '));

  // 11. Logout
  await J.logout();
  J.step('logout');

  fs.writeFileSync(path.join(EV('04-persistence'), 'teacher-ops.json'), JSON.stringify({
    upload: { message: state.uploadMsg, aiAdapted: state.aiAdapted, lessonTitle: state.newLessonTitle },
    attendance: { message: state.attMsg, learnersMarked: n, historyExcerpt: state.historyText },
  }, null, 2));
} catch (e) {
  J.fail('journey aborted', e.message);
  try { await J.shot('aborted-state'); } catch {}
}

report('TEACHER JOURNEY', await J.finish());
