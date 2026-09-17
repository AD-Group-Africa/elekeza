import type { Page } from '@playwright/test'

/**
 * Elekeza E2E shared helpers.
 *
 * Accounts come from the dev seed (DataInitializer) — the same accounts
 * documented in docs/END_USER_TESTING.md.
 */
export const LEARNER = { email: 'student@elekeza.app', password: 'student123' }
export const TEACHER = { email: 'teacher@elekeza.app', password: 'teacher123' }
export const GUARDIAN = { email: 'parent@elekeza.app', password: 'parent123' }

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Enter your email').fill(email)
  await page.getByPlaceholder('Enter your password').fill(password)
  // Wait for the login round-trip: the app redirects to a role home on
  // success. Waiting for navigation (not a fixed sleep) guarantees the auth
  // cookie is set before the caller's next `goto` — otherwise that request
  // can race ahead unauthenticated (the 2026-09-17 radiogroup flake).
  //
  // Known dev-server hazard: Next Fast Refresh can full-reload /login while
  // the SPA push is in flight (traced 2026-09-17: RSC fetch for /teacher
  // returned 200, then a hot-update reload bounced the page back to /login
  // before the URL committed). Retry the click once if that bounce happens;
  // the second attempt always wins because the reload has finished.
  const ROLE_HOME = /\/(student-home|teacher|admin|guardian|school)/
  const attempt = () =>
    Promise.all([
      page.waitForURL(ROLE_HOME, { timeout: 15_000 }).catch(() => 'timeout' as const),
      page.getByRole('button', { name: 'Login' }).click().catch(() => {}),
    ])
  await attempt()
  if (ROLE_HOME.test(new URL(page.url()).pathname) === false) {
    // Possibly the HMR bounce: re-fill if the reload cleared the form.
    const emailBox = page.getByPlaceholder('Enter your email')
    if ((await emailBox.inputValue().catch(() => '')) === '') await emailBox.fill(email)
    const pwBox = page.getByPlaceholder('Enter your password')
    if ((await pwBox.inputValue().catch(() => '')) === '') await pwBox.fill(password)
    await attempt()
  }
  // Final guard: the role home must be reached.
  await page.waitForURL(ROLE_HOME, { timeout: 45_000 })
}

/**
 * Count records in the offline sync queue (IndexedDB 'elekeza-offline' /
 * 'sync-queue'). Opening with the app's version creates an empty DB if the
 * app has not yet written, so the count is always meaningful.
 */
export function offlineQueueCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const req = indexedDB.open('elekeza-offline', 2)
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const db = req.result
          try {
            const tx = db.transaction('sync-queue', 'readonly')
            const countReq = tx.objectStore('sync-queue').count()
            countReq.onsuccess = () => {
              db.close()
              resolve(countReq.result)
            }
            countReq.onerror = () => {
              db.close()
              reject(countReq.error)
            }
          } catch (e) {
            db.close()
            reject(e)
          }
        }
      })
  )
}
