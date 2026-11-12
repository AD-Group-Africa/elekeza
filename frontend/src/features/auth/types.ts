/** The signed-in user, as returned by /api/auth/me and /api/auth/login. */
export interface User {
  /** The user's id (named learnerId by the backend for every role). */
  learnerId: number;
  email: string;
  name: string;
  role: string;
  title?: string;
  gender?: string;
  cognitiveProfiles?: string[];
  /** Tenant context for school-scoped screens (staff, import, engagement). */
  institutionId?: number;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
  gender?: string;
  termsAccepted: boolean;
}
