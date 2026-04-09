import axios from 'axios'

// Use Next.js rewrite proxy to avoid browser CORS issues in dev.
const api = axios.create({
  baseURL: '/',
  withCredentials: true, // Important for cookies
})

// No token handling needed - cookies are HttpOnly and sent automatically

export const authAPI = {
  login: async (email: string, password: string) => {
    const res = await api.post('/api/auth/login', { email, password })
    // No token returned - cookies set by server
    return res.data
  },

  register: async (email: string, password: string, fullName: string) => {
    const res = await api.post('/api/auth/register', { email, password, fullName })
    return res.data
  },

  logout: async () => {
    const res = await api.post('/api/auth/logout')
    return res.data
  },

  refresh: async () => {
    const res = await api.post('/api/auth/refresh')
    return res.data
  },
}

export const onboardingAPI = {
  profile: async (data: { preferredLanguage: string; ageGroup: string; learningGoal: string }) => {
    const res = await api.post('/api/onboarding/profile', data)
    return res.data
  },

  placement: async (data: { score: number; totalQuestions: number }) => {
    const res = await api.post('/api/onboarding/placement', data)
    return res.data
  },

  complete: async () => {
    const res = await api.post('/api/onboarding/complete')
    return res.data
  },

  guardianLink: async (data: { fullName: string; relationship: string; phone?: string; email?: string }) => {
    const res = await api.post('/api/onboarding/guardian-link', data)
    return res.data
  },
}

export const contentAPI = {
  uploadText: async (data: { text: string; subject?: string }) => {
    const res = await api.post('/api/content/upload/text', data)
    return res.data
  },

  getLesson: async (lessonId: string) => {
    const res = await api.get(`/api/content/lessons/${lessonId}`)
    return res.data
  },

  updateSectionProgress: async (lessonId: string, sectionId: string, data: { additionalSeconds: number }) => {
    const res = await api.patch(`/api/content/lessons/${lessonId}/sections/${sectionId}/progress`, data)
    return res.data
  },

  tapTerm: async (lessonId: string, data: { termId: string }) => {
    const res = await api.post(`/api/content/lessons/${lessonId}/term-tap`, data)
    return res.data
  },

  history: async () => {
    const res = await api.get('/api/content/history')
    return res.data
  },
}

export const quizAPI = {
  start: async (lessonId: string) => {
    const res = await api.get(`/api/quiz/${lessonId}/start`)
    return res.data
  },

  answer: async (quizId: string, data: { questionId: string; selectedOptionId: string; latencyMs: number }) => {
    const res = await api.post(`/api/quiz/${quizId}/answer`, data)
    return res.data
  },

  complete: async (quizId: string) => {
    const res = await api.get(`/api/quiz/${quizId}/complete`)
    return res.data
  },
}

export const progressAPI = {
  dashboard: async () => {
    const res = await api.get('/api/progress/dashboard')
    return res.data
  },
}


