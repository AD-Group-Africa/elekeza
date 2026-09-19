import { defineConfig, devices } from '@playwright/test'
import path from 'path'

/**
 * Elekeza E2E — reproducible test environment.
 *
 * The backend is booted from the built boot JAR with dev profile + test port
 * as plain java args (the most reliable path on Windows, where Gradle arg
 * quoting and daemon environment capture are unreliable). The Next.js dev
 * server proxies /api/* to it, so the browser stays same-origin.
 *
 * Ports (parameterized; 8080 is unavailable on some machines):
 *   E2E_BACKEND_PORT  (default 8090)
 *   E2E_FRONTEND_PORT (default 3100)
 */
const BACKEND_PORT = process.env.E2E_BACKEND_PORT ?? '8090'
const FRONTEND_PORT = process.env.E2E_FRONTEND_PORT ?? '3100'
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`
const JAR = path.join(__dirname, '..', 'backend', 'build', 'libs', 'elekeza-backend-0.0.1-SNAPSHOT.jar')

export default defineConfig({
  globalSetup: path.join(__dirname, 'e2e', 'global-setup.ts'),
  testDir: path.join(__dirname, 'e2e'),
  // Generous timeouts: Next dev compiles routes on demand, so the FIRST test
  // hitting a route pays a 30-60s Windows cold-compile cost. Tests later in
  // the suite are fast; the budget here absorbs the cold start honestly
  // rather than failing on infrastructure latency.
  timeout: 240_000,
  expect: { timeout: 45_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'learner-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command:
        process.platform === 'win32'
          ? `java -jar "${JAR}" --spring.profiles.active=dev --server.port=${BACKEND_PORT}`
          : `java -jar "${JAR}" --spring.profiles.active=dev --server.port=${BACKEND_PORT}`,
      url: `${BACKEND_URL}/actuator/health`,
      reuseExistingServer: false,
      timeout: 300_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `npm run dev -- -p ${FRONTEND_PORT}`,
      cwd: __dirname,
      url: FRONTEND_URL,
      reuseExistingServer: false,
      timeout: 300_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: BACKEND_URL,
        // Own build dir: the live preview's dev server (`.next`) must not be
        // locked out (or lock us out) while both run on this machine.
        NEXT_DIST_DIR: '.next-e2e',
      },
    },
  ],
})
