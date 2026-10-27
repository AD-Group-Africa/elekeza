import { ROLE_PALETTE_STORAGE_KEY } from '@/lib/storageKeys';

/**
 * colour family per account role. the css in styles/tokens.css reads it from
 * <html data-role="...">; the mode (dark / light / calm) is a separate
 * attribute, so every role works in every mode.
 */
export const ROLE_PALETTES = ['learner', 'teacher', 'guardian', 'admin'] as const;
export type RolePalette = (typeof ROLE_PALETTES)[number];

/** public pages and unknown roles use the learner purple. */
export const DEFAULT_ROLE_PALETTE: RolePalette = 'learner';

const PALETTE_BY_ROLE: Record<string, RolePalette> = {
  STUDENT: 'learner',
  TEACHER: 'teacher',
  GUARDIAN: 'guardian',
  SCHOOL_ADMIN: 'admin',
  ADMIN: 'admin',
};

export function isRolePalette(value: unknown): value is RolePalette {
  return typeof value === 'string' && (ROLE_PALETTES as readonly string[]).includes(value);
}

/** maps a backend role (STUDENT, TEACHER ...) to its colour family. */
export function rolePalette(role: string | null | undefined): RolePalette {
  return (role && PALETTE_BY_ROLE[role]) || DEFAULT_ROLE_PALETTE;
}

/** the palette remembered from the last signed-in session, or the default. */
export function readStoredRolePalette(): RolePalette {
  try {
    const stored = localStorage.getItem(ROLE_PALETTE_STORAGE_KEY);
    return isRolePalette(stored) ? stored : DEFAULT_ROLE_PALETTE;
  } catch {
    return DEFAULT_ROLE_PALETTE;
  }
}

/** sets the palette on <html> and remembers it for the next pre-paint. */
export function applyRolePalette(palette: RolePalette): void {
  document.documentElement.setAttribute('data-role', palette);
  try {
    localStorage.setItem(ROLE_PALETTE_STORAGE_KEY, palette);
  } catch {
    // storage can be unavailable (private mode); the attribute still applies
  }
}
