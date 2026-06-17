'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageShell from '@/components/ui/PageShell'
import { AccessibilityBooleanKey, AccessibilitySettings, useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import { useAuth } from '@/hooks/useAuth'

type SettingOption = {
  key: AccessibilityBooleanKey
  label: string
  description: string
}

type SettingsSection = {
  id: string
  title: string
  description: string
  masterKey: AccessibilityBooleanKey
  options: SettingOption[]
  defaultPreset: Partial<AccessibilitySettings>
}

type ProfilePreset = {
  id: string
  label: string
  description: string
  settings: Partial<AccessibilitySettings>
}

const sections: SettingsSection[] = [
  {
    id: 'memory',
    title: 'Memory Support',
    description: 'Helps users retain context and continue tasks with less cognitive load.',
    masterKey: 'memorySupport',
    options: [
      { key: 'showReminders', label: 'Show reminders', description: 'Display helpful reminders for unfinished tasks.' },
      { key: 'stepByStepGuidance', label: 'Step-by-step guidance mode', description: 'Show one action at a time in order.' },
      { key: 'repeatInstructions', label: 'Repeat instructions button', description: 'Make instruction replay easy at any step.' },
      { key: 'autoSaveProgress', label: 'Auto-save progress', description: 'Keep work saved automatically as users continue.' },
      { key: 'visualTaskChecklist', label: 'Visual task checklist', description: 'Show progress using a visible checklist.' },
    ],
    defaultPreset: {
      memorySupport: true,
      showReminders: true,
      stepByStepGuidance: true,
      repeatInstructions: true,
      autoSaveProgress: true,
      visualTaskChecklist: true,
    },
  },
  {
    id: 'attention',
    title: 'Attention Support',
    description: 'Designed for attention regulation and lower distraction environments.',
    masterKey: 'attentionSupport',
    options: [
      { key: 'distractionFreeMode', label: 'Distraction-free mode', description: 'Reduce non-essential interface elements.' },
      { key: 'focusTimer', label: 'Focus timer', description: 'Enable short focus sessions with breaks.' },
      { key: 'highlightActiveSection', label: 'Highlight active section', description: 'Emphasize the current step visually.' },
      { key: 'limitVisibleOptions', label: 'Limit visible options', description: 'Show fewer choices at once.' },
      { key: 'gentleNudges', label: 'Gentle nudges', description: 'Show supportive prompts to return to task.' },
    ],
    defaultPreset: {
      attentionSupport: true,
      distractionFreeMode: true,
      highlightActiveSection: true,
      limitVisibleOptions: true,
      gentleNudges: true,
    },
  },
  {
    id: 'language',
    title: 'Language Support',
    description: 'Improves comprehension with multimodal language aids.',
    masterKey: 'languageSupport',
    options: [
      { key: 'simplifiedLanguage', label: 'Simplified language mode', description: 'Prefer shorter and clearer wording.' },
      { key: 'textToSpeech', label: 'Text-to-speech', description: 'Allow reading text aloud when needed.' },
      { key: 'iconTextPairing', label: 'Icon + text pairing', description: 'Use symbols with labels for clarity.' },
      { key: 'explanatoryTooltips', label: 'Tooltips with explanations', description: 'Add quick context for terms and actions.' },
      { key: 'translateContent', label: 'Translate content', description: 'Enable translation for multilingual support.' },
    ],
    defaultPreset: {
      languageSupport: true,
      simplifiedLanguage: true,
      textToSpeech: true,
      iconTextPairing: true,
      explanatoryTooltips: true,
    },
  },
  {
    id: 'visual',
    title: 'Visual Support',
    description: 'Optimizes readability and minimizes visual overload.',
    masterKey: 'visualSupport',
    options: [
      { key: 'highContrast', label: 'High contrast mode', description: 'Increase contrast for text and controls.' },
      { key: 'largeText', label: 'Large text toggle', description: 'Increase base text size globally.' },
      { key: 'reduceVisualClutter', label: 'Reduce visual clutter', description: 'Simplify visual styling and density.' },
      { key: 'replaceTextWithIcons', label: 'Replace text with icons where possible', description: 'Use visual cues for quick recognition.' },
    ],
    defaultPreset: {
      visualSupport: true,
      highContrast: true,
      largeText: true,
      reduceVisualClutter: true,
    },
  },
  {
    id: 'guidance',
    title: 'Task Guidance',
    description: 'Supports executive function with guided decisions and workflows.',
    masterKey: 'taskGuidance',
    options: [
      { key: 'guidedWorkflows', label: 'Guided workflows', description: 'Use wizard-style flows for complex tasks.' },
      { key: 'defaultSuggestions', label: 'Default suggestions', description: 'Preselect common safe options.' },
      { key: 'limitDecisionPoints', label: 'Limit decision points', description: 'Reduce branching choices per screen.' },
      { key: 'recommendedChoiceHighlight', label: 'Recommended choice highlighting', description: 'Clearly mark best-next actions.' },
      { key: 'taskBreakdownSteps', label: 'Task breakdown into steps', description: 'Split tasks into smaller chunks.' },
    ],
    defaultPreset: {
      taskGuidance: true,
      guidedWorkflows: true,
      defaultSuggestions: true,
      limitDecisionPoints: true,
      recommendedChoiceHighlight: true,
      taskBreakdownSteps: true,
    },
  },
  {
    id: 'audio',
    title: 'Audio and Voice',
    description: 'Adds auditory pathways for interaction and understanding.',
    masterKey: 'audioSupport',
    options: [
      { key: 'readTextAloud', label: 'Read text aloud', description: 'Enable narrated reading for content.' },
      { key: 'voiceCommands', label: 'Voice commands', description: 'Allow basic voice-based interactions.' },
      { key: 'soundCues', label: 'Sound cues for actions', description: 'Play subtle audio feedback on actions.' },
    ],
    defaultPreset: {
      audioSupport: true,
      readTextAloud: true,
      voiceCommands: true,
      soundCues: true,
    },
  },
  {
    id: 'calm',
    title: 'Calm Mode',
    description: 'Reduces anxiety and cognitive overload during use.',
    masterKey: 'anxietySupport',
    options: [
      { key: 'calmUI', label: 'Calm mode visuals', description: 'Use softer colors and reduced visual intensity.' },
      { key: 'removeTimePressure', label: 'Remove time pressure indicators', description: 'Hide urgency cues when possible.' },
      { key: 'confirmationBeforeActions', label: 'Confirmation before actions', description: 'Ask before significant actions.' },
      { key: 'encouragingFeedback', label: 'Encouraging feedback messages', description: 'Use supportive messages after actions.' },
      { key: 'reducedMotion', label: 'Reduced motion', description: 'Limit unnecessary animations.' },
    ],
    defaultPreset: {
      anxietySupport: true,
      calmUI: true,
      removeTimePressure: true,
      confirmationBeforeActions: true,
      encouragingFeedback: true,
      reducedMotion: true,
    },
  },
]

const profilePresets: ProfilePreset[] = [
  {
    id: 'easy',
    label: 'Easy Mode',
    description: 'General simplification for quick readability and low complexity.',
    settings: {
      simplifiedLanguage: true,
      iconTextPairing: true,
      defaultSuggestions: true,
      limitDecisionPoints: true,
      reduceVisualClutter: true,
      calmUI: true,
      fontFamily: 'highClarity',
    },
  },
  {
    id: 'focus',
    label: 'Focus Mode',
    description: 'Prioritizes attention, less distraction, and clear active tasks.',
    settings: {
      attentionSupport: true,
      distractionFreeMode: true,
      focusMode: true,
      highlightActiveSection: true,
      limitVisibleOptions: true,
      gentleNudges: true,
      reducedMotion: true,
      fontFamily: 'readableSans',
    },
  },
  {
    id: 'guided',
    label: 'Guided Mode',
    description: 'Step-by-step experience for memory, comprehension, and planning.',
    settings: {
      memorySupport: true,
      showReminders: true,
      stepByStepGuidance: true,
      repeatInstructions: true,
      taskGuidance: true,
      guidedWorkflows: true,
      recommendedChoiceHighlight: true,
      taskBreakdownSteps: true,
      simplifiedLanguage: true,
      fontFamily: 'readableSans',
    },
  },
]

export default function SettingsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { settings, setSetting, toggleSetting } = useAccessibilitySettings()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    memory: true,
    attention: true,
    language: true,
    visual: false,
    guidance: false,
    audio: false,
    calm: false,
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-white to-indigo-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-gray-700">Loading...</p>
        </div>
      </div>
    )
  }

  const toggleClasses = (active: boolean) =>
    `relative inline-flex h-6 w-12 items-center rounded-full border-2 transition-colors duration-300 ${
      active ? 'border-slate-800 bg-slate-800' : 'border-slate-300 bg-slate-200'
    }`

  const switchClasses = (active: boolean) =>
    `inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-300 ${
      active ? 'translate-x-6' : 'translate-x-1'
    }`

  const applyPartialSettings = (updates: Partial<AccessibilitySettings>) => {
    Object.entries(updates).forEach(([key, value]) => {
      setSetting(key as keyof AccessibilitySettings, value as AccessibilitySettings[keyof AccessibilitySettings])
    })
  }

  const turnOffProfile = (profile: ProfilePreset) => {
    Object.entries(profile.settings).forEach(([key, value]) => {
      if (typeof value === 'boolean') {
        setSetting(key as keyof AccessibilitySettings, false as AccessibilitySettings[keyof AccessibilitySettings])
      } else if (key === 'fontFamily') {
        setSetting('fontFamily', 'default')
      } else if (key === 'fontSize') {
        setSetting('fontSize', 'md')
      }
    })
  }

  const applySectionDefaults = (section: SettingsSection) => {
    applyPartialSettings(section.defaultPreset)
  }

  const disableSection = (section: SettingsSection) => {
    setSetting(section.masterKey, false)
    section.options.forEach((option) => {
      setSetting(option.key, false)
    })
  }

  return (
    <PageShell
      withSidebar
      calmUI={settings.calmUI}
      focusMode={settings.focusMode}
      showAccessibilityToolbar
      onCalmToggle={() => toggleSetting('calmUI')}
      onFocusToggle={() => toggleSetting('focusMode')}
    >
      <section className="mb-6 rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-md">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Accessibility Settings</p>
        <h1 className="mt-2 text-3xl font-bold">Cognitive Support Configuration</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-200">
          Start with memory, attention, and language support first. Apply a profile for quick setup, then adjust detailed
          toggles by support group.
        </p>
      </section>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Profiles</h2>
        <p className="mt-1 text-sm text-slate-600">Apply grouped settings instantly for common support needs.</p>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {profilePresets.map((profile) => (
            <article key={profile.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{profile.label}</h3>
              <p className="mt-1 text-xs text-slate-600">{profile.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPartialSettings(profile.settings)}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                >
                  Apply {profile.label}
                </button>
                <button
                  type="button"
                  onClick={() => turnOffProfile(profile)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                >
                  Turn Off
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Global Display</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="max-w-sm">
            <label className="mb-2 block text-sm font-semibold text-slate-900">Base Font Size</label>
            <select
              value={settings.fontSize}
              onChange={(e) => setSetting('fontSize', e.target.value as 'sm' | 'md' | 'lg')}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </div>

          <div className="max-w-sm">
            <label className="mb-2 block text-sm font-semibold text-slate-900">Reading Font</label>
            <select
              value={settings.fontFamily}
              onChange={(e) =>
                setSetting(
                  'fontFamily',
                  e.target.value as 'default' | 'readableSans' | 'dyslexiaFriendly' | 'highClarity'
                )
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              <option value="default">Default</option>
              <option value="readableSans">Readable Sans</option>
              <option value="dyslexiaFriendly">Dyslexia-Friendly</option>
              <option value="highClarity">High Clarity</option>
            </select>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-slate-900">Support Sections</h2>
        <div className="space-y-4">
          {sections.map((section) => {
            const isExpanded = Boolean(expanded[section.id])
            const masterActive = settings[section.masterKey]

            return (
              <article key={section.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{section.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400"
                    >
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </button>

                    <button
                      type="button"
                      aria-pressed={masterActive}
                      aria-label={`Toggle ${section.title}`}
                      className={toggleClasses(masterActive)}
                      onClick={() => setSetting(section.masterKey, !masterActive)}
                    >
                      <span className={switchClasses(masterActive)} />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applySectionDefaults(section)}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                  >
                    Apply Recommended
                  </button>
                  <button
                    type="button"
                    onClick={() => disableSection(section)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-400"
                  >
                    Turn Section Off
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {section.options.map((option) => {
                      const active = settings[option.key]
                      return (
                        <div key={option.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                              <p className="mt-1 text-xs text-slate-600">{option.description}</p>
                            </div>
                            <button
                              type="button"
                              aria-pressed={active}
                              aria-label={`Toggle ${option.label}`}
                              className={toggleClasses(active)}
                              onClick={() => setSetting(option.key, !active)}
                            >
                              <span className={switchClasses(active)} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <p className="mt-8 text-sm text-slate-600">
        Settings are auto-saved and persist for this learner profile across pages.
      </p>
    </PageShell>
  )
}
