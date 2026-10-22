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
  /** Mirrors the profile to the server and records one engagement event. */
  saveProfile: async (userId: number, settings: ServerAccessibilityProfile) => {
    await apiClient.put(`/accessibility-profiles/${userId}`, { settings });
    await apiClient.post('/engagement/events', { eventType: 'A11Y_SETTING_CHANGED', refType: 'A11Y' });
  },
};
