'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onboardingAPI } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import PageShell from '@/components/ui/PageShell'
import ProgressStepper from '@/components/ui/ProgressStepper'

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
      await (onboardingAPI as any).complete()
      router.push('/dashboard')
    } catch {
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-white to-indigo-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-gray-700">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <PageShell withSidebar={false}>
      <div className="mx-auto w-full max-w-3xl">
        <ProgressStepper
          steps={['Profile Setup', 'Placement Quiz', 'Start Learning']}
          currentStep={3}
        />

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-xl">
          <h1 className="text-3xl font-bold text-slate-900">Welcome to Elekeza</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600">
            Your setup is complete. You can now start learning with personalized support settings and guided content flow.
          </p>

          <button
            onClick={handleComplete}
            disabled={loading}
            className="mt-8 w-full rounded-lg bg-slate-900 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? 'Setting up...' : 'Start Learning'}
          </button>
        </div>
      </div>
    </PageShell>
  )
}
