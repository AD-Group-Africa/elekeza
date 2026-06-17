'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { getHomePathForRole } from '@/lib/roleAuth'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push(getHomePathForRole(user.role))
      } else {
        router.push('/login')
      }
    }
  }, [user, loading, router])

  // Show loading while checking auth
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-white to-indigo-500">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-blue-900 mb-2">Elekeza</h1>
        <p className="text-indigo-500 text-sm mb-4">Where learning finds direction</p>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
      </div>
    </div>
  )
}
