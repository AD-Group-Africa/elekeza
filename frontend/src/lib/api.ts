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

// ── AI Tutor ──────────────────────────────────────────────────────────────
// baseURL already includes /api — do NOT prefix with /api here.

export const tutorAPI = {
  ask: (payload: {
    action: 'EXPLAIN' | 'PRACTICE' | 'TRANSLATE' | 'SUMMARY' | 'DIAGRAM';
    lessonId?: number;
    text?: string;
    practiceId?: string;
    answerIndex?: number;
    variant?: string;
  }) => api.post('/tutor', payload),
  status: () => api.get('/tutor/status'),
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

// ── Attendance ───────────────────────────────────────────────────────────────

export interface ClassInfo { id: number; name: string; gradeLevel?: string | null; learnerCount: number }
export interface RosterEntry { learnerId: number; learnerName: string; status: string | null; note: string | null }
export interface AttendanceEntry { learnerId: number; status: string; note?: string | null }
export interface AttendanceRecord { learnerId: number; learnerName: string; status: string; note?: string | null }
export interface AttendanceSessionInfo {
  sessionId: number; classId: number; className: string; date: string; recordedBy: number;
  counts: Record<string, number>; records: AttendanceRecord[]
}
export interface LearnerAttendance {
  learnerId: number; learnerName: string; className: string | null; sessionsMarked: number;
  counts: Record<string, number>; attendanceRate: number;
  records: Array<{ date: string; status: string; note: string | null; className: string }>
}

export const attendanceAPI = {
  classes:        () => api.get<ClassInfo[]>('/attendance/classes'),
  roster:         (classId: number | string, date: string) =>
                    api.get<RosterEntry[]>(`/attendance/classes/${classId}/roster`, { params: { date } }),
  save:           (classId: number | string, date: string, records: AttendanceEntry[]) =>
                    api.post<AttendanceSessionInfo>(`/attendance/classes/${classId}/sessions`, { records }, { params: { date } }),
  learnerHistory: (learnerId: number | string) => api.get<LearnerAttendance>(`/attendance/learners/${learnerId}`),
  summary:        (from?: string, to?: string) => api.get('/attendance/summary', { params: { from, to } }),
}

// ── Finance (school fees / payments) ────────────────────────────────────────

export interface PeriodInfo { id: number; name: string; startDate?: string | null; endDate?: string | null; isCurrent: boolean }
export interface FeeItemInfo { id: number; name: string; description?: string | null; amount: number; active: boolean }
export interface FeeStructureInfo { id: number; periodId: number; feeItemId: number; feeItemName: string; classId?: number | null; amount: number }
export interface ChargeInfo {
  id: number; chargeNumber: string; learnerId: number; learnerName: string;
  periodId: number; periodName: string; feeItemId: number; feeItemName: string;
  description?: string | null; amount: number; paidAmount: number; balance: number;
  status: string; dueDate?: string | null; createdAt: string
}
export interface PaymentInfo {
  id: number; paymentNumber: string; learnerId: number; learnerName: string;
  amount: number; method: string; status: string; providerRef?: string | null; note?: string | null;
  paidAt: string; allocations: Array<{ chargeId: number; chargeNumber: string; amount: number }>
}
export interface ReceiptInfo {
  receiptNumber: string; paymentId: number; learnerId: number; learnerName: string; institutionName: string;
  amount: number; method: string; providerRef?: string | null; recordedByName?: string | null; paidAt: string;
  lines: Array<{ chargeNumber: string; feeItemName: string; amount: number; chargeStatusAfter: string }>
}
export interface FinanceSummary {
  periodId?: number | null; periodName?: string | null;
  totalBilled: number; totalCollected: number; outstanding: number;
  chargeCount: number; paymentCount: number; recentPayments: PaymentInfo[]
}

// ── Assignments (real assignment domain) ─────────────────────────────────────

export interface AssignmentInfo {
  id: number; classId: number; className: string | null; title: string;
  instructions: string | null; dueDate: string | null; points: number; status: string;
  createdBy: number; submissionCount: number; gradedCount: number
}
export interface SubmissionInfo {
  id: number; assignmentId: number; learnerId: number; learnerName: string | null;
  content: string; submittedAt: string; score: number | null; feedback: string | null; graded: boolean
}

export const assignmentsAPI = {
  // staff
  create: (payload: { classId: number; title: string; instructions?: string; dueDate?: string; points?: number }) =>
            api.post<AssignmentInfo>('/assignments', payload),
  update: (id: number, payload: { title?: string; instructions?: string; dueDate?: string | null; points?: number; status?: string }) =>
            api.put<AssignmentInfo>(`/assignments/${id}`, payload),
  classAssignments: (classId: number) => api.get<AssignmentInfo[]>(`/assignments/classes/${classId}`),
  submissions: (id: number) => api.get<SubmissionInfo[]>(`/assignments/${id}/submissions`),
  grade: (submissionId: number, score: number, feedback?: string) =>
            api.post<SubmissionInfo>(`/assignments/submissions/${submissionId}/grade`, { score, feedback }),
  // learner
  mine: () => api.get<AssignmentInfo[]>('/assignments/learner/mine'),
  submit: (id: number, content: string) => api.post<SubmissionInfo>(`/assignments/${id}/submit`, { content }),
  mySubmissions: () => api.get<SubmissionInfo[]>('/assignments/learner/submissions'),
  // guardian
  wardSubmissions: (learnerId: number) => api.get<SubmissionInfo[]>(`/assignments/guardian/wards/${learnerId}/submissions`),
}

export const financeAPI = {
  periods: () => api.get<PeriodInfo[]>('/finance/periods'),
  createPeriod: (payload: { name: string; startDate?: string; endDate?: string; isCurrent?: boolean }) =>
                  api.post<PeriodInfo>('/finance/periods', payload),
  feeItems: () => api.get<FeeItemInfo[]>('/finance/fee-items'),
  createFeeItem: (payload: { name: string; description?: string; amount: number }) =>
                  api.post<FeeItemInfo>('/finance/fee-items', payload),
  structures: (periodId?: number) => api.get<FeeStructureInfo[]>('/finance/structures', { params: { periodId } }),
  createStructure: (payload: { periodId: number; feeItemId: number; classId?: number | null; amount: number }) =>
                  api.post<FeeStructureInfo>('/finance/structures', payload),
  applyStructure: (id: number) => api.post<{ created: number; skippedExisting: number }>(`/finance/structures/${id}/apply`, {}),
  charges: (params?: { periodId?: number; learnerId?: number }) => api.get<ChargeInfo[]>('/finance/charges', { params }),
  createCharge: (payload: { learnerId: number; periodId: number; feeItemId: number; amount: number; dueDate?: string; description?: string }) =>
                  api.post<ChargeInfo>('/finance/charges', payload),
  payments: (learnerId?: number) => api.get<PaymentInfo[]>('/finance/payments', { params: { learnerId } }),
  manualPayment: (payload: { learnerId: number; amount: number; method: 'CASH' | 'BANK'; note?: string; providerRef?: string; allocations?: Array<{ chargeId: number; amount: number }> }) =>
                  api.post<PaymentInfo>('/finance/payments/manual', payload),
  initiateMpesa: (payload: { learnerId: number; amount: number; phone?: string }) =>
                  api.post<{ checkoutRequestId: string; status: string; mock: boolean; message: string }>('/finance/payments/mpesa/initiate', payload),
  mpesaMode: () => api.get<{ mock: boolean }>('/finance/payments/mpesa/mode'),
  receipt: (paymentId: number) => api.get<ReceiptInfo>(`/finance/receipts/${paymentId}`),
  summary: (periodId?: number) => api.get<FinanceSummary>('/finance/summary', { params: { periodId } }),
}

