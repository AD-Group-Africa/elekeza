'use client'

import { useState } from 'react'
import { BellIcon, UserCircleIcon } from '@heroicons/react/24/outline'

export default function Navbar() {
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm sticky top-0 z-50">
      {/* Left: Title / Breadcrumb */}
      <div className="text-xl font-bold text-purple-700">MAIN DASH</div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-full hover:bg-gray-100 transition">
          <BellIcon className="h-6 w-6 text-gray-600" />
          <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full"></span>
        </button>

        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100 transition"
          >
            <UserCircleIcon className="h-8 w-8 text-gray-600" />
            <span className="hidden sm:block font-medium text-gray-700">Vickie</span>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-2 flex flex-col">
              <button className="px-4 py-2 hover:bg-gray-100 text-left">Profile</button>
              <button className="px-4 py-2 hover:bg-gray-100 text-left">Settings</button>
              <button className="px-4 py-2 hover:bg-gray-100 text-left text-red-500">
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}