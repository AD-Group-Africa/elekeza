'use client'

import Sidebar from '@/components/Sidebar'
import Navbar from '@/components/Navbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      {/* WCAG 2.4.1 Bypass Blocks — first focusable element on the page */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-purple-700 focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main id="main-content" className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}

