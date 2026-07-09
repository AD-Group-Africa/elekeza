import axios, { AxiosInstance } from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api'

export const api: AxiosInstance = axios.create({
  baseURL:         BASE_URL,
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true,   // send HttpOnly cookies (refresh token)
})

// Attach in-memory access token on every request if present
api.interceptors.request.use(config => {
  const token = typeof window !== 'undefined'
    ? sessionStorage.getItem('elekeza_access')
    : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401: attempt token refresh, then retry original request once
api.interceptors.response.use(
  res => res,
  async error => {
    const original = error.config
    if (error.response?.status === 401 && !original._retried) {
      original._retried = true
      try {
        const refreshRes = await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
        const token = refreshRes.data?.accessToken
        if (token) sessionStorage.setItem('elekeza_access', token)
        return api(original)
      } catch {
        sessionStorage.removeItem('elekeza_access')
      }
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
    api.post(`/quiz/${lessonId}/start`),

  answer: (quizId: string | number, questionId: string | number, selectedOption: string, latencyMs: number) =>
    api.post(`/quiz/${quizId}/answer`, { questionId, selectedOption, latencyMs }),

  complete: (quizId: string | number, correctCount: number) =>
    api.post(`/quiz/${quizId}/complete`, { correctCount }),

  review: (quizId: string | number) =>
    api.get(`/quiz/${quizId}/review`),
}

// â”€â”€ Progress / Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const progressAPI = {
  dashboard: (userId: number) => api.get(`/learner/dashboard?userId=${userId}`),
  lessons:   (userId: number) => api.get(`/learner/${userId}/lessons`),
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
