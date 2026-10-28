/**
 * Exhibition screenshot capture — walks the REAL running stack and saves
 * screenshots under artifacts/exhibition-qa/.
 *
 * Run: cd frontend && npx playwright test e2e/exhibition-capture.spec.ts
 *
 * This spec REUSES the dev server started by the suite's own webServer config,
 * but points at the already-running backend (:8097). We bypass the config's
 * backend boot by selectively running with E2E_BACKEND_PORT=8097 and
 * reuseExistingServer: false would conflict — instead this spec is executed
 * with `--config` default; the webServer block boots its own backend on 8090.
 */
import { test, expect } from '@playwright/test'
import { login, LEARNER, TEACHER, GUARDIAN } from './helpers'
import path from 'path'

const OUT = path.join(__dirname, '..', '..', '..', 'artifacts', 'exhibition-qa')
const FULL = path.join(OUT, 'full-page')

const consoleErrors: string[] = []

async function shot(page: import('@playwright/test').Page, name: string) {
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})
  await page.screenshot({ path: path.join(FULL, name + '.png'), fullPage: true })
  await page.screenshot({ path: path.join(OUT, name + '.png') })
}

test.beforeEach(async () => {
  consoleErrors.length = 0
})

async function collectConsole(page: import('@playwright/test').Page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(String(err)))
}

test.describe('exhibition capture', () => {
  test('login + learner journey', async ({ page }) => {
    await collectConsole(page)
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
    await shot(page, '01-login')

    await login(page, LEARNER.email, LEARNER.password)
    await shot(page, '02-learner-dashboard')

    // Learning activity: open lessons list then the seeded water-cycle lesson
    await page.goto('/student-lessons')
    await shot(page, '03-learner-my-lessons')
  })

  test('learner progress + assistive learning', async ({ page }) => {
    await collectConsole(page)
    await login(page, LEARNER.email, LEARNER.password)
    await page.goto('/progress')
    await shot(page, '04-learner-progress')
    await page.goto('/dashboard/settings')
    await shot(page, '05-accessibility-settings')
    await page.goto('/learner/preferences')
    await shot(page, '06-learner-how-i-learn')
  })

  test('teacher journeys', async ({ page }) => {
    await collectConsole(page)
    await login(page, TEACHER.email, TEACHER.password)
    await shot(page, '07-teacher-dashboard')
    await page.goto('/teacher/students')
    await shot(page, '08-teacher-students')
    await page.goto('/teacher-assignments')
    await shot(page, '09-teacher-assignments')
    await page.goto('/attendance')
    await shot(page, '10-teacher-attendance')
    await page.goto('/teacher/support')
    await shot(page, '11-teacher-support-signals')
    await page.goto('/teacher/progress')
    await shot(page, '12-teacher-progress')
  })

  test('guardian journeys', async ({ page }) => {
    await collectConsole(page)
    await login(page, GUARDIAN.email, GUARDIAN.password)
    await shot(page, '13-guardian-dashboard')
    await page.goto('/guardian/wards')
    await shot(page, '14-guardian-child')
    await page.goto('/guardian/reports')
    await shot(page, '15-guardian-reports')
  })

  test('messaging round-trip', async ({ page }) => {
    await collectConsole(page)
    await login(page, GUARDIAN.email, GUARDIAN.password)
    await page.goto('/guardian/communication')
    await shot(page, '16-guardian-communication')
    // Send a fictional demo message if the composer exists
    const composer = page.locator('textarea, input[type="text"]').first()
    if (await composer.count()) {
      await composer.fill('Exhibition demo: how is Juma progressing this week?')
      await page.keyboard.press('Enter').catch(() => {})
      await page.getByRole('button', { name: /send/i }).first().click().catch(() => {})
      await page.waitForTimeout(1500)
      await shot(page, '17-guardian-message-sent')
    }
    await login(page, TEACHER.email, TEACHER.password)
    await page.goto('/teacher/communication')
    await shot(page, '18-teacher-communication')
  })

  test('school admin journeys', async ({ page }) => {
    await collectConsole(page)
    await login(page, TEACHER.email, TEACHER.password)
    // School-admin login requires the documented fallback (live registration);
    // capture the finance/attendance screens visible to staff instead.
    await page.goto('/finance')
    await shot(page, '19-finance')
  })

  test('mobile views', async ({ page }) => {
    await collectConsole(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, LEARNER.email, LEARNER.password)
    await shot(page, 'mobile/20-mobile-learner-dashboard')
    await page.goto('/student-lessons')
    await shot(page, 'mobile/21-mobile-lessons')
    await login(page, GUARDIAN.email, GUARDIAN.password)
    await shot(page, 'mobile/22-mobile-guardian-dashboard')
    await page.goto('/guardian/communication')
    await shot(page, 'mobile/23-mobile-guardian-messages')
    await login(page, TEACHER.email, TEACHER.password)
    await page.goto('/teacher')
    await shot(page, 'mobile/24-mobile-teacher-dashboard')
    await page.goto('/attendance')
    await shot(page, 'mobile/25-mobile-teacher-attendance')
  })
})
