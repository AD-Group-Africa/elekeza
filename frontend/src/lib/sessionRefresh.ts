import axios from 'axios'

/**
 * Single-flight session refresh.
 *
 * The access cookie is short-lived (15 min). When it expires, several requests
 * can fail with 401 at the same time (React StrictMode double-effects make
 * this common in dev, and it happens in production whenever a page fires
 * parallel reads). Rotating the refresh token once per burst — instead of once
 * per failing request — prevents the rotation race where the second concurrent
 * /auth/refresh reuses the just-rotated token and the backend revokes the
 * session family, logging the user out.
 *
 * Shared by both axios instances (src/lib/api.ts and src/lib/axios.ts).
 */
let refreshInFlight: Promise<unknown> | null = null

export function refreshSessionOnce(): Promise<unknown> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post('/api/auth/refresh', {}, { withCredentials: true })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}
