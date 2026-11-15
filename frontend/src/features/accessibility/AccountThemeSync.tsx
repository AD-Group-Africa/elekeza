'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/features/auth';
import { themeSettings, useAccessibilitySettings } from './AccessibilitySettingsProvider';
import { accessibilityApi } from './api';

/**
 * on sign-in, applies the theme saved to the account, so it follows the user
 * to any device (and a shared school tablet shows each learner their own
 * mode). the settings screen keeps the account copy current. when the profile
 * can not be loaded (offline, server down) the device's own choice stays.
 */
export function AccountThemeSync() {
  const { user, loading } = useAuth();
  const { setSetting } = useAccessibilitySettings();
  const apply = useRef(setSetting);
  const restoredFor = useRef<number | null>(null);

  useEffect(() => {
    apply.current = setSetting;
  }, [setSetting]);

  useEffect(() => {
    if (loading || !user || restoredFor.current === user.learnerId) return;
    restoredFor.current = user.learnerId;
    let cancelled = false;
    accessibilityApi
      .getProfile(user.learnerId)
      .then((profile) => {
        const next = themeSettings(profile.theme);
        if (cancelled || !next) return;
        if (next.calmMode !== undefined) apply.current('calmMode', next.calmMode);
        if (next.lightTheme !== undefined) apply.current('lightTheme', next.lightTheme);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return null;
}
