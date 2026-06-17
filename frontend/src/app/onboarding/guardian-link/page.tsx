'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onboardingAPI } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import PageShell from '@/components/ui/PageShell'
import ProgressStepper from '@/components/ui/ProgressStepper'
import StatusBanner from '@/components/ui/StatusBanner'

export default function GuardianLinkPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [fullName, setFullName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  const hasContact = Boolean(phone.trim() || email.trim())
  const canContinue = Boolean(fullName.trim() && relationship && hasContact && !loading)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!hasContact) {
      setError('Please provide at least one guardian contact: phone or email.')
      return
    }

    setLoading(true)
    try {
      await (onboardingAPI as any).guardianLink({
        fullName: fullName.trim(),
        relationship,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      })
      router.push('/onboarding/placement')
    } catch {
      setError('Failed to save guardian link. Please try again.')
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
          steps={['Profile Setup', 'Guardian Link', 'Placement Quiz', 'Start Learning']}
          currentStep={2}
        />

        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl"
        >
          <div className="mb-7 text-center">
            <h1 className="text-3xl font-bold text-slate-900">Guardian Link Request</h1>
            <p className="mt-2 text-sm text-slate-600">
              Please add a guardian or parent contact before continuing.
            </p>
          </div>

          {error && (
            <div className="mb-4">
              <StatusBanner tone="error">{error}</StatusBanner>
            </div>
          )}

          <div className="mb-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Guardian Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              placeholder="Enter guardian name"
              required
            />
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Relationship</label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              required
            >
              <option value="">Select relationship</option>
              <option value="parent">Parent</option>
              <option value="guardian">Guardian</option>
              <option value="caregiver">Caregiver</option>
            </select>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Phone (optional)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3 text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="+2547..."
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-3 text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="guardian@email.com"
              />
            </div>
          </div>

          <p className="mb-6 text-xs text-slate-500">At least one contact field (phone or email) is required.</p>

          <button
            type="submit"
            disabled={!canContinue}
            className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Continue to Placement Quiz'}
          </button>
        </form>
      </div>
    </PageShell>
  )
}

