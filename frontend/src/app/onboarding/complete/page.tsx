'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onboardingAPI } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

export default function OnboardingCompletePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  const handleComplete = async () => {
    setLoading(true)

    try {
      await onboardingAPI.complete()
      router.push('/dashboard')
    } catch {
      // Even if it fails, redirect to dashboard
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo p-6">
      <div className="bg-white/90 backdrop-blur-lg p-10 rounded-2xl shadow-xl border border-white/50 w-full max-w-md text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-elekeza-deep-blue mb-2">Elekeza</h1>
          <p className="text-elekeza-indigo text-sm">Where learning finds direction</p>
        </div>

        <div className="mb-8">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-2 text-gray-800">
            Welcome to Elekeza!
          </h2>
          <p className="text-gray-600">
            Your personalized learning journey begins now. We&apos;re excited to help you achieve your goals.
          </p>
        </div>

        <button
          onClick={handleComplete}
          disabled={loading}
          className="w-full bg-elekeza-deep-blue hover:bg-elekeza-indigo text-white py-3 rounded-lg font-semibold transition duration-200 disabled:opacity-50"
        >
          {loading ? 'Setting up...' : 'Start Learning'}
        </button>
      </div>
    </div>
  )
}
