'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { SETTINGS_STORAGE_KEY } from '@/lib/storageKeys';

export type Theme = 'dark' | 'light' | 'calm';

export type AccessibilitySettings = {
  // Appearance
  lightTheme: boolean;
  calmMode: boolean;
  // Presentation / support toggles
  calmUI: boolean;
  focusMode: boolean;
  autismFriendly: boolean;
  highContrast: boolean;
  dyslexiaSupport: boolean;
  adhdSupport: boolean;
  cognitiveFlexSupport: boolean;
  simplifiedLanguage: boolean;
  reducedMotion: boolean;
  readingGuide: boolean;
  memorySupport: boolean;
  showReminders: boolean;
  stepByStepGuidance: boolean;
  repeatInstructions: boolean;
  autoSaveProgress: boolean;
  visualTaskChecklist: boolean;
  attentionSupport: boolean;
  distractionFreeMode: boolean;
  focusTimer: boolean;
  highlightActiveSection: boolean;
  limitVisibleOptions: boolean;
  gentleNudges: boolean;
  languageSupport: boolean;
  textToSpeech: boolean;
  iconTextPairing: boolean;
  explanatoryTooltips: boolean;
  translateContent: boolean;
  visualSupport: boolean;
  largeText: boolean;
  reduceVisualClutter: boolean;
  replaceTextWithIcons: boolean;
  taskGuidance: boolean;
  guidedWorkflows: boolean;
  defaultSuggestions: boolean;
  limitDecisionPoints: boolean;
  recommendedChoiceHighlight: boolean;
  taskBreakdownSteps: boolean;
  audioSupport: boolean;
  readTextAloud: boolean;
  voiceCommands: boolean;
  soundCues: boolean;
  anxietySupport: boolean;
  removeTimePressure: boolean;
  confirmationBeforeActions: boolean;
  encouragingFeedback: boolean;
  fontFamily: 'default' | 'readableSans' | 'dyslexiaFriendly' | 'highClarity';
  fontSize: 'sm' | 'md' | 'lg';
};

export type AccessibilityBooleanKey = {
  [K in keyof AccessibilitySettings]: AccessibilitySettings[K] extends boolean ? K : never;
}[keyof AccessibilitySettings];

type AccessibilitySettingsContextType = {
  settings: AccessibilitySettings;
  theme: Theme;
  setSetting: <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => void;
  toggleSetting: (key: AccessibilityBooleanKey) => void;
};

export const defaultSettings: AccessibilitySettings = {
  lightTheme: false,
  calmMode: false,
  calmUI: false,
  focusMode: false,
  autismFriendly: false,
  highContrast: false,
  dyslexiaSupport: false,
  adhdSupport: false,
  cognitiveFlexSupport: false,
  simplifiedLanguage: false,
  reducedMotion: false,
  readingGuide: false,
  memorySupport: false,
  showReminders: false,
  stepByStepGuidance: false,
  repeatInstructions: false,
  autoSaveProgress: true,
  visualTaskChecklist: false,
  attentionSupport: false,
  distractionFreeMode: false,
  focusTimer: false,
  highlightActiveSection: false,
  limitVisibleOptions: false,
  gentleNudges: false,
  languageSupport: false,
  textToSpeech: false,
  iconTextPairing: true,
  explanatoryTooltips: false,
  translateContent: false,
  visualSupport: false,
  largeText: false,
  reduceVisualClutter: false,
  replaceTextWithIcons: false,
  taskGuidance: false,
  guidedWorkflows: false,
  defaultSuggestions: true,
  limitDecisionPoints: false,
  recommendedChoiceHighlight: false,
  taskBreakdownSteps: false,
  audioSupport: false,
  readTextAloud: false,
  voiceCommands: false,
  soundCues: false,
  anxietySupport: false,
  removeTimePressure: false,
  confirmationBeforeActions: true,
  encouragingFeedback: true,
  fontFamily: 'default',
  fontSize: 'md',
};

/** Theme precedence: Calm > Light > Dark (default). */
export function resolveTheme(s: Pick<AccessibilitySettings, 'calmMode' | 'lightTheme'>): Theme {
  if (s.calmMode) return 'calm';
  if (s.lightTheme) return 'light';
  return 'dark';
}

/**
 * the settings that produce `theme` (the inverse of resolveTheme), or null for
 * an unknown value. calm leaves lightTheme alone so turning calm off later
 * returns the user to the mode they had underneath.
 */
export function themeSettings(theme: unknown): Partial<Pick<AccessibilitySettings, 'calmMode' | 'lightTheme'>> | null {
  if (theme === 'calm') return { calmMode: true };
  if (theme === 'light') return { calmMode: false, lightTheme: true };
  if (theme === 'dark') return { calmMode: false, lightTheme: false };
  return null;
}

/**
 * Reads stored settings, upgrading keys written by older versions of the
 * settings page (`readAloud`, `dyslexiaFont`) so nobody loses a preference.
 */
function readStoredSettings(): AccessibilitySettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaultSettings;
    const stored = JSON.parse(raw) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...defaultSettings };
    for (const key of Object.keys(defaultSettings)) {
      if (key in stored) merged[key] = stored[key];
    }
    if (stored.readAloud === true) merged.readTextAloud = true;
    if (stored.dyslexiaFont === true && merged.fontFamily === 'default') merged.fontFamily = 'dyslexiaFriendly';
    return merged as AccessibilitySettings;
  } catch {
    return defaultSettings;
  }
}

const AccessibilitySettingsContext = createContext<AccessibilitySettingsContextType | undefined>(undefined);

const BODY_CLASS_MAP: Partial<Record<AccessibilityBooleanKey, string>> = {
  calmUI: 'a11y-calm-ui',
  focusMode: 'a11y-focus-mode',
  autismFriendly: 'a11y-autism-friendly',
  highContrast: 'a11y-high-contrast',
  dyslexiaSupport: 'a11y-dyslexia-support',
  adhdSupport: 'a11y-adhd-support',
  cognitiveFlexSupport: 'a11y-cognitive-flex-support',
  simplifiedLanguage: 'a11y-simplified-language',
  reducedMotion: 'a11y-reduced-motion',
  readingGuide: 'a11y-reading-guide',
  memorySupport: 'a11y-memory-support',
  showReminders: 'a11y-show-reminders',
  stepByStepGuidance: 'a11y-step-by-step-guidance',
  repeatInstructions: 'a11y-repeat-instructions',
  autoSaveProgress: 'a11y-auto-save-progress',
  visualTaskChecklist: 'a11y-task-checklist',
  attentionSupport: 'a11y-attention-support',
  distractionFreeMode: 'a11y-distraction-free',
  focusTimer: 'a11y-focus-timer',
  highlightActiveSection: 'a11y-highlight-active',
  limitVisibleOptions: 'a11y-limit-options',
  gentleNudges: 'a11y-gentle-nudges',
  languageSupport: 'a11y-language-support',
  textToSpeech: 'a11y-text-to-speech',
  iconTextPairing: 'a11y-icon-text-pairing',
  explanatoryTooltips: 'a11y-explanatory-tooltips',
  translateContent: 'a11y-translate-content',
  visualSupport: 'a11y-visual-support',
  largeText: 'a11y-large-text',
  reduceVisualClutter: 'a11y-reduce-visual-clutter',
  replaceTextWithIcons: 'a11y-replace-text-icons',
  taskGuidance: 'a11y-task-guidance',
  guidedWorkflows: 'a11y-guided-workflows',
  defaultSuggestions: 'a11y-default-suggestions',
  limitDecisionPoints: 'a11y-limit-decision-points',
  recommendedChoiceHighlight: 'a11y-recommended-choice',
  taskBreakdownSteps: 'a11y-task-breakdown',
  audioSupport: 'a11y-audio-support',
  readTextAloud: 'a11y-read-text-aloud',
  voiceCommands: 'a11y-voice-commands',
  soundCues: 'a11y-sound-cues',
  anxietySupport: 'a11y-anxiety-support',
  removeTimePressure: 'a11y-remove-time-pressure',
  confirmationBeforeActions: 'a11y-confirm-before-actions',
  encouragingFeedback: 'a11y-encouraging-feedback',
};

const FONT_FAMILY_CLASS: Record<AccessibilitySettings['fontFamily'], string> = {
  default: 'a11y-font-family-default',
  readableSans: 'a11y-font-family-readable-sans',
  dyslexiaFriendly: 'a11y-font-family-dyslexia-friendly',
  highClarity: 'a11y-font-family-high-clarity',
};

export function AccessibilitySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(readStoredSettings);
  const theme = resolveTheme(settings);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* storage may be unavailable (private mode); settings still apply */
    }
  }, [settings]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.setAttribute('data-theme', theme);
    body.classList.toggle('calm-mode', theme === 'calm');

    for (const [key, className] of Object.entries(BODY_CLASS_MAP)) {
      body.classList.toggle(className, Boolean(settings[key as AccessibilityBooleanKey]));
    }

    const resolvedFontSize = settings.largeText ? 'lg' : settings.fontSize;
    body.classList.remove('a11y-font-sm', 'a11y-font-md', 'a11y-font-lg');
    body.classList.add(`a11y-font-${resolvedFontSize}`);

    body.classList.remove(...Object.values(FONT_FAMILY_CLASS));
    body.classList.add(FONT_FAMILY_CLASS[settings.fontFamily]);
  }, [settings, theme]);

  const value = useMemo<AccessibilitySettingsContextType>(
    () => ({
      settings,
      theme,
      setSetting: (key, next) => setSettings((prev) => ({ ...prev, [key]: next })),
      toggleSetting: (key) => setSettings((prev) => ({ ...prev, [key]: !prev[key] })),
    }),
    [settings, theme],
  );

  return <AccessibilitySettingsContext.Provider value={value}>{children}</AccessibilitySettingsContext.Provider>;
}

export function useAccessibilitySettings() {
  const context = useContext(AccessibilitySettingsContext);
  if (!context) {
    throw new Error('useAccessibilitySettings must be used within AccessibilitySettingsProvider');
  }
  return context;
}
