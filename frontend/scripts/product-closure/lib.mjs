/**
 * Shared helpers for Elekeza final product-closure browser E2E journeys.
 * Evidence is written to <repo>/e2e-evidence/ (untracked, per closure mandate).
 * No secrets are ever captured: only URL/method/status for network, and
 * console message text (cookie values never appear in either).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../../..'); // repo root
export const EV = (...p) => path.join(ROOT, 'e2e-evidence', ...p);
export const BASE = process.env.E2E_BASE_URL || 'http://localhost:3100';

export class Journey {
  constructor({ name, outDir }) {
    this.name = name;
    this.outDir = outDir;
    this.steps = [];
    this.consoleLines = [];
    this.networkLines = [];
    this.stepNo = 0;
    this.page = null;
    this.context = null;
    this.browser = null;
    this.videoPath = null;
    this.quizIdByLesson = {}; // captured from /quiz/{id}/start responses
  }

  async start() {
    fs.mkdirSync(this.outDir, { recursive: true });
    fs.mkdirSync(EV('07-video'), { recursive: true });
    fs.mkdirSync(EV('08-console'), { recursive: true });
    fs.mkdirSync(EV('09-network'), { recursive: true });
    this.browser = await chromium.launch();
    this.context = await this.browser.newContext({
      viewport: { width: 1366, height: 900 },
      recordVideo: { dir: EV('07-video'), size: { width: 1366, height: 900 } },
    });
    this.context.setDefaultTimeout(20000);
    this.page = await this.context.newPage();

    const p = this.page;
    p.on('console', (msg) => {
      this.consoleLines.push({ ts: new Date().toISOString(), type: msg.type(), text: msg.text().slice(0, 1000) });
    });
    p.on('pageerror', (err) => {
      this.consoleLines.push({ ts: new Date().toISOString(), type: 'pageerror', text: String(err).slice(0, 1000) });
    });
    p.on('response', (resp) => {
      const req = resp.request();
      const url = resp.url();
      const entry = { ts: new Date().toISOString(), method: req.method(), status: resp.status(), url };
      this.networkLines.push(entry);
      // Capture quizId payloads for later review-page persistence checks.
      const m = url.match(/\/api\/quiz\/(\d+)\/start/);
      if (m && resp.status() === 200 && req.method() === 'GET') {
        resp.json().then((j) => { if (j && j.quizId != null) this.quizIdByLesson[m[1]] = j.quizId; }).catch(() => {});
      }
    });
    return this;
  }

  step(name, detail) {
    const rec = { n: ++this.stepNo, name, ok: true, detail: detail ?? '', at: new Date().toISOString() };
    this.steps.push(rec);
    console.log(`  [${this.name}] ${String(rec.n).padStart(2, '0')} OK  ${name}${detail ? ' — ' + detail : ''}`);
    return rec;
  }

  fail(name, detail) {
    const rec = { n: ++this.stepNo, name, ok: false, detail: String(detail).slice(0, 500), at: new Date().toISOString() };
    this.steps.push(rec);
    console.log(`  [${this.name}] ${String(rec.n).padStart(2, '0')} FAIL ${name} — ${rec.detail}`);
    return rec;
  }

  async shot(label) {
    const n = String(this.stepNo).padStart(2, '0');
    const file = path.join(this.outDir, `${this.name[0].toUpperCase()}${n}-${label}.png`);
    await this.page.screenshot({ path: file });
    return path.basename(file);
  }

  /** Login with HMR-bounce retry. Waits for network idle (hydration/mount
   * effects settle) before clicking, otherwise the click hits a non-hydrated
   * form and natively navigates to /login? without calling the API. */
  async login(email, password, homeRe) {
    for (let i = 0; i < 3; i++) {
      try {
        await this.page.goto(BASE + '/login', { waitUntil: 'load', timeout: 60000 });
        await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
        await this.page.getByPlaceholder('Enter your email').fill(email);
        await this.page.getByPlaceholder('Enter your password').fill(password);
        await this.page.getByRole('button', { name: 'Login' }).click();
        await this.page.waitForURL(homeRe, { timeout: 45000 });
        return true;
      } catch (e) {
        if (i === 2) throw e;
      }
    }
    return false;
  }

  async logout() {
    for (let i = 0; i < 3; i++) {
      try {
        await this.page.locator('[aria-label="Logout"]').first().click();
        await this.page.waitForURL(/\/login/, { timeout: 15000 });
        return;
      } catch (e) {
        if (i === 2) throw e;
        // Re-render may have detached the button; settle and retry.
        await this.page.waitForTimeout(1200);
      }
    }
  }

  goto(pathname, opts = {}) {
    return this.page.goto(BASE + pathname, { waitUntil: 'domcontentloaded', timeout: 60000, ...opts });
  }

  /** Parse the learner home level strip. NOTE: the UI shows "N points to
   * Level X" where N = points REMAINING to next level, so derive raw points
   * as level*50 - N (level period = 50 pts, GamificationController). */
  async learnerPoints() {
    await this.page.waitForFunction(
      () => /points to Level \d+/.test(document.body.innerText),
      null,
      { timeout: 30000 }
    );
    const txt = await this.page.evaluate(() => document.body.innerText);
    const m = txt.match(/(\d+) points to Level (\d+)/);
    const lvl = txt.match(/Level (\d+) · ([^·\n]+)/);
    const level = lvl ? Number(lvl[1]) : null;
    const toNext = m ? Number(m[1]) : null;
    return { toNext, points: level && toNext != null ? level * 50 - toNext : null, level, levelName: lvl ? lvl[2].trim() : null };
  }

  async finish() {
    const video = await this.page.video();
    await this.context.close();
    if (video) this.videoPath = await video.path();
    await this.browser.close();

    fs.writeFileSync(path.join(EV('08-console'), `${this.name}.json`), JSON.stringify(this.consoleLines, null, 2));
    const errors = this.consoleLines.filter((l) => l.type === 'error' || l.type === 'pageerror');
    fs.writeFileSync(path.join(EV('08-console'), `${this.name}-errors.txt`),
      errors.length ? errors.map((l) => `[${l.type}] ${l.text}`).join('\n---\n') : '(no console errors)');
    fs.writeFileSync(path.join(EV('09-network'), `${this.name}.ndjson`),
      this.networkLines.map((l) => JSON.stringify(l)).join('\n'));
    const stepsDir = EV('02-user-journeys', this.dirBase());
    fs.mkdirSync(stepsDir, { recursive: true });
    fs.writeFileSync(path.join(stepsDir, `${this.name}-steps.json`), JSON.stringify(this.steps, null, 2));

    if (this.videoPath) {
      const dest = path.join(EV('07-video'), `${this.name}-journey.webm`);
      try { fs.renameSync(this.videoPath, dest); this.videoPath = dest; } catch { /* keep original */ }
    }

    const passed = this.steps.filter((s) => s.ok).length;
    return { journey: this.name, passed, total: this.steps.length, ok: passed === this.steps.length, video: this.videoPath, steps: this.steps };
  }

  dirBase() {
    const map = { learner: 'learner', teacher: 'teacher', guardian: 'guardian', admin: 'admin' };
    return map[this.name] || this.name;
  }
}

export const ROLES = {
  learner: { email: 'student@elekeza.app', password: 'student123', homeRe: /\/student-home/ },
  teacher: { email: 'teacher@elekeza.app', password: 'teacher123', homeRe: /\/teacher/ },
  guardian: { email: 'parent@elekeza.app', password: 'parent123', homeRe: /\/guardian/ },
  admin: { email: 'admin@elekeza.app', password: 'teacher123', homeRe: /\/(admin|school)/ },
};

export function report(label, r) {
  console.log(`\n=== ${label}: ${r.passed}/${r.total} steps OK ===`);
  for (const s of r.steps) if (!s.ok) console.log(`  FAIL #${s.n} ${s.name}: ${s.detail}`);
  if (!r.ok) process.exitCode = 1;
}
