import { afterEach, describe, expect, it } from 'vitest';
import { ROLE_PALETTE_STORAGE_KEY } from '@/lib/storageKeys';
import { resolveTheme, themeSettings } from './AccessibilitySettingsProvider';
import {
  DEFAULT_ROLE_PALETTE,
  applyRolePalette,
  isRolePalette,
  readStoredRolePalette,
  rolePalette,
} from './rolePalette';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-role');
});

describe('rolePalette', () => {
  it('maps every backend role to its colour family', () => {
    expect(rolePalette('STUDENT')).toBe('learner');
    expect(rolePalette('TEACHER')).toBe('teacher');
    expect(rolePalette('GUARDIAN')).toBe('guardian');
    expect(rolePalette('SCHOOL_ADMIN')).toBe('admin');
    expect(rolePalette('ADMIN')).toBe('admin');
  });

  it('falls back to the learner purple for unknown or missing roles', () => {
    expect(rolePalette('SOMETHING_NEW')).toBe(DEFAULT_ROLE_PALETTE);
    expect(rolePalette(null)).toBe(DEFAULT_ROLE_PALETTE);
    expect(rolePalette(undefined)).toBe(DEFAULT_ROLE_PALETTE);
    expect(DEFAULT_ROLE_PALETTE).toBe('learner');
  });

  it('only accepts known palette names', () => {
    expect(isRolePalette('teacher')).toBe(true);
    expect(isRolePalette('TEACHER')).toBe(false);
    expect(isRolePalette('purple')).toBe(false);
    expect(isRolePalette(null)).toBe(false);
  });
});

describe('stored role palette', () => {
  it('returns the default when nothing is stored', () => {
    expect(readStoredRolePalette()).toBe('learner');
  });

  it('ignores tampered or outdated values', () => {
    localStorage.setItem(ROLE_PALETTE_STORAGE_KEY, 'neon');
    expect(readStoredRolePalette()).toBe('learner');
  });

  it('applies the palette to <html> and remembers it for the next reload', () => {
    applyRolePalette('admin');
    expect(document.documentElement.getAttribute('data-role')).toBe('admin');
    expect(readStoredRolePalette()).toBe('admin');
  });
});

describe('resolveTheme', () => {
  it('defaults to dark', () => {
    expect(resolveTheme({ calmMode: false, lightTheme: false })).toBe('dark');
  });

  it('uses light when chosen', () => {
    expect(resolveTheme({ calmMode: false, lightTheme: true })).toBe('light');
  });

  it('lets calm win over light so SNE learners keep the low-stimulation mode', () => {
    expect(resolveTheme({ calmMode: true, lightTheme: true })).toBe('calm');
  });
});

describe('themeSettings (restoring the theme saved to the account)', () => {
  it('turns every saved theme back into the settings that produce it', () => {
    const base = { calmMode: false, lightTheme: false };
    for (const theme of ['dark', 'light', 'calm'] as const) {
      expect(resolveTheme({ ...base, ...themeSettings(theme) })).toBe(theme);
    }
  });

  it('keeps the light choice underneath calm so turning calm off returns to it', () => {
    expect(themeSettings('calm')).toEqual({ calmMode: true });
  });

  it('ignores missing or unknown values so the device keeps its own choice', () => {
    expect(themeSettings(undefined)).toBeNull();
    expect(themeSettings('neon')).toBeNull();
  });
});
