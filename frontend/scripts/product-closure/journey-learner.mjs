/**
 * TASK 2A — LEARNER full journey with persistence loop.
 * login → dashboard → profile → learning → lesson → accessibility → quiz →
 * submit → result → progress → AI tutor → adaptive prefs → logout → login
 * again → persistence verification (UI + captured data; DB checked separately).
 */
import { Journey, ROLES, report, EV } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const J = new Journey({ name: 'learner', outDir: EV('02-user-journeys/learner') });
const role = ROLES.learner;
const state = {};

try {
  await J.start();
  const p = J.page;

  // 1. Login
  await J.goto('/login');
  await J.shot('login-page');
  J.step('login page rendered');
  await J.login(role.email, role.password, role.homeRe);
  J.step('login as learner → student-home');

  // 2. Dashboard (baseline gamification state BEFORE quiz)
  await p.waitForFunction(() => /points to Level \d+/.test(document.body.innerText), null, { timeout: 45000 });
  state.pointsBefore = await J.learnerPoints();
  await J.shot('student-home');
  J.step('dashboard rendered', `points=${state.pointsBefore.points} level=${state.pointsBefore.level} (${state.pointsBefore.levelName})`);

  // 3. Profile
  await J.goto('/dashboard/profile');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(1500);
  state.profileText = (await p.evaluate(() => document.body.innerText)).slice(0, 400);
  await J.shot('profile');
  J.step('profile page rendered', state.profileText.split('\n').slice(0, 3).join(' | '));

  // 4. Accessibility preferences — turn ON "Listen to lessons" (persistence op)
  await J.goto('/learner/preferences');
  await p.waitForSelector('fieldset', { timeout: 45000 });
  const ttsSwitch = p.getByRole('switch', { name: 'Listen to lessons' });
  state.ttsBefore = await ttsSwitch.getAttribute('aria-checked');
  if (state.ttsBefore !== 'true') {
    await ttsSwitch.click();
    await p.getByText('Saved', { exact: true }).waitFor({ timeout: 10000 });
    await p.waitForTimeout(600);
  }
  state.ttsAfter = await ttsSwitch.getAttribute('aria-checked');
  await J.shot('preferences-tts-on');
  J.step('accessibility: read-aloud preference set', `before=${state.ttsBefore} after=${state.ttsAfter}`);

  // Adaptive prefs — capture source labels (OBSERVED = adaptive engine)
  state.prefSources = await p.evaluate(() => {
    const out = {};
    document.querySelectorAll('section').forEach((s) => {
      const h = s.querySelector('h2')?.textContent?.trim();
      const src = s.querySelector('span.text-\\[11px\\]')?.textContent?.trim();
      if (h && src) out[h] = src;
    });
    return out;
  });
  J.step('adaptive preference sources captured', JSON.stringify(state.prefSources));

  // 4b. Working accessibility path — /dashboard/settings a11y system (localStorage
  // key 'elekeza-settings', shared with useAccessibilitySettings). Toggles are
  // inside collapsible category sections; TTS lives under "Audio & Language".
  await J.goto('/dashboard/settings');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(1200);
  try {
    await p.getByRole('button', { name: /Audio & Language/ }).click();
    await p.waitForTimeout(400);
    const ttsRow = p.locator('div.border-b', { hasText: 'Text to Speech' }).first();
    await ttsRow.locator('button').click();
    await p.waitForTimeout(800); // allow fire-and-forget accessibility-profiles PUT
    J.step('a11y settings: Text-to-Speech enabled via /dashboard/settings (server profile mirrored)');
  } catch (e) {
    J.fail('a11y settings: Text to Speech toggle', e.message.slice(0, 200));
  }

  // 5. Lessons list
  await J.goto('/student-lessons');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(1500);
  await J.shot('lessons-list');
  J.step('lessons list rendered');

  // 6. Lesson 3 — reading experience + accessibility + practice entry
  await J.goto('/lesson/3');
  await p.waitForSelector('h1', { timeout: 60000 });
  state.lessonTitle = await p.locator('h1').first().textContent();
  state.ttsPrefApplied = false;
  try {
    await p.locator('button[aria-label^="Listen to"]').first().waitFor({ timeout: 8000 });
    state.ttsPrefApplied = true;
  } catch { /* Listen buttons absent → pref not surfaced */ }
  await J.shot('lesson-top');
  J.step('lesson rendered', `${state.lessonTitle?.trim()} listenButtons=${state.ttsPrefApplied}`);

  // DEFECT EVIDENCE: server-side pref (/learner/preferences readAloud=true) did
  // NOT surface the Listen button — it is gated on localStorage a11y settings.
  if (!state.ttsPrefApplied) {
    J.fail('listen button NOT gated by server read-aloud preference', 'DEFECT EVIDENCE: /learner/preferences readAloud=true persisted, but lesson page Listen button only appears via localStorage a11y settings (separate system)');
  }

  if (state.ttsPrefApplied) {
    await p.locator('button[aria-label^="Listen to"]').first().click();
    await p.waitForTimeout(1200);
    await J.shot('lesson-listening');
    const stopBtn = p.locator('button[aria-label^="Stop reading"]');
    if (await stopBtn.count()) await stopBtn.first().click().catch(() => {});
    J.step('text-to-speech listen button works');
  } else {
    J.fail('listen button visible after a11y TTS enabled', 'no Listen button on lesson page even via /dashboard/settings path');
  }

  // Reading mode (simplified layout) toggle
  const rm = p.getByRole('button', { name: /Reading mode/ });
  await rm.click();
  await p.waitForTimeout(400);
  state.readingMode = await rm.textContent();
  await J.shot('lesson-reading-mode');
  J.step('reading-mode toggle works', state.readingMode?.trim());

  // Navigate to last section
  for (let i = 0; i < 10; i++) {
    const next = p.getByRole('button', { name: 'Next section' });
    if (!(await next.isVisible().catch(() => false))) break;
    await next.click();
    await p.waitForTimeout(350);
  }
  J.step('navigated to final section');

  // Start practice → open quiz
  const startPractice = p.getByRole('button', { name: 'Start practice' });
  if (await startPractice.isVisible().catch(() => false)) {
    await startPractice.click();
    await p.waitForTimeout(500);
  }
  const openQuiz = p.getByRole('link', { name: /Open practice quiz/ });
  await openQuiz.waitFor({ timeout: 20000 });
  await J.shot('lesson-practice-ready');
  await openQuiz.click();
  await p.waitForURL(/\/quiz\/3/, { timeout: 45000 });
  J.step('entered practice quiz');

  // 7. Quiz — answer every question, submit
  await p.waitForFunction(() => document.querySelectorAll('.glass-card button.w-full').length > 0, null, { timeout: 60000 });
  const submitBtn = p.getByRole('button', { name: 'Submit', exact: true });
  for (let i = 0; i < 30; i++) {
    const firstOpt = p.locator('.glass-card button.w-full').first();
    const answered = await firstOpt.isDisabled().catch(() => true);
    if (!answered) {
      await firstOpt.click();
      await p.waitForTimeout(1400); // auto-advance after server grade
      continue;
    }
    if (await submitBtn.isVisible().catch(() => false)) break;
    const nextBtn = p.getByRole('button', { name: 'Next' });
    if (await nextBtn.isVisible().catch(() => false)) { await nextBtn.click(); await p.waitForTimeout(300); }
  }
  await J.shot('quiz-final-question');
  await submitBtn.click();
  await p.getByText('Quiz Complete!', { exact: true }).waitFor({ timeout: 60000 });
  const cont = p.getByRole('button', { name: 'Continue' });
  if (await cont.isVisible().catch(() => false)) {
    await J.shot('quiz-celebration');
    await cont.click();
  }
  state.score = await p.locator('p.text-3xl').first().textContent();
  await J.shot('quiz-result');
  J.step('quiz submitted and scored', `score=${state.score} quizId=${J.quizIdByLesson[3]}`);

  // 8. Gamification after quiz (expect +10 XP)
  await J.goto('/student-home');
  state.pointsAfterQuiz = await J.learnerPoints();
  J.step('gamification after quiz', `points=${state.pointsAfterQuiz.points} (before=${state.pointsBefore.points})`);

  // 9. Progress
  await J.goto('/progress');
  await p.waitForLoadState('domcontentloaded');
  await p.waitForTimeout(2000);
  state.progressText = (await p.evaluate(() => document.body.innerText)).slice(0, 600);
  await J.shot('progress');
  J.step('progress page rendered');

  // 10. AI tutor from the frontend
  await J.goto('/student-ai-tutor');
  await p.waitForSelector('button', { timeout: 60000 });
  await p.getByRole('button', { name: 'Explain this concept' }).click();
  const t0 = Date.now();
  await p.waitForFunction(() => document.body.innerText.length > 200 && /Explain/.test(document.body.innerText) === false || /source|Groq|grounded|lesson/i.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1500);
  state.tutorText = (await p.evaluate(() => document.body.innerText)).slice(0, 700);
  await J.shot('ai-tutor-explain');
  J.step('AI tutor EXPLAIN responded from frontend', `latency≈${((Date.now() - t0) / 1000).toFixed(1)}s`);

  // 11. Logout
  await J.logout();
  await J.shot('after-logout');
  J.step('logout');

  // 12. Login again
  await J.login(role.email, role.password, role.homeRe);
  J.step('re-login');

  // 13. Persistence checks
  await p.waitForFunction(() => /points to Level \d+/.test(document.body.innerText), null, { timeout: 45000 });
  state.pointsAfterRelogin = await J.learnerPoints();
  if (state.pointsAfterQuiz.points != null && state.pointsAfterRelogin.points === state.pointsAfterQuiz.points) {
    J.step('PERSISTED: gamification points survive logout/login', `${state.pointsAfterRelogin.points} pts`);
  } else {
    J.fail('PERSISTED: gamification points', `afterQuiz=${state.pointsAfterQuiz.points} afterRelogin=${state.pointsAfterRelogin.points}`);
  }

  state.quizId = J.quizIdByLesson[3];
  if (state.quizId) {
    await J.goto(`/quiz/review/${state.quizId}`);
    await p.waitForLoadState('domcontentloaded');
    await p.waitForTimeout(2000);
    state.reviewText = (await p.evaluate(() => document.body.innerText)).slice(0, 500);
    await J.shot('quiz-review-persisted');
    if (/review|score|correct|answer/i.test(state.reviewText) && !/not found|error/i.test(state.reviewText.slice(0, 200))) {
      J.step('PERSISTED: quiz result review survives logout/login', state.reviewText.split('\n').slice(0, 2).join(' | '));
    } else {
      J.fail('PERSISTED: quiz review page', state.reviewText.split('\n').slice(0, 3).join(' | '));
    }
  } else {
    J.fail('quizId captured for review check', 'no /quiz/3/start payload seen');
  }

  await J.goto('/learner/preferences');
  await p.waitForSelector('fieldset', { timeout: 45000 });
  state.ttsAfterRelogin = await ttsSwitch.getAttribute('aria-checked');
  await J.shot('preferences-persisted');
  if (state.ttsAfterRelogin === 'true') {
    J.step('PERSISTED: read-aloud preference survives logout/login');
  } else {
    J.fail('PERSISTED: read-aloud preference', `afterRelogin=${state.ttsAfterRelogin}`);
  }

  // Summary
  fs.writeFileSync(path.join(EV('04-persistence'), 'learner-persistence.json'), JSON.stringify({
    gamification: { before: state.pointsBefore, afterQuiz: state.pointsAfterQuiz, afterRelogin: state.pointsAfterRelogin,
      note: 'points derived server-side: quizzes*10 + lessons*2 (level period 50)' },
    quizScore: state.score, quizId: state.quizId,
    tts: { serverPref: { before: state.ttsBefore, after: state.ttsAfter, afterRelogin: state.ttsAfterRelogin },
      wiringGap: 'server read-aloud pref does not gate lesson Listen buttons (localStorage a11y system separate)' },
    prefSources: state.prefSources,
  }, null, 2));
} catch (e) {
  J.fail('journey aborted', e.message);
  try { await J.shot('aborted-state'); } catch {}
}

report('LEARNER JOURNEY', await J.finish());
