'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { PageHeader, Switch } from '@/components/ui';
import { useAuth } from '@/features/auth';
import {
  type AccessibilityBooleanKey,
  type AccessibilitySettings,
  resolveTheme,
  useAccessibilitySettings,
} from '../AccessibilitySettingsProvider';
import { accessibilityApi, type ServerAccessibilityProfile } from '../api';

/** A toggle is either a plain boolean setting or the dyslexia-friendly font. */
type SettingKey = AccessibilityBooleanKey | 'dyslexiaFont';

type SettingCategory = {
  title: string;
  icon: string;
  settings: { key: SettingKey; label: string; description: string }[];
};

const categories: SettingCategory[] = [
  {
    title: 'Visual & Reading',
    icon: '👁️',
    settings: [
      { key: 'dyslexiaFont', label: 'Dyslexia Font', description: 'A dyslexia-friendly typeface for easier reading' },
      { key: 'highContrast', label: 'High Contrast', description: 'Increase contrast for better visibility' },
      { key: 'largeText', label: 'Large Text', description: 'Increase font size throughout the app' },
      { key: 'readingGuide', label: 'Reading Guide', description: 'Show a line guide to follow text' },
      { key: 'simplifiedLanguage', label: 'Simplified Language', description: 'Use simpler words and sentences' },
      { key: 'reduceVisualClutter', label: 'Reduce Visual Clutter', description: 'Hide non-essential elements' },
      {
        key: 'replaceTextWithIcons',
        label: 'Replace Text with Icons',
        description: 'Use icons instead of words where possible',
      },
    ],
  },
  {
    title: 'Focus & Attention',
    icon: '🎯',
    settings: [
      { key: 'focusMode', label: 'Focus Mode', description: 'Minimize distractions, show only what you need' },
      { key: 'distractionFreeMode', label: 'Distraction-Free Mode', description: 'Remove background elements' },
      { key: 'focusTimer', label: 'Focus Timer', description: 'Show a countdown timer for focused work' },
      { key: 'highlightActiveSection', label: 'Highlight Active Section', description: 'Emphasize the current task' },
      { key: 'limitVisibleOptions', label: 'Limit Visible Options', description: 'Show fewer choices at a time' },
      { key: 'gentleNudges', label: 'Gentle Nudges', description: 'Friendly reminders to stay on track' },
    ],
  },
  {
    title: 'Appearance',
    icon: '🎨',
    settings: [
      { key: 'lightTheme', label: 'Light Theme', description: 'Switch to a clean paper-and-moss light mode' },
      {
        key: 'calmMode',
        label: 'Calm Mode',
        description: 'Low-stimulation theme: softer contrast, larger text, still screens',
      },
    ],
  },
  {
    title: 'Cognitive Support',
    icon: '🧠',
    settings: [
      { key: 'cognitiveFlexSupport', label: 'Cognitive Flexibility', description: 'Help switching between tasks' },
      { key: 'memorySupport', label: 'Memory Support', description: 'Show hints and reminders' },
      { key: 'stepByStepGuidance', label: 'Step-by-Step Guidance', description: 'Break tasks into small steps' },
      { key: 'taskBreakdownSteps', label: 'Task Breakdown', description: 'Show each step clearly' },
      { key: 'autoSaveProgress', label: 'Auto-Save Progress', description: 'Never lose your work' },
      { key: 'defaultSuggestions', label: 'Default Suggestions', description: 'Provide helpful prompts' },
      { key: 'limitDecisionPoints', label: 'Limit Decision Points', description: 'Reduce overwhelming choices' },
      { key: 'recommendedChoiceHighlight', label: 'Highlight Recommended', description: 'Show best option first' },
    ],
  },
  {
    title: 'Audio & Language',
    icon: '🔊',
    settings: [
      { key: 'readTextAloud', label: 'Read Aloud', description: 'Show a Listen button that reads lessons out loud' },
      { key: 'textToSpeech', label: 'Text to Speech', description: 'Convert text to spoken words' },
      { key: 'voiceCommands', label: 'Voice Commands', description: 'Control with your voice' },
      { key: 'soundCues', label: 'Sound Cues', description: 'Audio signals for actions' },
      { key: 'iconTextPairing', label: 'Icon-Text Pairing', description: 'Show icons next to text' },
      { key: 'explanatoryTooltips', label: 'Explanatory Tooltips', description: 'Explanations on hover/tap' },
      { key: 'translateContent', label: 'Translate Content', description: 'Translate into Kiswahili' },
    ],
  },
  {
    title: 'Emotional Support',
    icon: '💙',
    settings: [
      { key: 'anxietySupport', label: 'Anxiety Support', description: 'Reduce time pressure and stress' },
      { key: 'removeTimePressure', label: 'Remove Time Pressure', description: 'No countdowns or deadlines' },
      { key: 'confirmationBeforeActions', label: 'Confirm Before Actions', description: 'Ask before doing something' },
      { key: 'encouragingFeedback', label: 'Encouraging Feedback', description: 'Positive, supportive messages' },
      { key: 'repeatInstructions', label: 'Repeat Instructions', description: 'Show instructions again if needed' },
    ],
  },
  {
    title: 'Teacher-Directed Features',
    icon: '👩‍🏫',
    settings: [
      { key: 'calmUI', label: 'Calm UI', description: 'Reduce stimulations, muted colors' },
      { key: 'autismFriendly', label: 'Autism-Friendly Mode', description: 'Predictable, structured interface' },
      { key: 'adhdSupport', label: 'ADHD Support', description: 'Movement breaks, focus tools' },
      { key: 'dyslexiaSupport', label: 'Dyslexia Support', description: 'Font, spacing, and reading aids' },
      { key: 'visualTaskChecklist', label: 'Visual Task Checklist', description: 'See your progress as pictures' },
      { key: 'attentionSupport', label: 'Attention Support', description: 'Tools to maintain focus' },
      { key: 'guidedWorkflows', label: 'Guided Workflows', description: 'Step-by-step wizards' },
    ],
  },
];

/** The subset of settings the server-side accessibility profile understands. */
function toServerProfile(s: AccessibilitySettings): ServerAccessibilityProfile {
  return {
    theme: resolveTheme(s),
    reducedMotion: s.reduceVisualClutter || s.reducedMotion,
    highContrastFocus: s.highContrast,
    ttsEnabled: s.readTextAloud || s.textToSpeech,
    plainLanguage: s.simplifiedLanguage,
  };
}

/**
 * Accessibility settings. Applied instantly on this device (via the shared
 * AccessibilitySettingsProvider) and mirrored to the learner's server-side
 * accessibility profile when the user changes something, so choices follow
 * them to other devices.
 */
export default function AccessibilitySettingsScreen() {
  const { settings, setSetting, toggleSetting } = useAccessibilitySettings();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const changedByUser = useRef(false);

  // Settings come from localStorage, which the server cannot see: render the
  // toggles only after mount so they never flash the wrong state.
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  // Debounced server mirror — only after a real change on this page.
  useEffect(() => {
    if (!changedByUser.current || !user) return;
    const timer = setTimeout(() => {
      accessibilityApi.saveProfile(user.learnerId, toServerProfile(settings)).catch(() => undefined);
    }, 800);
    return () => clearTimeout(timer);
  }, [settings, user]);

  const isOn = (key: SettingKey) =>
    key === 'dyslexiaFont' ? settings.fontFamily === 'dyslexiaFriendly' : settings[key];

  const toggle = (key: SettingKey) => {
    changedByUser.current = true;
    if (key === 'dyslexiaFont') {
      setSetting('fontFamily', settings.fontFamily === 'dyslexiaFriendly' ? 'default' : 'dyslexiaFriendly');
    } else {
      toggleSetting(key);
    }
  };

  const toggleSection = (title: string) => {
    setExpanded((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4" aria-busy={!mounted}>
      <PageHeader
        title="Accessibility Settings"
        description="Changes apply instantly on this device and follow you to others."
      />
      {!mounted ? (
        <p className="text-purple-300" aria-live="polite">
          Loading your settings…
        </p>
      ) : (
        categories.map((cat) => {
          const open = Boolean(expanded[cat.title]);
          const panelId = `settings-${cat.title.replace(/\W+/g, '-').toLowerCase()}`;
          return (
            <div key={cat.title} className="glass-card p-4">
              <button
                onClick={() => toggleSection(cat.title)}
                aria-expanded={open}
                aria-controls={panelId}
                className="w-full flex items-center justify-between text-left"
              >
                <h2 className="text-lg font-semibold text-purple-200">
                  {cat.icon} {cat.title}
                </h2>
                {open ? (
                  <ChevronUp size={20} className="text-purple-300" />
                ) : (
                  <ChevronDown size={20} className="text-purple-300" />
                )}
              </button>
              {open && (
                <div id={panelId} className="mt-3 space-y-3">
                  {cat.settings.map((s) => {
                    const on = isOn(s.key);
                    return (
                      <div key={s.key} className="flex items-center justify-between py-2 border-b border-purple-300/10">
                        <div className="flex-1">
                          <p className="text-purple-200 font-medium">{s.label}</p>
                          <p className="text-purple-400 text-xs">{s.description}</p>
                        </div>
                        <Switch label={s.label} checked={on} onChange={() => toggle(s.key)} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
