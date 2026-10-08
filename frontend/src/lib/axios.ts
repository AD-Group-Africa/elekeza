import axios from 'axios';
import { refreshSessionOnce } from './sessionRefresh';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Spring Security's cookie-based CSRF token is single-use: every successful
// state-changing request consumes it and the server deletes the cookie. Fetch
// a fresh token before each non-GET request so writes (quiz answer/complete,
// upload, logout) work from the browser. CSRF protection is preserved — the
// attacker still cannot read the token from another origin or forge it.
api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return config;
  try {
    const { data } = await axios.get('/api/auth/csrf', { withCredentials: true });
    if (data?.token) {
      config.headers = config.headers || {};
      config.headers['X-XSRF-TOKEN'] = data.token;
    }
  } catch {
    // If the token cannot be fetched, let the request proceed — the server
    // rejects with 403 when a token is required.
  }
  return config;
});

// Redirect to login on authentication failures. The initial /auth/me check
// legitimately returns 401 for anonymous visitors; redirecting there would
// reload /login in an endless loop, so only redirect when we are NOT already
// on an auth page and the failing call is not the auth-status check itself.
// 403 responses that carry code AUTH_REQUIRED are expired/invalid access
// cookies (the backend emits this shape since the session-expiry fix) and
// are treated exactly like 401 — before this, an expired cookie left pages
// silently broken because recovery keyed on 401 only (audit EL-F-002/006).
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    const isAuthFailure = status === 401 || code === 'AUTH_REQUIRED';
    if (isAuthFailure) {
      const original = error.config;
      const url: string = original?.url ?? '';
      const onAuthPage = ['/login', '/register', '/forgot-password'].includes(window.location.pathname);
      const isAuthCheck = url === '/auth/me' || url.endsWith('/auth/me');
      if (!onAuthPage && !isAuthCheck && original && !original._sessionRetried) {
        // Recover first: one shared single-flight refresh, then retry once.
        // A 15-minute access-cookie expiry must not kick the user to /login
        // mid-page (back-button/navigation contract: navigation never logs
        // the user out when a valid refresh cookie exists).
        original._sessionRetried = true;
        try {
          await refreshSessionOnce();
          return api(original);
        } catch {
          // Refresh failed (e.g. refresh cookie expired) — fall through.
        }
      }
      if (!onAuthPage && !isAuthCheck) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
