'use client'

import { ReactNode } from 'react'
import Sidebar from '@/components/Sidebar'
import AccessibilityToolbar from '@/components/AccessibilityToolbar'

type PageShellProps = {
  children: ReactNode
  footerText?: string
  withSidebar?: boolean
  showAccessibilityToolbar?: boolean
  calmUI?: boolean
  focusMode?: boolean
  onCalmToggle?: () => void
  onFocusToggle?: () => void
}

export default function PageShell({
  children,
  footerText = 'Copyright 2026 Elekeza. All rights reserved.',
  withSidebar = true,
  showAccessibilityToolbar = false,
  calmUI = false,
  focusMode = false,
  onCalmToggle,
  onFocusToggle,
}: PageShellProps) {
  const containerClass = withSidebar
    ? `flex min-h-screen ${calmUI ? 'bg-slate-100 text-slate-900' : 'bg-slate-50 text-slate-900'}`
    : 'min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 p-6 text-slate-900'

  return (
    <div className={containerClass}>
      {withSidebar && <Sidebar />}

      <div className="flex flex-1 flex-col">
        <main className={`flex-1 p-6 ${focusMode ? 'mx-auto w-full max-w-6xl' : ''}`}>
          {showAccessibilityToolbar && onCalmToggle && onFocusToggle && (
            <AccessibilityToolbar
              calmUI={calmUI}
              focusMode={focusMode}
              onCalmToggle={onCalmToggle}
              onFocusToggle={onFocusToggle}
            />
          )}
          {children}
        </main>
        <footer className="border-t border-slate-200 glass-card px-6 py-4 text-center text-sm text-purple-300">
          {footerText}
        </footer>
      </div>
    </div>
  )
}


