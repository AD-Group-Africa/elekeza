import axios from 'axios';

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

// Redirect to login on 401 responses.
// The initial /auth/me check legitimately returns 401 for anonymous visitors;
// redirecting there would reload /login in an endless loop, so only redirect
// when we are NOT already on an auth page and the failing call is not the
// auth-status check itself.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url ?? '';
      const onAuthPage = ['/login', '/register', '/forgot-password'].includes(window.location.pathname);
      const isAuthCheck = url === '/auth/me' || url.endsWith('/auth/me');
      if (!onAuthPage && !isAuthCheck) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
