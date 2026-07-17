'use client';

import SidebarLayout from '@/components/layout/SidebarLayout';
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings';

export default function SettingsPage() {
  const { settings, toggleSetting, setSetting } = useAccessibilitySettings();

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-8">

        {/* Display Modes */}
        <section>
          <h2 className="text-xl font-semibold text-blue-900 mb-3">Display Modes</h2>
          {[
            { label: 'Calm UI', key: 'calmUI' },
            { label: 'Focus Mode', key: 'focusMode' },
          ].map(({ label, key }) => (
            <div key={key} className="flex items-center justify-between py-2">
              <span className="text-gray-700">{label}</span>
              <button
                onClick={() => toggleSetting(key as any)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${(settings as any)[key] ? 'bg-purple-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${(settings as any)[key] ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
        </section>

        {/* Cognitive & Accessibility */}
        <section>
          <h2 className="text-xl font-semibold text-blue-900 mb-3">Cognitive & Accessibility</h2>
          {[
            { label: 'Dyslexia Support', key: 'dyslexiaSupport' },
            { label: 'ADHD Support', key: 'adhdSupport' },
            { label: 'Autism Friendly', key: 'autismFriendly' },
            { label: 'High Contrast', key: 'highContrast' },
            { label: 'Simplified Language', key: 'simplifiedLanguage' },
            { label: 'Reduced Motion', key: 'reducedMotion' },
            { label: 'Large Text', key: 'largeText' },
            { label: 'Text to Speech', key: 'textToSpeech' },
            { label: 'Reading Guide', key: 'readingGuide' },
            { label: 'Distraction‑Free Mode', key: 'distractionFreeMode' },
          ].map(({ label, key }) => (
            <div key={key} className="flex items-center justify-between py-2">
              <span className="text-gray-700">{label}</span>
              <button
                onClick={() => toggleSetting(key as any)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${(settings as any)[key] ? 'bg-purple-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${(settings as any)[key] ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
        </section>

        {/* Font & Size */}
        <section>
          <h2 className="text-xl font-semibold text-blue-900 mb-3">Display</h2>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-700">Font Family</span>
            <select
              value={settings.fontFamily}
              onChange={(e) => setSetting('fontFamily', e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
            >
              <option value="default">Default</option>
              <option value="readableSans">Readable Sans</option>
              <option value="dyslexiaFriendly">Dyslexia‑Friendly</option>
              <option value="highClarity">High Clarity</option>
            </select>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-gray-700">Font Size</span>
            <select
              value={settings.fontSize}
              onChange={(e) => setSetting('fontSize', e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-1 text-sm"
            >
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </div>
        </section>
      </div>
    </SidebarLayout>
  );
}

