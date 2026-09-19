import { test, expect } from '@playwright/test'
import { TEACHER, login } from './helpers'

/**
 * Attendance + Finance E2E — real backend, seeded demo data
 * (AttendanceFinanceSeed creates classes, enrollment, attendance history
 * and fee/charges/payments when SHOWCASE_SEED=1).
 */

test.describe('Attendance register (teacher)', () => {
  test('teacher marks and saves the register, then sees counts', async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password)
    await page.goto('/attendance')

    // Class picker must exist and have a seeded class.
    const classSelect = page.getByLabel('Class')
    await expect(classSelect).toBeVisible()
    await expect(classSelect).not.toBeEmpty()

    // Roster should list learners (seed enrolls showcase learners).
    const groups = page.getByRole('radiogroup')
    await expect(groups.first()).toBeVisible({ timeout: 15000 })

    // Mark every learner PRESENT via their radio group.
    const count = await groups.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await groups.nth(i).getByRole('radio', { name: 'PRESENT' }).click()
    }

    await page.getByRole('button', { name: 'Save register' }).click()
    await expect(page.getByRole('status')).toContainText('Saved.')
    await expect(page.getByRole('status')).toContainText('Present')
  })

  test('learner attendance history is reachable from the register', async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password)
    // Post-login the app may still be hydrating its auth cookie on first paint;
    // wait for the register to actually render before interacting.
    await page.goto('/attendance')
    await expect(page.getByRole('radiogroup').first()).toBeVisible({ timeout: 45000 })
    await page.getByRole('button', { name: 'History' }).first().click()
    await expect(page.getByRole('heading', { name: /history/i })).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Finance (guardian)', () => {
  test('guardian sees ward fees, balances and payment history', async ({ page }) => {
    await login(page, 'parent@elekeza.app', 'parent123')
    await page.goto('/guardian/fees')

    // Seed gives Juma three charges (Tuition/Meals/Transport) — the page
    // renders KES amounts either way, and the history heading always shows.
    await expect(page.getByRole('heading', { name: 'Fees' })).toBeVisible()
    await expect(page.getByText('KES').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Payment history' })).toBeVisible()
  })
})

test.describe('Finance (school admin)', () => {
  // The dev seed has no standing SCHOOL_ADMIN account; create one through the
  // REAL school onboarding flow (/school/onboarding → POST /institutions/register),
  // which is the only path that actually creates a SCHOOL_ADMIN + institution.
  // (/register creates a STUDENT regardless of the role picker — by design.)
  const stamp = Date.now()
  const schoolEmail = `e2e-fin-${stamp}@elekeza-e2e.test`

  test('school onboarding creates SCHOOL_ADMIN; finance dashboard shows honest zeros', async ({ page }) => {
    await page.goto('/school/onboarding')

    // Step 1 — school details (county is a select)
    await page.getByPlaceholder(/Nairobi Primary School/i).fill(`E2E Finance Academy ${stamp}`)
    await page.locator('select').first().selectOption('Primary School')
    await page.locator('select').nth(1).selectOption('Nairobi')
    await page.getByRole('button', { name: 'Next →' }).click()

    // Step 2 — admin account
    await page.getByPlaceholder(/alice wanjiku/i).fill('Fin E2E Admin')
    await page.getByPlaceholder(/admin@school\.ke/i).fill(schoolEmail)
    await page.locator('input[type="password"]').fill('FinTest123!')
    await page.getByRole('button', { name: /review/i }).click()

    // Step 3 — confirm + create
    await page.getByRole('button', { name: /create school/i }).click()
    await page.waitForURL(/login/, { timeout: 20000 })

    // Log in as the new school admin and open finance.
    await page.getByPlaceholder('Enter your email').fill(schoolEmail)
    await page.getByPlaceholder('Enter your password').fill('FinTest123!')
    await page.getByRole('button', { name: 'Login' }).click()
    await page.waitForTimeout(2000)
    await page.goto('/finance')

    await expect(page.getByRole('heading', { name: 'Finance' })).toBeVisible()
    // Empty school: the dashboard still renders honest zero figures.
    await expect(page.getByText('KES 0').first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('M-Pesa:')).toBeVisible()
  })
})
