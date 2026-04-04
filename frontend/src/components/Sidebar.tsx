'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import {
  ArrowLeftStartOnRectangleIcon,
  ArrowUpTrayIcon,
  DocumentChartBarIcon,
  HomeIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  const menuItems = useMemo(
    () => [
      { label: 'Dashboard', href: '/dashboard', icon: <HomeIcon className="h-6 w-6" /> },
      { label: 'Upload', href: '/upload', icon: <ArrowUpTrayIcon className="h-6 w-6" /> },
      { label: 'Documents History', href: '/dashboard/history', icon: <DocumentChartBarIcon className="h-6 w-6" /> },
      { label: 'Settings', href: '/dashboard/settings', icon: <WrenchScrewdriverIcon className="h-6 w-6" /> },
    ],
    []
  )

  const userDisplayName = user?.fullName?.trim() || user?.email || 'Learner'

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
      className={`bg-white/95 backdrop-blur-lg border-r border-gray-200 transition-all duration-300 flex flex-col min-h-screen ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!collapsed && <h2 className="font-bold text-xl text-elekeza-deep-blue">ELEWA</h2>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-gray-100 rounded-md text-gray-700"
          aria-label="Toggle sidebar"
        >
          {collapsed ? '>' : '<'}
        </button>
      </div>

      <nav className="flex-1 mt-6">
        {menuItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`mx-2 mb-1 flex items-center gap-3 p-3 rounded-lg transition-colors ${
              pathname === item.href
                ? 'bg-elekeza-indigo/10 text-elekeza-deep-blue'
                : 'text-gray-700 hover:bg-elekeza-indigo/10'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            {item.icon}
            {!collapsed && <span className="font-medium">{item.label}</span>}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        {!collapsed && (
          <div className="mb-3">
            <p className="text-xs text-gray-500">Signed in as</p>
            <p className="text-sm font-semibold text-gray-800 truncate">{userDisplayName}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition ${
            collapsed ? 'justify-center' : ''
          } ${isLoggingOut ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
          <ArrowLeftStartOnRectangleIcon className="h-5 w-5" />
          {!collapsed && <span className="font-medium">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>}
        </button>
      </div>
    </aside>
  )
}
