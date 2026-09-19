import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '@playwright/test'
import { LEARNER, TEACHER, GUARDIAN, login } from './helpers'

/**
 * Accessibility gate — axe-core (WCAG 2.1 AA ruleset) on the critical
 * authenticated surfaces, per role. These complement the manual keyboard /
 * screen-reader checks documented in docs/ACCESSIBILITY.md; they are the
 * automated floor, not the whole claim.
 */

async function scan(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  // 'incomplete' needs human judgement and is reported separately; failures
  // are hard gate violations.
  return { violations: results.violations, incomplete: results.incomplete }
}

test.describe('learner surfaces (WCAG 2.1 AA, automated)', () => {
  test('login page', async ({ page }) => {
    await page.goto('/login')
    const { violations } = await scan(page)
    expect(violations, JSON.stringify(violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target) })), null, 2)).toEqual([])
  })

  test('learner home', async ({ page }) => {
    await login(page, LEARNER.email, LEARNER.password)
    await expect(page).toHaveURL(/student-home/)
    await page.waitForLoadState('networkidle').catch(() => {})
    const { violations } = await scan(page)
    expect(violations, JSON.stringify(violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target) })), null, 2)).toEqual([])
  })

  test('progress page (mastery: what to do next)', async ({ page }) => {
    await login(page, LEARNER.email, LEARNER.password)
    await page.goto('/progress')
    await expect(page.getByRole('heading', { name: 'My Progress' })).toBeVisible()
    await page.waitForLoadState('networkidle').catch(() => {})
    const { violations } = await scan(page)
    expect(violations, JSON.stringify(violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target) })), null, 2)).toEqual([])
  })

  test('learner preferences page', async ({ page }) => {
    await login(page, LEARNER.email, LEARNER.password)
    await page.goto('/learner/preferences')
    await expect(page.getByRole('heading', { name: 'Make lessons work for you' })).toBeVisible()
    await page.waitForLoadState('networkidle').catch(() => {})
    const { violations } = await scan(page)
    expect(violations, JSON.stringify(violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target) })), null, 2)).toEqual([])
  })

  test('exams page', async ({ page }) => {
    await login(page, LEARNER.email, LEARNER.password)
    await page.goto('/student-exams')
    await expect(page.getByRole('heading', { name: 'My Exams' })).toBeVisible()
    await page.waitForLoadState('networkidle').catch(() => {})
    const { violations } = await scan(page)
    expect(violations, JSON.stringify(violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target) })), null, 2)).toEqual([])
  })
})

test.describe('teacher + guardian surfaces (WCAG 2.1 AA, automated)', () => {
  test('teacher students page', async ({ page }) => {
    await login(page, TEACHER.email, TEACHER.password)
    await page.goto('/teacher/students')
    await expect(page.getByRole('table')).toBeVisible()
    await page.waitForLoadState('networkidle').catch(() => {})
    const { violations } = await scan(page)
    expect(violations, JSON.stringify(violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target) })), null, 2)).toEqual([])
  })

  test('guardian dashboard', async ({ page }) => {
    await login(page, GUARDIAN.email, GUARDIAN.password)
    await expect(page).toHaveURL(/guardian/)
    await page.waitForLoadState('networkidle').catch(() => {})
    const { violations } = await scan(page)
    expect(violations, JSON.stringify(violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 3).map((n) => n.target) })), null, 2)).toEqual([])
  })
})
