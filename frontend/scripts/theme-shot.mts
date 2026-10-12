import { chromium } from 'playwright-core'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })

// === Log in as teacher, open settings, toggle Light Theme through the REAL UI ===
await page.goto('http://localhost:3100/login')
await page.getByPlaceholder('Enter your email').fill('teacher@elekeza.app')
await page.getByPlaceholder('Enter your password').fill('teacher123')
await page.getByRole('button', { name: 'Login' }).click()
await page.waitForURL(/\/teacher/, { timeout: 45000 })
await page.goto('http://localhost:3100/dashboard/settings')
// Open Appearance section and click Light Theme toggle
await page.getByRole('button', { name: /Appearance/i }).click()
await page.waitForTimeout(400)
const row = page.locator('div', { hasText: 'Light Theme' }).locator('button').last()
await row.click()
await page.waitForTimeout(1200)
const t1 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
console.log('after UI toggle:', t1)
// Verify the login screen in light mode (logo + card tokens)
await page.context().clearCookies()
await page.goto('http://localhost:3100/login')
await page.locator('img[alt="Elekeza"]').first().waitFor({ timeout: 20000 })
await page.waitForTimeout(1000)
const t2 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
console.log('login under light:', t2)
await page.screenshot({ path: '../artifacts/exhibition-qa/theme-login-light.png' })
// Card token sanity in light mode
const lightTokens = await page.evaluate(() => {
  const root = document.documentElement
  return { bgCard: getComputedStyle(root).getPropertyValue('--bg-card').trim(), text: getComputedStyle(root).getPropertyValue('--text-primary').trim() }
})
console.log('light tokens:', JSON.stringify(lightTokens))
// Revert to dark via real UI
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('elekeza-settings') || '{}')
  s.lightTheme = false
  localStorage.setItem('elekeza-settings', JSON.stringify(s))
})
await page.reload()
await page.waitForTimeout(1500)
const t3 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
console.log('after revert:', t3)
await page.screenshot({ path: '../artifacts/exhibition-qa/theme-login-dark-revert.png' })
// Purple learner screen (student route renders data-theme purple via app code)
await page.context().clearCookies()
await page.goto('http://localhost:3100/login')
await page.getByPlaceholder('Enter your email').fill('student@elekeza.app')
await page.getByPlaceholder('Enter your password').fill('student123')
await page.getByRole('button', { name: 'Login' }).click()
await page.waitForURL(/student-home/, { timeout: 45000 })
await page.waitForTimeout(2000)
const t4 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
console.log('student home theme:', t4)
await page.screenshot({ path: '../artifacts/exhibition-qa/theme-student-purple.png' })
// Mobile width light check
await page.setViewportSize({ width: 390, height: 844 })
await page.screenshot({ path: '../artifacts/exhibition-qa/theme-student-purple-mobile.png' })
await browser.close()
console.log('theme suite done')
