'use client'

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'

const LOCAL_STORAGE_KEY = 'docuease-settings'

export type AccessibilitySettings = {
  calmUI: boolean
  focusMode: boolean
  autismFriendly: boolean
  highContrast: boolean
  fontSize: 'sm' | 'md' | 'lg'
}

type AccessibilitySettingsContextType = {
  settings: AccessibilitySettings
  setSetting: <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => void
  toggleSetting: (key: 'calmUI' | 'focusMode' | 'autismFriendly' | 'highContrast') => void
}

const defaultSettings: AccessibilitySettings = {
  calmUI: false,
  focusMode: false,
  autismFriendly: false,
  highContrast: false,
  fontSize: 'md',
}

const AccessibilitySettingsContext = createContext<AccessibilitySettingsContextType | undefined>(undefined)

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
    body.classList.toggle('a11y-calm-ui', settings.calmUI)
    body.classList.toggle('a11y-focus-mode', settings.focusMode)
    body.classList.toggle('a11y-autism-friendly', settings.autismFriendly)
    body.classList.toggle('a11y-high-contrast', settings.highContrast)

    body.classList.remove('a11y-font-sm', 'a11y-font-md', 'a11y-font-lg')
    body.classList.add(`a11y-font-${settings.fontSize}`)
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
