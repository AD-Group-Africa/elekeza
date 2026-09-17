import { test, expect } from '@playwright/test'
import { LEARNER, TEACHER, GUARDIAN, login } from './helpers'

/**
 * Route-crawl release gate.
 *
 * Method: rather than guessing URLs, the crawler collects every internal link
 * actually rendered on each role's real navigation surfaces, then visits each
 * destination once and asserts the page did not crash (no Next 500 page, no
 * blank body, no client exception). This mirrors what the mission asked for:
 * "extract internal navigation links" from the real UI, not a URL list.
 *
 * NOTE: this intentionally runs against the dev seed, so it cannot assert on
 * deep detail pages keyed to real ids beyond what the UI links to.
 */

const LEARNER_SURFACES = ['/student-home', '/student-lessons', '/progress', '/student-exams', '/learner/preferences']
const TEACHER_SURFACES = ['/teacher/students', '/teacher/progress']
const GUARDIAN_SURFACES = ['/guardian']

async function collectLinks(page: import('@playwright/test').Page, surfaces: string[]): Promise<string[]> {
  const links = new Set<string>()
  for (const surface of surfaces) {
    await page.goto(surface)
    await page.waitForLoadState('networkidle').catch(() => {})
    const hrefs = await page.locator('a[href^="/"]').evaluateAll((els) =>
      els.map((el) => (el as HTMLAnchorElement).getAttribute('href') || '').filter((h) => h.length > 1)
    )
    hrefs.forEach((h) => links.add(h))
  }
  return [...links]
}

test.describe('learner route crawl', () => {
  test('every learner-reachable link loads without a crash', async ({ page }) => {
    await login(page, LEARNER.email, LEARNER.password)
    const links = await collectLinks(page, LEARNER_SURFACES)
    expect(links.length, `expected to discover links, got: ${links.join(', ')}`).toBeGreaterThan(0)

    const crashes: string[] = []
    for (const link of links) {
      const response = await page.goto(link)
      // A crash surfaces as a 500 response or the Next.js error page.
      if (response && response.status() >= 500) crashes.push(`${link} → HTTP ${response.status()}`)
      await page.waitForLoadState('networkidle').catch(() => {})
      const bodyText = await page.locator('body').innerText().catch(() => '')
      if (/application error|internal server error/i.test(bodyText)) crashes.push(`${link} → crash page`)
      if (bodyText.trim().length === 0) crashes.push(`${link} → blank page`)
    }
    expect(crashes, crashes.join('\n')).toEqual([])
  })
})

test.describe('teacher route crawl', () => {
  test('every teacher-reachable link loads without a crash', async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password)
    const links = await collectLinks(page, TEACHER_SURFACES)
    expect(links.length).toBeGreaterThan(0)

    const crashes: string[] = []
    for (const link of links) {
      const response = await page.goto(link)
      if (response && response.status() >= 500) crashes.push(`${link} → HTTP ${response.status()}`)
      await page.waitForLoadState('networkidle').catch(() => {})
      const bodyText = await page.locator('body').innerText().catch(() => '')
      if (/application error|internal server error/i.test(bodyText)) crashes.push(`${link} → crash page`)
      if (bodyText.trim().length === 0) crashes.push(`${link} → blank page`)
    }
    expect(crashes, crashes.join('\n')).toEqual([])
  })
})

test.describe('guardian route crawl', () => {
  test('every guardian-reachable link loads without a crash', async ({ page }) => {
    await login(page, GUARDIAN.email, GUARDIAN.password)
    const links = await collectLinks(page, GUARDIAN_SURFACES)
    expect(links.length).toBeGreaterThan(0)

    const crashes: string[] = []
    for (const link of links) {
      const response = await page.goto(link)
      if (response && response.status() >= 500) crashes.push(`${link} → HTTP ${response.status()}`)
      await page.waitForLoadState('networkidle').catch(() => {})
      const bodyText = await page.locator('body').innerText().catch(() => '')
      if (/application error|internal server error/i.test(bodyText)) crashes.push(`${link} → crash page`)
      if (bodyText.trim().length === 0) crashes.push(`${link} → blank page`)
    }
    expect(crashes, crashes.join('\n')).toEqual([])
  })
})
