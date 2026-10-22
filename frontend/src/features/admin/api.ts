import { apiClient } from '@/lib/api';

export interface StaffMember {
  id: number;
  email: string;
  name: string;
  role: string;
  active: boolean;
  phone?: string | null;
}

/** GET /api/analytics/admin — school headline numbers. */
export interface SchoolStats {
  totalTeachers?: number;
  totalLearners?: number;
  totalContent?: number;
}

/** GET /api/analytics/admin/overview — platform headline numbers. */
export interface PlatformOverview {
  institutions?: number;
  totalUsers?: number;
  students?: number;
}

export interface Institution {
  id: number;
  name: string;
}

/** GET /api/engagement/institutions/{id}/summary */
export interface EngagementSummary {
  institutionId: number;
  windowDays: number;
  totalEvents: number;
  activeUsers: number;
  lessonsStarted: number;
  lessonsCompleted: number;
  quizzesCompleted: number;
  assignmentsSubmitted: number;
  examsSubmitted: number;
  tutorInteractions: number;
  accessibilityFeatureUses: number;
}

export interface ImportResult {
  status: string;
  totalRows: number;
  succeededRows: number;
  failedRows: number;
  errors: { row: number; error: string }[];
  guardianCredentials?: { email: string; tempPassword: string; relationship: string; studentEmail: string }[];
  studentCredentials?: { email: string; tempPassword: string }[];
}

export interface SchoolRegistration {
  name: string;
  type: string;
  county: string;
  subCounty?: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
  contactPhone?: string;
}

export interface GuardianLink {
  id: number;
  guardianId: number;
  guardianEmail: string;
  learnerId: number;
  learnerName: string;
  relationship: string;
  active: boolean;
  revoked: boolean;
  expiresAt: string | null;
}

/** Learners in the admin's school (same endpoint teachers use). */
export interface SchoolLearner {
  id: number;
  name: string;
  grade?: string;
}

const staffBase = (institutionId: number) => `/institutions/${institutionId}/staff`;
const linksBase = (institutionId: number, learnerId: number | string) =>
  `/institutions/${institutionId}/learners/${learnerId}/guardian-links`;

export const adminApi = {
  // school
  schoolStats: () => apiClient.get<SchoolStats>('/analytics/admin').then((r) => r.data ?? {}),
  learners: () => apiClient.get<SchoolLearner[]>('/teacher/students').then((r) => r.data ?? []),
  engagement: (institutionId: number, days = 30) =>
    apiClient
      .get<EngagementSummary>(`/engagement/institutions/${institutionId}/summary`, { params: { days } })
      .then((r) => r.data),
  // staff
  staff: (institutionId: number) => apiClient.get<StaffMember[]>(staffBase(institutionId)).then((r) => r.data),
  createStaff: (institutionId: number, staff: { email: string; name: string; role: string }) =>
    apiClient.post<{ tempPassword?: string }>(staffBase(institutionId), staff).then((r) => r.data),
  setStaffActive: (institutionId: number, staffId: number, active: boolean) =>
    apiClient.patch(`${staffBase(institutionId)}/${staffId}/active`, null, { params: { active } }),
  requestStaffReset: (institutionId: number, staffId: number) =>
    apiClient.post(`${staffBase(institutionId)}/${staffId}/password-reset`),
  // learners import
  importStudents: (institutionId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<ImportResult>(`/institutions/${institutionId}/students/import`, form).then((r) => r.data);
  },
  // guardian links
  guardianLinks: (institutionId: number, learnerId: number | string) =>
    apiClient.get<GuardianLink[]>(linksBase(institutionId, learnerId)).then((r) => r.data),
  revokeLink: (institutionId: number, learnerId: number | string, guardianId: number) =>
    apiClient.post(`${linksBase(institutionId, learnerId)}/${guardianId}/revoke`),
  restoreLink: (institutionId: number, learnerId: number | string, guardianId: number) =>
    apiClient.post(`${linksBase(institutionId, learnerId)}/${guardianId}/restore`),
  makeLinkTemporary: (institutionId: number, learnerId: number | string, guardianId: number, expiresAt: string) =>
    apiClient.post(`${linksBase(institutionId, learnerId)}/${guardianId}/temporary`, null, { params: { expiresAt } }),
  // platform
  platformOverview: () => apiClient.get<PlatformOverview>('/analytics/admin/overview').then((r) => r.data),
  institutions: () => apiClient.get<Institution[]>('/institutions').then((r) => r.data ?? []),
  /** Public: creates an institution and its first SCHOOL_ADMIN. */
  registerSchool: (payload: SchoolRegistration) => apiClient.post('/institutions/register', payload),
};

export const adminKeys = {
  schoolStats: ['admin', 'school-stats'] as const,
  learners: ['admin', 'learners'] as const,
  engagement: (institutionId: number) => ['admin', 'engagement', institutionId] as const,
  staff: (institutionId: number) => ['admin', 'staff', institutionId] as const,
  guardianLinks: (institutionId: number, learnerId: number | string) =>
    ['admin', 'guardian-links', institutionId, String(learnerId)] as const,
  platformOverview: ['admin', 'platform-overview'] as const,
  institutions: ['admin', 'institutions'] as const,
};
