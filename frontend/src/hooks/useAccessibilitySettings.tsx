'use client'

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'

const LOCAL_STORAGE_KEY = 'elekeza-settings'

export type AccessibilitySettings = {
  calmUI: boolean
  focusMode: boolean
  autismFriendly: boolean
  highContrast: boolean
  dyslexiaSupport: boolean
  adhdSupport: boolean
  cognitiveFlexSupport: boolean
  simplifiedLanguage: boolean
  reducedMotion: boolean
  readingGuide: boolean
  memorySupport: boolean
  showReminders: boolean
  stepByStepGuidance: boolean
  repeatInstructions: boolean
  autoSaveProgress: boolean
  visualTaskChecklist: boolean
  attentionSupport: boolean
  distractionFreeMode: boolean
  focusTimer: boolean
  highlightActiveSection: boolean
  limitVisibleOptions: boolean
  gentleNudges: boolean
  languageSupport: boolean
  textToSpeech: boolean
  iconTextPairing: boolean
  explanatoryTooltips: boolean
  translateContent: boolean
  visualSupport: boolean
  largeText: boolean
  reduceVisualClutter: boolean
  replaceTextWithIcons: boolean
  taskGuidance: boolean
  guidedWorkflows: boolean
  defaultSuggestions: boolean
  limitDecisionPoints: boolean
  recommendedChoiceHighlight: boolean
  taskBreakdownSteps: boolean
  audioSupport: boolean
  readTextAloud: boolean
  voiceCommands: boolean
  soundCues: boolean
  anxietySupport: boolean
  removeTimePressure: boolean
  confirmationBeforeActions: boolean
  encouragingFeedback: boolean
  fontFamily: 'default' | 'readableSans' | 'dyslexiaFriendly' | 'highClarity'
  fontSize: 'sm' | 'md' | 'lg'
}

export type AccessibilityBooleanKey = {
  [K in keyof AccessibilitySettings]: AccessibilitySettings[K] extends boolean ? K : never
}[keyof AccessibilitySettings]

type AccessibilitySettingsContextType = {
  settings: AccessibilitySettings
  setSetting: <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => void
  toggleSetting: (key: AccessibilityBooleanKey) => void
}

const defaultSettings: AccessibilitySettings = {
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
}

const AccessibilitySettingsContext = createContext<AccessibilitySettingsContextType | undefined>(undefined)

const BODY_CLASS_MAP: Record<AccessibilityBooleanKey, string> = {
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
}

export function AccessibilitySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    if (typeof window === 'undefined') {
      return defaultSettings
    }

    const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!stored) {
      return defaultSettings
    }

    try {
      return { ...defaultSettings, ...JSON.parse(stored) }
    } catch {
      return defaultSettings
    }
  })

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const body = document.body

    ;(Object.keys(BODY_CLASS_MAP) as AccessibilityBooleanKey[]).forEach((key) => {
      body.classList.toggle(BODY_CLASS_MAP[key], settings[key])
    })

    const resolvedFontSize = settings.largeText ? 'lg' : settings.fontSize
    body.classList.remove('a11y-font-sm', 'a11y-font-md', 'a11y-font-lg')
    body.classList.add(`a11y-font-${resolvedFontSize}`)

    body.classList.remove(
      'a11y-font-family-default',
      'a11y-font-family-readable-sans',
      'a11y-font-family-dyslexia-friendly',
      'a11y-font-family-high-clarity'
    )

    const fontFamilyClassMap: Record<AccessibilitySettings['fontFamily'], string> = {
      default: 'a11y-font-family-default',
      readableSans: 'a11y-font-family-readable-sans',
      dyslexiaFriendly: 'a11y-font-family-dyslexia-friendly',
      highClarity: 'a11y-font-family-high-clarity',
    }
    body.classList.add(fontFamilyClassMap[settings.fontFamily])
  }, [settings])

  const value = useMemo<AccessibilitySettingsContextType>(
    () => ({
      settings,
      setSetting: (key, value) => {
        setSettings((prev) => ({ ...prev, [key]: value }))
      },
      toggleSetting: (key) => {
        setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
      },
    }),
    [settings]
  )

  return (
    <AccessibilitySettingsContext.Provider value={value}>
      {children}
    </AccessibilitySettingsContext.Provider>
  )
}

export function useAccessibilitySettings() {
  const context = useContext(AccessibilitySettingsContext)
  if (!context) {
    throw new Error('useAccessibilitySettings must be used within AccessibilitySettingsProvider')
  }
  return context
}
