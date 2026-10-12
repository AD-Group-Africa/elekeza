/**
 * Exhibition screenshot capture — standalone Playwright script against the
 * real, already-running stack: FE :3100 (dev, proxies /api -> :8097) and
 * BE :8097 (prod profile) + AI :8001.
 *
 * Run: cd frontend && node scripts/capture-exhibition.mts
 *
 * Credentials are the documented dev-seed demo accounts (fictional data).
 */
import { chromium } from 'playwright-core'
import fs from 'fs'

const BASE = 'http://localhost:3100'
const ROOT = path_FromHere()
const FULL = `${ROOT}/full-page`
const OUT = `${ROOT}`
const MOBILE = `${ROOT}/mobile`

function path_FromHere() {
  // artifacts/exhibition-qa relative to frontend/scripts -> repo root
  return process.cwd().replace(/[\\/]frontend$/, '') + '/artifacts/exhibition-qa'
}

const LEARNER = { email: 'student@elekeza.app', password: 'student123' }
const TEACHER = { email: 'teacher@elekeza.app', password: 'teacher123' }
const GUARDIAN = { email: 'parent@elekeza.app', password: 'parent123' }

const consoleErrors: Record<string, string[]> = {}

async function ensureDirs() {
  fs.mkdirSync(FULL, { recursive: true })
  fs.mkdirSync(MOBILE, { recursive: true })
}

/** Wait for hydration/render, then save viewport + full-page screenshots and log console errors. */
async function shot(page: any, name: string) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${FULL}/${name}.png`, fullPage: true })
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log(`captured ${name}`)
}

async function collectErrors(id: string, page: any) {
  consoleErrors[id] = []
  page.on('console', (msg: any) => { if (msg.type() === 'error') consoleErrors[id].push(msg.text().slice(0, 300)) })
  page.on('pageerror', (err: any) => consoleErrors[id].push('PAGEERROR ' + String(err).slice(0, 300)))
}

const LOGIN_RE = /\/(student-home|teacher|guardian|admin|school)/

async function login(page: any, email: string, password: string) {
  await page.goto(BASE + '/login')
  await page.getByPlaceholder('Enter your email').fill(email)
  await page.getByPlaceholder('Enter your password').fill(password)
  await Promise.all([
    page.waitForURL(LOGIN_RE).catch(() => 'timeout' as const),
    page.getByRole('button', { name: 'Login' }).click(),
  ])
  if (!LOGIN_RE.test(new URL(page.url()).pathname)) {
    const emailBox = page.getByPlaceholder('Enter your email')
    if ((await emailBox.inputValue().catch(() => '')) === '') await emailBox.fill(email)
    const pwBox = page.getByPlaceholder('Enter your password')
    if ((await pwBox.inputValue().catch(() => '')) === '') await pwBox.fill(password)
    await Promise.all([
      page.waitForURL(LOGIN_RE).catch(() => 'timeout' as const),
      page.getByRole('button', { name: 'Login' }).click().catch(() => {}),
    ])
  }
  if (!LOGIN_RE.test(new URL(page.url()).pathname)) throw new Error(`login failed for ${email}`)
}

async function main() {
  ensureDirs()
  const browser = await chromium.launch()
  const results: { journey: string; status: string; notes: string[] }[] = []

  // ---------- Learner journeys (desktop) ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    const page = await ctx.newPage()
    await collectErrors('learner', page)
    const notes: string[] = []
    try {
      await page.goto(BASE + '/login')
      await shot(page, '01-login')
      await login(page, LEARNER.email, LEARNER.password)
      await shot(page, '02-learner-dashboard')
      await page.goto(BASE + '/student-lessons')
      await shot(page, '03-learner-my-lessons')
      // Open the seeded water-cycle lesson (first lesson card)
      const lessonLink = page.locator('a[href*="/lesson/"]').first()
      if (await lessonLink.count()) {
        await lessonLink.click({ timeout: 10_000 }).catch(async () => { await page.goto(BASE + '/lesson/1') })
        await shot(page, '04-lesson-reading')
      } else notes.push('no lesson card found')
      await page.goto(BASE + '/progress')
      await shot(page, '05-learner-progress')
      await page.goto(BASE + '/dashboard/settings')
      await shot(page, '06-accessibility-settings')
      await page.goto(BASE + '/learner/preferences')
      await shot(page, '07-learner-how-i-learn')
      results.push({ journey: 'Learner (dashboard, lessons, lesson reading, progress, a11y)', status: 'captured', notes })
    } catch (e: any) { results.push({ journey: 'Learner', status: 'FAILED', notes: [String(e).slice(0, 200), ...notes] }) }
    await ctx.close()
  }

  // ---------- Teacher journeys (desktop) ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    const page = await ctx.newPage()
    await collectErrors('teacher', page)
    const notes: string[] = []
    try {
      await login(page, TEACHER.email, TEACHER.password)
      await shot(page, '08-teacher-dashboard')
      await page.goto(BASE + '/teacher/students')
      await shot(page, '09-teacher-students')
      await page.goto(BASE + '/teacher-assignments')
      await shot(page, '10-teacher-assignments')
      await page.goto(BASE + '/attendance')
      await shot(page, '11-teacher-attendance')
      await page.goto(BASE + '/teacher/support')
      await shot(page, '12-teacher-support-signals')
      await page.goto(BASE + '/teacher/progress')
      await shot(page, '13-teacher-progress')
      results.push({ journey: 'Teacher (dashboard, students, assignments, attendance, support, progress)', status: 'captured', notes })
    } catch (e: any) { results.push({ journey: 'Teacher', status: 'FAILED', notes: [String(e).slice(0, 200), ...notes] }) }
    await ctx.close()
  }

  // ---------- Guardian journeys (desktop) ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    const page = await ctx.newPage()
    await collectErrors('guardian', page)
    const notes: string[] = []
    try {
      await login(page, GUARDIAN.email, GUARDIAN.password)
      await shot(page, '14-guardian-dashboard')
      await page.goto(BASE + '/guardian/wards')
      await shot(page, '15-guardian-child')
      await page.goto(BASE + '/guardian/reports')
      await shot(page, '16-guardian-reports')
      await page.goto(BASE + '/guardian/communication')
      await shot(page, '17-guardian-communication')
      results.push({ journey: 'Guardian (dashboard, child, reports, communication)', status: 'captured', notes })
    } catch (e: any) { results.push({ journey: 'Guardian', status: 'FAILED', notes: [String(e).slice(0, 200), ...notes] }) }
    await ctx.close()
  }

  // ---------- Messaging round-trip (guardian -> teacher) ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    const page = await ctx.newPage()
    await collectErrors('messaging', page)
    const notes: string[] = []
    try {
      await login(page, GUARDIAN.email, GUARDIAN.password)
      await page.goto(BASE + '/guardian/communication')
      const composer = page.locator('textarea, input[type="text"]').first()
      if (await composer.count()) {
        await composer.fill('Exhibition demo: how is Juma progressing this week?')
        const send = page.getByRole('button', { name: /send/i }).first()
        if (await send.count()) { await send.click().catch(() => {}) } else { await page.keyboard.press('Enter') }
        await page.waitForTimeout(1500)
        await shot(page, '18-guardian-message-sent')
      } else notes.push('no composer found on guardian/communication')
      await login(page, TEACHER.email, TEACHER.password)
      await page.goto(BASE + '/teacher/communication')
      await shot(page, '19-teacher-communication')
      results.push({ journey: 'Messaging round-trip', status: (notes.length ? 'partial' : 'captured'), notes })
    } catch (e: any) { results.push({ journey: 'Messaging', status: 'FAILED', notes: [String(e).slice(0, 200), ...notes] }) }
    await ctx.close()
  }

  // ---------- Mobile views ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    await collectErrors('mobile', page)
    const notes: string[] = []
    try {
      await login(page, LEARNER.email, LEARNER.password)
      await shot(page, 'mobile/20-mobile-learner-dashboard')
      await page.goto(BASE + '/progress')
      await shot(page, 'mobile/21-mobile-learner-progress')
      await login(page, GUARDIAN.email, GUARDIAN.password)
      await shot(page, 'mobile/22-mobile-guardian-dashboard')
      await page.goto(BASE + '/guardian/communication')
      await shot(page, 'mobile/23-mobile-guardian-messages')
      await login(page, TEACHER.email, TEACHER.password)
      await page.goto(BASE + '/attendance')
      await shot(page, 'mobile/24-mobile-teacher-attendance')
      results.push({ journey: 'Mobile (390x844)', status: 'captured', notes })
    } catch (e: any) { results.push({ journey: 'Mobile', status: 'FAILED', notes: [String(e).slice(0, 200), ...notes] }) }
    await ctx.close()
  }

  await browser.close()
  fs.writeFileSync(`${ROOT}/capture-log.json`, JSON.stringify({ results, consoleErrors }, null, 2))
  console.log('\n=== SUMMARY ===')
  for (const r of results) console.log(`${r.status === 'captured' ? 'OK ' : 'ERR'} ${r.journey}${r.notes.length ? ' — ' + r.notes.join(' | ') : ''}`)
  const errs = Object.entries(consoleErrors).filter(([, v]) => v.length)
  console.log(`console errors: ${errs.length ? '' : 'none'}${errs.map(([k, v]) => `\n  ${k}: ${v.length} ${v.slice(0, 3).join(' § ')}`).join('')}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
