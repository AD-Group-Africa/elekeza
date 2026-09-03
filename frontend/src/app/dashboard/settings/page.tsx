'use client';

import { useState, useEffect } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { ChevronDown, ChevronUp } from 'lucide-react';

type SettingCategory = {
  title: string;
  icon: string;
  settings: { key: string; label: string; description: string }[];
};

const categories: SettingCategory[] = [
  {
    title: 'Visual & Reading',
    icon: '👁️',
    settings: [
      { key: 'dyslexiaFont', label: 'Dyslexia Font', description: 'OpenDyslexic font for easier reading' },
      { key: 'highContrast', label: 'High Contrast', description: 'Increase contrast for better visibility' },
      { key: 'largeText', label: 'Large Text', description: 'Increase font size throughout the app' },
      { key: 'readingGuide', label: 'Reading Guide', description: 'Show a line guide to follow text' },
      { key: 'simplifiedLanguage', label: 'Simplified Language', description: 'Use simpler words and sentences' },
      { key: 'reduceVisualClutter', label: 'Reduce Visual Clutter', description: 'Hide non-essential elements' },
      { key: 'replaceTextWithIcons', label: 'Replace Text with Icons', description: 'Use icons instead of words where possible' },
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
      { key: 'lightTheme', label: 'Light Theme', description: 'Switch to warm sunset light mode' },
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
      { key: 'readAloud', label: 'Read Aloud', description: 'Reads text out loud' },
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

const defaultSettings: Record<string, boolean> = {};
categories.forEach(cat => cat.settings.forEach(s => defaultSettings[s.key] = false));

export default function SettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const t = setTimeout(() => {
      const saved = localStorage.getItem('elekeza-settings');
      if (saved) {
        try {
          setSettings({ ...defaultSettings, ...JSON.parse(saved) });
        } catch {}
      }
      setMounted(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('elekeza-settings', JSON.stringify(settings));
    // Apply toggles to body classes
    Object.entries(settings).forEach(([key, value]) => {
      document.body.classList.toggle('setting-' + key, value);
    });
    // Handle light theme
    document.documentElement.setAttribute('data-theme', settings.lightTheme ? 'light' : 'dark');
  }, [settings, mounted]);

  const toggleSection = (title: string) => {
    setExpanded(prev => ({ ...prev, [title]: !prev[title] }));
  };

  if (!mounted) return null;

  return (
    <SidebarLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <h2 className="text-2xl font-bold text-purple-200 mb-6">Accessibility Settings</h2>
        {categories.map(cat => (
          <div key={cat.title} className="glass-card p-4">
            <button
              onClick={() => toggleSection(cat.title)}
              className="w-full flex items-center justify-between text-left"
            >
              <h3 className="text-lg font-semibold text-purple-200">{cat.icon} {cat.title}</h3>
              {expanded[cat.title] ? <ChevronUp size={20} className="text-purple-300" /> : <ChevronDown size={20} className="text-purple-300" />}
            </button>
            {expanded[cat.title] && (
              <div className="mt-3 space-y-3">
                {cat.settings.map(s => (
                  <div key={s.key} className="flex items-center justify-between py-2 border-b border-purple-300/10">
                    <div className="flex-1">
                      <p className="text-purple-200 font-medium">{s.label}</p>
                      <p className="text-purple-400 text-xs">{s.description}</p>
                    </div>
                    <button
                      onClick={() => setSettings(prev => ({ ...prev, [s.key]: !prev[s.key] }))}
                      className={'relative inline-flex h-6 w-11 items-center rounded-full transition ' + (settings[s.key] ? 'bg-purple-600' : 'bg-gray-300')}
                    >
                      <span className={'inline-block h-4 w-4 transform rounded-full bg-white transition ' + (settings[s.key] ? 'translate-x-6' : 'translate-x-1')} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </SidebarLayout>
  );
}