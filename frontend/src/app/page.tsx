'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard')
      } else {
        router.push('/login')
      }
    }
  }, [user, loading, router])

  // Show loading while checking auth
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-elekeza-deep-blue mb-2">Elekeza</h1>
        <p className="text-elekeza-indigo text-sm mb-4">Where learning finds direction</p>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-elekeza-indigo mx-auto"></div>
      </div>
    </div>
  )
}