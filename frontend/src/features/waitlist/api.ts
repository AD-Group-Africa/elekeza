import { apiClient } from '@/lib/api';

export const waitlistApi = {
  join: (entry: { name: string; email: string; school: string }) => apiClient.post('/waitlist', entry),
};
