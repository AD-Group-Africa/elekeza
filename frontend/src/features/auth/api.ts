import { apiClient } from '@/lib/api';
import type { RegisterInput, User } from './types';

export const authApi = {
  /** Primes the CSRF cookie. */
  csrf: () => apiClient.get('/auth/csrf'),
  me: () => apiClient.get<User>('/auth/me').then((r) => r.data),
  login: (email: string, password: string) =>
    apiClient.post<User>('/auth/login', { email, password }).then((r) => r.data),
  register: (input: RegisterInput) => apiClient.post('/auth/register', input),
  logout: () => apiClient.post('/auth/logout'),
  forgotPassword: (email: string) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) => apiClient.post('/auth/reset-password', { token, newPassword }),
};
