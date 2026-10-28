import { test, expect, type Page } from '@playwright/test'
import { GUARDIAN, LEARNER, TEACHER, login } from './helpers'

/**
 * theme system and role guard, end to end against the real backend.
 *
 * - a theme chosen in settings survives reloads and navigation, and is
 *   already on <html> before react hydrates (no flash)
 * - the theme saved to the account is restored on sign-in on another device
 * - each role gets its own colour family
 * - opening another role's page shows the guard panel and fires none of that
 *   page's api requests
 */

const ADMIN = { email: 'admin@elekeza.app', password: 'admin123' }

const htmlAttr = (page: Page, name: string) => page.evaluate((n) => document.documentElement.getAttribute(n), name)

test.describe('theme preferences', () => {
  test('light mode chosen in settings survives reload and navigation', async ({ page }) => {
    await login(page, LEARNER.email, LEARNER.password)
    await page.goto('/dashboard/settings')
    await page.getByRole('button', { name: /appearance/i }).click()
    const light = page.getByRole('switch', { name: 'Light Theme' })
    await light.click()
    await expect(light).toHaveAttribute('aria-checked', 'true')
    expect(await htmlAttr(page, 'data-theme')).toBe('light')

    // the pre-paint script must restore it before hydration
    await page.reload({ waitUntil: 'domcontentloaded' })
    expect(await htmlAttr(page, 'data-theme')).toBe('light')
    expect(await htmlAttr(page, 'data-role')).toBe('learner')

    await page.goto('/student-lessons')
    await expect(page.locator('#main-content')).toBeVisible()
    expect(await htmlAttr(page, 'data-theme')).toBe('light')

    // calm wins over light so sne learners keep the low-stimulation mode
    await page.goto('/dashboard/settings')
    await page.getByRole('button', { name: /appearance/i }).click()
    await page.getByRole('switch', { name: 'Calm Mode' }).click()
    await page.reload({ waitUntil: 'domcontentloaded' })
    expect(await htmlAttr(page, 'data-theme')).toBe('calm')
  })

  test('the theme saved to the account follows the learner to a new device', async ({ page, browser }) => {
    await login(page, LEARNER.email, LEARNER.password)
    await page.goto('/dashboard/settings')
    await page.getByRole('button', { name: /appearance/i }).click()
    const saved = page.waitForResponse((r) => r.url().includes('/api/accessibility-profiles/') && r.request().method() === 'PUT')
    const light = page.getByRole('switch', { name: 'Light Theme' })
    if ((await light.getAttribute('aria-checked')) !== 'true') await light.click()
    const calm = page.getByRole('switch', { name: 'Calm Mode' })
    if ((await calm.getAttribute('aria-checked')) === 'true') await calm.click()
    expect((await saved).ok()).toBe(true)

    // a fresh browser has nothing stored locally, so the theme must come from the account
    const other = await browser.newContext()
    const page2 = await other.newPage()
    await login(page2, LEARNER.email, LEARNER.password)
    await expect.poll(() => htmlAttr(page2, 'data-theme')).toBe('light')
    await other.close()
  })

  for (const [account, palette] of [
    [LEARNER, 'learner'],
    [TEACHER, 'teacher'],
    [GUARDIAN, 'guardian'],
    [ADMIN, 'admin'],
  ] as const) {
    test(`${account.email} gets the ${palette} colour family`, async ({ page }) => {
      await login(page, account.email, account.password)
      await expect.poll(() => htmlAttr(page, 'data-role')).toBe(palette)
      await page.reload({ waitUntil: 'domcontentloaded' })
      expect(await htmlAttr(page, 'data-role')).toBe(palette)
    })
  }
})

test.describe('role guard', () => {
  test("a learner opening a school admin page sees the guard and no admin api is called", async ({ page }) => {
    await login(page, LEARNER.email, LEARNER.password)
    const adminCalls: string[] = []
    page.on('request', (req) => {
      const path = new URL(req.url()).pathname
      if (/^\/api\/(institutions|analytics\/admin|finance)/.test(path)) adminCalls.push(path)
    })
    await page.goto('/admin/staff')
    await expect(page.getByText("This page isn't part of your account")).toBeVisible()
    await page.getByRole('link', { name: 'Go to my dashboard' }).click()
    await expect(page).toHaveURL(/\/student-home$/)
    expect(adminCalls).toEqual([])
  })

  test('a teacher can not open guardian or finance pages', async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password)
    for (const path of ['/guardian', '/finance']) {
      await page.goto(path)
      await expect(page.getByText("This page isn't part of your account")).toBeVisible()
    }
  })
})
