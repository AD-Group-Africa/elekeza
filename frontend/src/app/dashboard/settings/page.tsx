'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import AccessibilityToolbar from '@/components/AccessibilityToolbar'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import { useAuth } from '@/hooks/useAuth'

export default function SettingsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { settings, toggleSetting, setSetting } = useAccessibilitySettings()
  const toggleClasses = (active: boolean) =>
    `w-12 h-6 rounded-full relative transition-colors duration-300 cursor-pointer border-2 ${
      active ? 'bg-primary-500 border-primary-700' : 'bg-gray-200 border-gray-400'
    }`
  const switchClasses = (active: boolean) =>
    `absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-300 ${
      active ? 'translate-x-6 bg-primary-500' : ''
    }`

  const bgClass = settings.calmUI
    ? settings.autismFriendly ? 'bg-primary-50 text-gray-900' : 'bg-gray-100 text-gray-900'
    : settings.highContrast ? 'bg-black text-white' : 'bg-gray-50 text-gray-800'

  const fontClass =
    settings.fontSize === 'sm' ? 'text-sm' : settings.fontSize === 'lg' ? 'text-lg' : 'text-base'

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-elekeza-indigo mx-auto mb-4"></div>
          <p className="text-gray-700">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex min-h-screen ${bgClass} ${fontClass}`}>
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <main className={`flex-1 p-6 ${settings.focusMode ? 'max-w-4xl mx-auto' : ''}`}>
          <AccessibilityToolbar
            calmUI={settings.calmUI}
            focusMode={settings.focusMode}
            onCalmToggle={() => toggleSetting('calmUI')}
            onFocusToggle={() => toggleSetting('focusMode')}
          />

          <h1 className="text-3xl font-bold text-primary-700 mb-8">Settings</h1>

          <div className="space-y-6 max-w-md">
            {['calmUI', 'focusMode', 'autismFriendly', 'highContrast'].map((key) => (
              <div key={key} className="flex items-center justify-between">
                <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                <div
                  className={toggleClasses(settings[key as 'calmUI' | 'focusMode' | 'autismFriendly' | 'highContrast'])}
                  onClick={() => toggleSetting(key as 'calmUI' | 'focusMode' | 'autismFriendly' | 'highContrast')}
                >
                  <div className={switchClasses(settings[key as 'calmUI' | 'focusMode' | 'autismFriendly' | 'highContrast'])} />
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between">
              <label className="font-medium">Font Size</label>
              <select
                value={settings.fontSize}
                onChange={(e) => setSetting('fontSize', e.target.value as 'sm' | 'md' | 'lg')}
                className="border border-gray-300 rounded px-3 py-1 bg-white text-gray-800 hover:border-gray-400 transition"
              >
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
              </select>
            </div>
          </div>

          <p className="mt-8 text-sm text-gray-600">
            Settings are auto-saved and applied across all pages until you change them.
          </p>
        </main>

        <footer className="p-4 text-center bg-gray-100 text-gray-600 border-t border-gray-200">
          Copyright 2026 DocuEase. All rights reserved.
        </footer>
      </div>
    </div>
  )
}
