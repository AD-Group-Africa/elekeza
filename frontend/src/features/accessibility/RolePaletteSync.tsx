'use client';

import { useEffect } from 'react';
import { useAuth } from '@/features/auth';
import { applyRolePalette, readStoredRolePalette, rolePalette } from './rolePalette';

/**
 * keeps <html data-role> in step with the signed-in user. while signed out
 * (login, register) the last palette stays, so a returning teacher still sees
 * moss green and nothing flashes on reload.
 */
export function RolePaletteSync() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    applyRolePalette(user ? rolePalette(user.role) : readStoredRolePalette());
  }, [user, loading]);

  return null;
}
