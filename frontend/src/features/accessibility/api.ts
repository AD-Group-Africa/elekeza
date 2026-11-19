import { apiClient } from '@/lib/api';

/** The subset of settings the server-side accessibility profile understands. */
export interface ServerAccessibilityProfile {
  theme: 'dark' | 'light' | 'calm';
  reducedMotion: boolean;
  highContrastFocus: boolean;
  ttsEnabled: boolean;
  plainLanguage: boolean;
}

export const accessibilityApi = {
  /** the profile saved to the account; empty when the user never saved one. */
  getProfile: (userId: number) =>
    apiClient
      .get<{ userId: number; settings?: Partial<ServerAccessibilityProfile> }>(`/accessibility-profiles/${userId}`)
      .then((r) => r.data?.settings ?? {}),
  /** Mirrors the profile to the server and records one engagement event. */
  saveProfile: async (userId: number, settings: ServerAccessibilityProfile) => {
    await apiClient.put(`/accessibility-profiles/${userId}`, { settings });
    await apiClient.post('/engagement/events', { eventType: 'A11Y_SETTING_CHANGED', refType: 'A11Y' });
  },
};
