import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { refreshSessionOnce } from './sessionRefresh';
import { isPublicPath } from '@/config/routes';

/**
 * The one HTTP client for the Elekeza API.
 *
 * - Same-origin `/api`: next.config.ts proxies it to the backend, so the CSRF
 *   and session cookies stay first-party.
 * - CSRF: Spring's cookie token is single-use, so a fresh one is fetched
 *   before every state-changing request.
 * - Session: on 401 (or a 403 with code AUTH_REQUIRED — an expired access
 *   cookie) the session is refreshed once and the request retried. If that
 *   fails, the user is sent to /login (except on public pages and for the
 *   initial "who am I" check, which legitimately returns 401).
 *
 * Feature modules wrap this client in typed functions (features/<x>/api.ts);
 * screens should not build URLs themselves.
 */
export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

type RetriableConfig = InternalAxiosRequestConfig & { _sessionRetried?: boolean };

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

apiClient.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toUpperCase();
  if (SAFE_METHODS.has(method)) return config;
  try {
    const { data } = await axios.get('/api/auth/csrf', { withCredentials: true });
    if (data?.token) config.headers.set('X-XSRF-TOKEN', data.token);
  } catch {
    // No token: the server rejects the write with 403, which callers handle.
  }
  return config;
});

function isAuthFailure(error: AxiosError<{ code?: string }>): boolean {
  return error.response?.status === 401 || error.response?.data?.code === 'AUTH_REQUIRED';
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ code?: string }>) => {
    if (!isAuthFailure(error) || typeof window === 'undefined') return Promise.reject(error);

    const original = error.config as RetriableConfig | undefined;
    const url = original?.url ?? '';
    const isWhoAmI = url.endsWith('/auth/me');
    const onPublicPage = isPublicPath(window.location.pathname);

    if (original && !original._sessionRetried && !isWhoAmI && !onPublicPage) {
      // One shared refresh per burst of 401s, then retry once. An expired
      // 15-minute access cookie must not kick the user out mid-page.
      original._sessionRetried = true;
      try {
        await refreshSessionOnce();
        return apiClient(original);
      } catch {
        // Refresh failed (refresh cookie expired) — fall through to sign-in.
      }
    }

    if (!onPublicPage && !isWhoAmI) {
      // A full reload (not router.push) is intentional: it clears all
      // in-memory state of the expired session. No router exists here.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
