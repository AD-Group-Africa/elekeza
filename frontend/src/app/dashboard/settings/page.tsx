'use client';

import { useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';

export default function SettingsPage() {
  const [focusMode, setFocusMode] = useState(false);
  const [calmUI, setCalmUI] = useState(false);
  const [dyslexiaFont, setDyslexiaFont] = useState(false);

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
      </div>

      {/* Inner container with light background – the old calm look */}
      <div className="bg-gray-50 rounded-2xl p-6 space-y-8">

        {/* Display Modes */}
        <section>
          <h2 className="text-xl font-semibold text-blue-900 mb-3">Display Modes</h2>
          <div className="flex gap-4">
            <button
              onClick={() => setCalmUI(!calmUI)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${calmUI ? 'bg-purple-100 text-purple-700' : 'bg-white border border-gray-300 text-gray-700'}`}
            >
              Calm UI
            </button>
            <button
              onClick={() => setFocusMode(!focusMode)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${focusMode ? 'bg-purple-100 text-purple-700' : 'bg-white border border-gray-300 text-gray-700'}`}
            >
              Focus Mode
            </button>
          </div>
        </section>

        {/* Accessibility */}
        <section>
          <h2 className="text-xl font-semibold text-blue-900 mb-3">Accessibility</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-700">Dyslexia-friendly font</span>
              <button
                onClick={() => setDyslexiaFont(!dyslexiaFont)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${dyslexiaFont ? 'bg-purple-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${dyslexiaFont ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-700">Reduced motion</span>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full transition bg-gray-300">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white transition translate-x-1" />
              </button>
            </div>
          </div>
        </section>

        {/* Profiles */}
        <section>
          <h2 className="text-xl font-semibold text-blue-900 mb-3">Profiles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['Easy Mode', 'Focus Mode', 'Guided Mode'].map(profile => (
              <button key={profile} className="btn-outline w-full py-4 text-center">
                {profile}
              </button>
            ))}
          </div>
        </section>
      </div>
    </SidebarLayout>
  );
}
