import { test, expect } from '@playwright/test'
import { LEARNER, login, offlineQueueCount } from './helpers'

/**
 * Offline / low-connectivity E2E — proves the offline learning loop really
 * works: answers queue in IndexedDB while offline, show a visible offline
 * state, and flush to the server on reconnect with idempotency keys.
 *
 * Scope note: connectivity is lost MID-QUIZ (the realistic failure), not
 * mid-navigation. Reload-while-offline recovery is served by the PWA service
 * worker, which next-pwa registers only on PRODUCTION builds; this suite runs
 * the dev server by design, so SW-cache reload is covered by the production
 * build pipeline (see docs/RELEASE_CANDIDATE_REPORT.md — offline section).
 */

async function openSeededQuiz(page: import('@playwright/test').Page) {
  await login(page, LEARNER.email, LEARNER.password)
  await expect(page).toHaveURL(/student-home/)
  await page.getByRole('link', { name: /Continue learning/i }).first().click()
  await expect(page).toHaveURL(/\/lesson\//)
  const next = page.getByRole('button', { name: 'Next section' })
  while (await next.isVisible().catch(() => false)) {
    await next.click()
    await page.waitForTimeout(150)
  }
  const startPractice = page.getByRole('button', { name: 'Start practice' })
  await expect(startPractice).toBeVisible({ timeout: 15_000 })
  await startPractice.click()
  await page.getByRole('link', { name: /Open practice quiz/i }).click()
  await expect(page).toHaveURL(/\/quiz\//)
  // The quiz must be fully interactive BEFORE we cut connectivity — a fetch
  // that fails offline leaves "Quiz not found", which is correct behavior
  // but not the scenario under test.
  await expect(page.locator('button:has-text("A.")').first()).toBeVisible({ timeout: 30_000 })
}

test('offline learner: queue answers, see saved-offline state, reconnect and sync', async ({ page, context }) => {
  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })

  await openSeededQuiz(page)

  // Lose connectivity mid-quiz: the visible status must tell the truth.
  await context.setOffline(true)
  await expect(page.getByRole('status')).toContainText(/offline/i, { timeout: 15_000 })

  await page.locator('button:has-text("A.")').first().click()
  // The learner is told exactly what happened: saved locally, will sync later.
  await expect(page.getByText(/Saved offline — will sync when you reconnect/i).first()).toBeVisible({ timeout: 15_000 })
  // The answer is genuinely persisted in the local queue, not just shown.
  expect(await offlineQueueCount(page)).toBeGreaterThan(0)

  // Reconnect: the queue flushes to the server on the 'online' event.
  await context.setOffline(false)
  await expect
    .poll(async () => offlineQueueCount(page), { timeout: 30_000, intervals: [500, 1_000, 2_000] })
    .toBe(0)

  const real = consoleErrors.filter((e) => !/favicon|net::|Failed to load resource|ERR_INTERNET|404/.test(e))
  expect(real).toEqual([])
})

test('offline quiz submit stays honest: no fake score while offline', async ({ page, context }) => {
  await openSeededQuiz(page)

  await context.setOffline(true)
  // Answer EVERY question while offline — the Submit button stays disabled
  // until all questions are answered (by design, online and offline alike).
  // The queue-advance happens automatically after each offline answer.
  for (let i = 0; i < 10; i += 1) {
    const option = page.locator('button:has-text("A.")').first()
    if (!(await option.isVisible().catch(() => false))) break
    // Click only if this question is unanswered (an answered one is disabled).
    if (await option.isEnabled().catch(() => false)) {
      await option.click()
      await page.waitForTimeout(900) // the offline path advances after ~700ms
    } else {
      break
    }
  }
  await page.waitForTimeout(500)

  // Submitting while offline must NOT fabricate a completion — the learner is
  // told to submit again once reconnected (the server owns scoring).
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByText(/saved locally|saved offline/i).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Quiz Complete!')).toHaveCount(0)
})
