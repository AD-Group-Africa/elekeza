import axios, { AxiosInstance } from 'axios'

// Always call the Next.js proxy (same-origin '/api'): next.config.ts rewrites
// /api/* to the backend. An absolute browser-side base (NEXT_PUBLIC_API_URL)
// would make these calls cross-origin, so the CSRF cookie issued via the proxy
// would never reach the API origin and every write would fail with 403.
const BASE_URL = '/api'

export const api: AxiosInstance = axios.create({
  baseURL:         BASE_URL,
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true,   // send HttpOnly cookies (refresh token)
})

// Spring Security's cookie-based CSRF token is single-use: every successful
// state-changing request consumes it and the server deletes the cookie. Fetch
// a fresh token before each non-GET request so writes (notifications,
// uploads, onboarding, quiz answer/complete) work from the browser. CSRF
// protection is preserved — the attacker still cannot read the token from
// another origin or forge it. Mirrors the interceptor in src/lib/axios.ts.
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

// On 401: rotate the HTTP-only access cookie, then retry once.
api.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config
    if (error.response?.status === 401 && !original._retried) {
      original._retried = true
      try {
        await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
        return api(original)
      } catch { /* the caller will handle the unauthenticated response */ }
    }
    return Promise.reject(error)
  }
)

// â”€â”€ Auth â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const authAPI = {
  login:    (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: Record<string, unknown>)   => api.post('/auth/register', data),
  refresh:  ()                                => api.post('/auth/refresh'),
  me:       ()                                => api.get('/auth/me'),
  logout:   ()                                => api.post('/auth/logout'),
}

// â”€â”€ Content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const contentAPI = {
  uploadText: (data: { text: string; title?: string; language?: string; sneType?: string }) =>
    api.post('/content/upload/text', data),

  uploadFile: (formData: FormData) =>
    api.post('/content/upload/file', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  getLesson: (id: string | number) => api.get(`/content/lessons/${id}`),

  // Poll processing status
  getStatus: (id: string | number) => api.get(`/content/status/${id}`),

  list: () => api.get('/content/list'),

  // Legacy alias â€” kept for backward compatibility with existing pages
  getContent: (id: string | number) => api.get(`/content/lessons/${id}`),
  history:    ()                     => api.get('/content/list'),
}

// â”€â”€ Onboarding â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const onboardingAPI = {
  profile:  (data: unknown) => api.post('/onboarding/profile', data),
  placement:(data: unknown) => api.post('/onboarding/placement', data),
  guardian: (data: unknown) => api.post('/onboarding/guardian-link', data),
  getStatus:(learnerId: number) => api.get(`/onboarding/${learnerId}`),
}

// â”€â”€ Quiz â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const quizAPI = {
  start: (lessonId: string | number) =>
    api.get(`/quiz/${lessonId}/start`),

  answer: (quizId: string | number, questionId: string | number, selectedOption: string, latencyMs: number) =>
    api.post(`/quiz/${quizId}/answer`, { questionId, selectedOptionId: selectedOption, latencyMs }),

  complete: (quizId: string | number, answers: Array<{ questionId: number; selectedOption: string }>) =>
    api.post(`/quiz/${quizId}/complete`, answers),
}

// â”€â”€ Progress / Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const progressAPI = {
  dashboard: () => api.get('/progress/dashboard'),
  lessons:   () => api.get('/progress/lessons'),
}

// â”€â”€ Teacher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const teacherAPI = {
  getStudents:      ()                                  => api.get('/teacher/students'),
  createStudent:    (data: unknown)                     => api.post('/teacher/student', data),
  assignContent:    (data: { contentId: number; studentIds: number[] }) =>
                                                           api.post('/teacher/content/assign', data),
  getProgress:      (studentId: number)                 => api.get(`/teacher/student/${studentId}/progress`),
  listContent:      ()                                  => api.get('/content/list'),
}

// â”€â”€ Guardian â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Note: api baseURL already includes /api â€” do NOT prefix with /api here

export const guardianAPI = {
  getWards:    ()                     => api.get('/guardian/wards'),
  getProgress: (wardId: number)       => api.get(`/guardian/wards/${wardId}/progress`),
}

// Analytics
export const analyticsAPI = {
  teacher:   () => api.get('/analytics/teacher'),
  student:   () => api.get('/analytics/student'),
  guardian:  () => api.get('/analytics/guardian'),
  admin:     () => api.get('/analytics/admin'),
  dashboard: () => api.get('/analytics/dashboard'),
}
// Payments
export const examAPI = {
  list: () => api.get('/exams'),
  create: (payload: unknown) => api.post('/exams', payload),
  get: (id: string | number) => api.get(`/exams/${id}`),
  update: (id: string | number, payload: unknown) => api.put(`/exams/${id}`, payload),
  publish: (id: string | number) => api.post(`/exams/${id}/publish`),
  close: (id: string | number) => api.post(`/exams/${id}/close`),
  remove: (id: string | number) => api.delete(`/exams/${id}`),
  results: (id: string | number) => api.get(`/exams/${id}/results`),
  integrity: (attemptId: string | number) => api.get(`/exams/attempts/${attemptId}/integrity`),
  mark: (attemptId: string | number, questionId: number, marksAwarded: number, feedback?: string) =>
    api.post(`/exams/attempts/${attemptId}/mark`, { questionId, marksAwarded, feedback }),
  available: () => api.get('/exams/available'),
  start: (id: string | number) => api.post(`/exams/${id}/start`),
  saveAnswer: (attemptId: string | number, questionId: number, answer: string | null) =>
    api.post(`/exams/attempts/${attemptId}/answers`, { questionId, answer }),
  integrityEvent: (attemptId: string | number, eventType: string, detail?: string) =>
    api.post(`/exams/attempts/${attemptId}/integrity`, { eventType, detail }),
  submit: (attemptId: string | number, answers: Array<{ questionId: number; answer: string | null }>) =>
    api.post(`/exams/attempts/${attemptId}/submit`, { answers }),
  myResults: () => api.get('/exams/results'),
  myResult: (attemptId: string | number) => api.get(`/exams/results/${attemptId}`),
  resultDetail: (attemptId: string | number) => api.get(`/exams/results/${attemptId}`),
  wardResults: (wardId: string | number) => api.get(`/exams/guardian/${wardId}/results`),
}

export const paymentsAPI = {
  stkPush: (phone: string, amount: number, reference: string) => api.post('/payments/stkpush', { phone, amount, reference }),
  revenue:  () => api.get('/payments/revenue'),
  transactions: () => api.get('/payments/transactions'),
}
// Notifications
export const notificationsAPI = {
  sendSms: (recipients: string[], message: string) => api.post('/notifications/sms', { recipients, message }),
  guardianNotification: (phone: string, childName: string, event: string) => api.post('/notifications/guardian', { phone, childName, event }),
}

