/** Public API of the accessibility feature (settings, theme, read-aloud). */
export {
  AccessibilitySettingsProvider,
  useAccessibilitySettings,
  defaultSettings,
  resolveTheme,
  type AccessibilitySettings,
  type AccessibilityBooleanKey,
  type Theme,
} from './AccessibilitySettingsProvider';
export { useTextToSpeech } from './useTextToSpeech';
export { ReadingGuide } from './ReadingGuide';
