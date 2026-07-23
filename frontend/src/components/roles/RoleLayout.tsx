'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { ReactNode, useState } from 'react'
import AccessibilityToolbar from '@/components/AccessibilityToolbar'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import { useAuth } from '@/hooks/useAuth'
import { RoleConfig } from '@/components/roles/roleConfig'

type RoleLayoutProps = {
  config: RoleConfig
  children: ReactNode
}

export default function RoleLayout({ config, children }: RoleLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { settings, toggleSetting } = useAccessibilitySettings()
  const { logout, user } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await logout()
    } finally {
      router.replace('/login')
      router.refresh()
      setIsLoggingOut(false)
    }
  }

  return (
    <div className={`flex min-h-screen ${settings.calmUI ? 'bg-slate-100 text-slate-900' : 'bg-slate-50 text-slate-900'}`}>
      <aside
        data-app-sidebar="true"
        className="w-72 shrink-0 border-r border-slate-200 bg-gradient-to-b from-slate-50 via-white to-cyan-50/50"
      >
        <div className="border-b border-slate-200 px-4 py-5">
          <p data-distraction="true" className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-300">
            Role Profile
          </p>
          <h1 className="mt-1 text-lg font-bold text-slate-900">{config.roleLabel}</h1>
          <p className="mt-1 text-xs text-slate-600">{config.subtitle}</p>
        </div>

        <nav className="p-3">
          <ul className="space-y-2">
            {config.navItems.map((item) => {
              const active = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="mt-auto border-t border-slate-200 p-3">
          <div className="mb-3 rounded-lg border border-slate-200 glass-card p-3">
            <p className="text-xs text-purple-300">Signed in as</p>
            <p className="truncate text-sm font-semibold text-slate-900">{user?.email ?? 'User'}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <main className={`flex-1 p-6 ${settings.focusMode ? 'mx-auto w-full max-w-6xl' : ''}`}>
          <AccessibilityToolbar
            calmUI={settings.calmUI}
            focusMode={settings.focusMode}
            onCalmToggle={() => toggleSetting('calmUI')}
            onFocusToggle={() => toggleSetting('focusMode')}
          />
          {children}
        </main>
        <footer className="border-t border-slate-200 glass-card px-6 py-4 text-center text-sm text-purple-300">
          Copyright 2026 DocuEase. All rights reserved.
        </footer>
      </div>
    </div>
  )
}

