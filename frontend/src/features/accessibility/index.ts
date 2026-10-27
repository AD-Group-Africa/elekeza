/** Public API of the accessibility feature (settings, theme, read-aloud). */
export {
  AccessibilitySettingsProvider,
  useAccessibilitySettings,
  defaultSettings,
  resolveTheme,
  themeSettings,
  type AccessibilitySettings,
  type AccessibilityBooleanKey,
  type Theme,
} from './AccessibilitySettingsProvider';
export { useTextToSpeech } from './useTextToSpeech';
export {
  ROLE_PALETTES,
  DEFAULT_ROLE_PALETTE,
  rolePalette,
  isRolePalette,
  readStoredRolePalette,
  applyRolePalette,
  type RolePalette,
} from './rolePalette';
export { RolePaletteSync } from './RolePaletteSync';
export { AccountThemeSync } from './AccountThemeSync';
