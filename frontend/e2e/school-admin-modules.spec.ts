import { test, expect } from '@playwright/test'
import { SCHOOL_ADMIN, ADMIN, login } from './helpers'

/**
 * School-admin and platform-admin module acceptance.
 *
 * Before this spec, SCHOOL_ADMIN was only ever exercised by onboarding a
 * brand-new empty school — which proves the zero-state renders but not that a
 * single admin screen shows real persisted data. The dev seed now carries
 * `schooladmin@elekeza.app` attached to the demo institution, so every entry
 * in that role's real sidebar can be checked against seeded records.
 *
 * The destinations below mirror `frontend/src/config/navigation.ts`
 * (SCHOOL_ADMIN). Keep them in sync with that file, not with a hand-written URL
 * list: the point is to prove the navigation the role actually sees works.
 */

const SCHOOL_ADMIN_ROUTES = [
  '/admin',
  '/admin/staff',
  '/admin/learners',
  '/school/import',
  '/classes',
  '/curriculum',
  '/finance',
  '/attendance',
  '/calendar',
  '/admin/devices',
  '/analytics',
]

const PLATFORM_ROUTES = ['/super-admin']

/** Seeded facts that must survive the round trip through the database. */
const SEEDED_TEACHER = 'Alice Mwalimu'
const SEEDED_LEARNER = 'Juma Ali'

async function assertPageLoads(page: import('@playwright/test').Page, route: string) {
  const response = await page.goto(route, { timeout: 90_000 })
  expect(response?.status() ?? 200, `${route} returned ${response?.status()}`).toBeLessThan(500)
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {})

  const body = await page.locator('body').innerText({ timeout: 20_000 }).catch(() => '')
  expect(body.trim().length, `${route} rendered a blank page`).toBeGreaterThan(0)
  expect(body, `${route} rendered a crash page`).not.toMatch(/application error|internal server error/i)
}

test.describe('school administrator modules', () => {
  test('every school-admin navigation destination loads for a SCHOOL_ADMIN', async ({ page }) => {
    await login(page, SCHOOL_ADMIN.email, SCHOOL_ADMIN.password)
    for (const route of SCHOOL_ADMIN_ROUTES) await assertPageLoads(page, route)
  })

  test('staff and learner lists show the seeded records, not placeholders', async ({ page }) => {
    await login(page, SCHOOL_ADMIN.email, SCHOOL_ADMIN.password)

    await page.goto('/admin/staff')
    await expect(page.getByText(SEEDED_TEACHER).first()).toBeVisible({ timeout: 30_000 })

    await page.goto('/admin/learners')
    await expect(page.getByText(SEEDED_LEARNER).first()).toBeVisible({ timeout: 30_000 })
  })

  test('finance dashboard renders monetary figures for the institution', async ({ page }) => {
    await login(page, SCHOOL_ADMIN.email, SCHOOL_ADMIN.password)
    await page.goto('/finance')
    await expect(page.getByText(/KES/).first()).toBeVisible({ timeout: 30_000 })
  })

  test('attendance register is reachable for a school administrator', async ({ page }) => {
    await login(page, SCHOOL_ADMIN.email, SCHOOL_ADMIN.password)
    await page.goto('/attendance')
    // Either a class picker or an explicit empty state is acceptable; a blank
    // body or a crash is not.
    await expect(page.locator('body')).not.toHaveText('', { timeout: 30_000 })
  })
})

test.describe('platform administrator modules', () => {
  test('platform admin reaches every platform destination', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password)
    for (const route of PLATFORM_ROUTES) await assertPageLoads(page, route)
  })

  test('school admin can not reach the platform-only page', async ({ page }) => {
    await login(page, SCHOOL_ADMIN.email, SCHOOL_ADMIN.password)
    await page.goto('/super-admin')
    // The role guard keeps the user on a permitted page (or shows a refusal),
    // but must never render the platform console.
    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/platform administration/i)
  })
})
