'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import {
  ArrowLeftStartOnRectangleIcon,
  ArrowUpTrayIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  DocumentChartBarIcon,
  HomeIcon,
  SparklesIcon,
  UserCircleIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { settings } = useAccessibilitySettings()

  const menuItems = useMemo(
    () => [
      { label: 'Dashboard', href: '/dashboard', icon: HomeIcon },
      { label: 'Profile', href: '/dashboard/profile', icon: UserCircleIcon },
      { label: 'Upload', href: '/upload', icon: ArrowUpTrayIcon },
      { label: 'History', href: '/dashboard/history', icon: DocumentChartBarIcon },
      { label: 'Settings', href: '/dashboard/settings', icon: WrenchScrewdriverIcon },
    ],
    []
  )

  const userDisplayName = user?.name?.trim() || user?.email || 'Learner'

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
    <aside
      data-app-sidebar="true"
      className={`relative flex min-h-screen flex-col border-r border-slate-200/80 bg-gradient-to-b from-slate-50 via-white to-cyan-50/40 transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-72'
      } ${settings.calmUI ? 'from-slate-100 via-slate-50 to-slate-100' : ''}`}
    >
      <div className="border-b border-slate-200/80 px-4 py-5">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed ? (
            <div>
              <p
                data-distraction="true"
                className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500"
              >
                ELEKEZA Space
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Navigation</h2>
            </div>
          ) : (
            <span
              data-distraction="true"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white"
            >
              <SparklesIcon className="h-5 w-5" />
            </span>
          )}

          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronDoubleRightIcon className="h-4 w-4" /> : <ChevronDoubleLeftIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <nav className={`flex-1 py-5 ${settings.focusMode ? 'px-2' : 'px-3'}`}>
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon

            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-md shadow-slate-900/15'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  } ${collapsed ? 'justify-center' : ''}`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                  {isActive && !collapsed && <span className="ml-auto h-2 w-2 rounded-full bg-cyan-300" />}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-200/80 bg-white/70 px-4 py-4">
        {!collapsed && (
          <div className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-xs text-slate-500">Signed in as</p>
            <p className="truncate text-sm font-semibold text-slate-900">{userDisplayName}</p>
          </div>
        )}

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`flex w-full items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 ${
            collapsed ? 'justify-center' : ''
          }`}
          title={collapsed ? 'Logout' : undefined}
        >
          <ArrowLeftStartOnRectangleIcon className="h-5 w-5" />
          {!collapsed && <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>}
        </button>
      </div>
    </aside>
  )
}
