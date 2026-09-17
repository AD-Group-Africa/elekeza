import { test, expect } from '@playwright/test'
import { LEARNER, login } from './helpers'

/**
 * Exam E2E — real backend, server-authoritative behavior.
 *
 * The seed publishes "Science Check: The Water Cycle" (20 min window, 3
 * questions: MCQ + TRUE_FALSE + SHORT_ANSWER). Assertions target
 * server-owned state: expiry, immutability, double-submit rejection.
 */
const EXAM_TITLE = 'Science Check: The Water Cycle'

test('exam journey: start → timer → autosave → submit → scored result', async ({ page }) => {
  await login(page, LEARNER.email, LEARNER.password)

  await page.goto('/student-exams')
  await expect(page.getByRole('heading', { name: 'My Exams' })).toBeVisible()
  await expect(page.getByText(EXAM_TITLE).first()).toBeVisible()

  // Start (fullscreen request is best-effort and may be declined headlessly).
  await page.getByRole('button', { name: 'Start exam' }).first().click()
  await expect(page.getByText('Time left:')).toBeVisible()
  // Server-owned countdown appears as m:ss — the browser never owns expiry.
  await expect(page.locator('span.font-mono')).toHaveText(/\d+:\d{2}/)

  // Answer all three questions (MCQ "A.", True/False "True", short answer).
  await page.locator('input[name="q-1"]').first().check()
  await page.locator('input[name="q-2"]').first().check()
  await page.getByPlaceholder('Type your answer').fill('precipitation')

  // Autosave fires ~600ms after the last keystroke/choice; give it a beat,
  // then reload — the exam runner restores its list view, and starting again
  // RESUMES the same server-owned attempt with the saved answers.
  await page.waitForTimeout(1500)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'My Exams' })).toBeVisible()
  await page.getByRole('button', { name: 'Start exam' }).first().click()
  await expect(page.getByText('Time left:')).toBeVisible()
  await expect(page.getByPlaceholder('Type your answer')).toHaveValue(/precipitation/i)

  // Submit and receive a server-computed score.
  await page.getByRole('button', { name: 'Submit exam' }).click()
  await expect(page.getByText('Exam submitted')).toBeVisible()
  await expect(page.getByText(/^Score: \d/)).toBeVisible()

  // Result must persist after refresh (server state, not client state).
  await page.reload()
  await expect(page.getByText(EXAM_TITLE).first()).toBeVisible()
  await expect(page.getByText(/Past results/)).toBeVisible()
})

test('exam attempt is immutable after submission (409 on replay)', async ({ request }) => {
  // Browser-independent proof against the real backend: submit the attempt
  // twice and expect the second submit to be rejected 409.
  //
  // CSRF parity: the browser's axios fetches /api/auth/csrf and echoes the
  // token on every write; the raw request fixture must do the same or the
  // backend's CSRF filter rejects writes with 403 before authorization.
  const token = async () => {
    const res = await request.get('/api/auth/csrf')
    const cookie = (await res.headersArray()).find((h) => h.name.toLowerCase() === 'set-cookie')?.value.split(';')[0]
    const { token } = await res.json()
    return { token, cookie }
  }

  const loginGate = await token()
  const loginRes = await request.post('/api/auth/login', {
    data: { email: LEARNER.email, password: LEARNER.password },
    headers: loginGate.cookie ? { Cookie: loginGate.cookie } : undefined,
  })
  expect(loginRes.ok()).toBeTruthy()

  const gate = await token()
  const start = await request.post('/api/exams/1/start', {
    headers: { 'X-XSRF-TOKEN': gate.token, ...(gate.cookie ? { Cookie: gate.cookie } : {}) },
  })
  expect(start.ok()).toBeTruthy()
  const attemptId = (await start.json()).attemptId as number

  const payload = { answers: [{ questionId: 1, answer: 'A' }] }
  const gate2 = await token()
  const first = await request.post(`/api/exams/attempts/${attemptId}/submit`, {
    data: payload,
    headers: { 'X-XSRF-TOKEN': gate2.token, ...(gate2.cookie ? { Cookie: gate2.cookie } : {}) },
  })
  expect(first.ok()).toBeTruthy()
  const gate3 = await token()
  const second = await request.post(`/api/exams/attempts/${attemptId}/submit`, {
    data: payload,
    headers: { 'X-XSRF-TOKEN': gate3.token, ...(gate3.cookie ? { Cookie: gate3.cookie } : {}) },
  })
  expect(second.status()).toBe(409)
  expect((await second.json()).error).toContain('already finished')
})

test('exam resumption honors maxAttempts on a completed attempt', async ({ request }) => {
  const token = async () => {
    const res = await request.get('/api/auth/csrf')
    const cookie = (await res.headersArray()).find((h) => h.name.toLowerCase() === 'set-cookie')?.value.split(';')[0]
    const { token } = await res.json()
    return { token, cookie }
  }
  const loginGate = await token()
  const loginRes = await request.post('/api/auth/login', {
    data: { email: LEARNER.email, password: LEARNER.password },
    headers: loginGate.cookie ? { Cookie: loginGate.cookie } : undefined,
  })
  expect(loginRes.ok()).toBeTruthy()

  // After the journey test consumed both attempts, starting again must be
  // rejected server-side — the learner cannot retake a closed exam.
  const gate = await token()
  const start = await request.post('/api/exams/1/start', {
    headers: { 'X-XSRF-TOKEN': gate.token, ...(gate.cookie ? { Cookie: gate.cookie } : {}) },
  })
  expect(start.status()).toBe(409)
  expect((await start.json()).error).toContain('Attempt limit reached')
})
