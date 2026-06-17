import axios from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

export const authAPI = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  refresh: () => api.post('/auth/refresh'),
  me: () => api.get('/auth/me'),
    logout: () => api.post('/auth/logout'),
}

export const contentAPI = {
  uploadText: (data: { text: string, title?: string, language?: string, subject?: string }) => api.post('/content/upload/text', data),
  uploadFile: (formData: FormData) => api.post('/content/upload/file', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getContent: (id: string) => api.get(`/content/${id}`),
  list: () => api.get('/content/list'),
  history: () => api.get('/content/history'),
}

export const onboardingAPI = {
  start: (learnerId: number, data: any) => api.post(`/onboarding/${learnerId}`, data),
  getProfile: (learnerId: number) => api.get(`/onboarding/${learnerId}`),
  updateProfile: (learnerId: number, data: any) => api.put(`/onboarding/${learnerId}`, data),
  placement: (data: any) => api.post('/onboarding/placement', data),
  profile: (data: any) => api.post('/onboarding/profile', data),
}

export const progressAPI = {
  dashboard: (learnerId: number) => api.get(`/learner/dashboard?learnerId=${learnerId}`),
  lessons: (learnerId: number) => api.get(`/learner/${learnerId}/lessons`),
  quizResults: (learnerId: number) => api.get(`/learner/${learnerId}/quiz-results`),
}

export const quizAPI = {
  start: (lessonId: string) => api.post(`/quiz/${lessonId}/start`),
  answer: (quizId: string, questionId: string, answer: string, latencyMs: number) =>
    api.post(`/quiz/${quizId}/answer`, { questionId, answer, latencyMs }),
  complete: (quizId: string) => api.post(`/quiz/${quizId}/complete`),
  review: (quizId: string) => api.get(`/quiz/${quizId}/review`),
}

export const schoolAPI = {
  register: (data: any) => api.post('/schools/register', data),
  getStudents: (schoolId: number) => api.get(`/schools/${schoolId}/students`),
  enrollStudent: (schoolId: number, data: any) => api.post(`/schools/${schoolId}/enroll`, data),
}
