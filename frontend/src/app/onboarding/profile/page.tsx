'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onboardingAPI } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useCognitiveProfile } from '@/hooks/useCognitiveProfile'
import PageShell from '@/components/ui/PageShell'
import ProgressStepper from '@/components/ui/ProgressStepper'
import StatusBanner from '@/components/ui/StatusBanner'
import { COGNITIVE_PROFILE_OPTIONS } from '@/lib/cognitiveProfiles'
import { CognitiveProfile } from '@/types'

export default function ProfileSetupPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { setProfilesForCurrentUser } = useCognitiveProfile()

  const [preferredLanguage, setPreferredLanguage] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [learningGoal, setLearningGoal] = useState('')
  const [cognitiveProfiles, setCognitiveProfiles] = useState<CognitiveProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const canContinue = Boolean(preferredLanguage && ageGroup && learningGoal && !loading)

  const toggleProfile = (profile: CognitiveProfile) => {
    setCognitiveProfiles((prev) => (
      prev.includes(profile)
        ? prev.filter((item) => item !== profile)
        : [...prev, profile]
    ))
  }

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await onboardingAPI.profile({ preferredLanguage, ageGroup, learningGoal, cognitiveProfiles })
      setProfilesForCurrentUser(cognitiveProfiles)
      if (ageGroup === 'CHILD' || ageGroup === 'TEEN') {
        router.push('/onboarding/guardian-link')
      } else {
        router.push('/onboarding/placement')
      }
    } catch {
      setError('Failed to save profile. Please try again.')
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
          currentStep={1}
        />

        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl"
        >
          <div className="mb-7 text-center">
            <h1 className="text-3xl font-bold text-slate-900">Tell us about yourself</h1>
            <p className="mt-2 text-sm text-slate-600">
              We use this to personalize your learning path and pacing.
            </p>
          </div>

          {error && (
            <div className="mb-4">
              <StatusBanner tone="error">{error}</StatusBanner>
            </div>
          )}

          <div className="mb-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Preferred Language</label>
            <p className="mb-2 text-xs text-slate-500">Pick the language used in your learning content.</p>
            <select
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              required
            >
              <option value="">Select language</option>
              <option value="en">English</option>
              <option value="sw">Swahili</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Age Group</label>
            <p className="mb-2 text-xs text-slate-500">This helps us tune complexity and examples.</p>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-3 text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              required
            >
              <option value="">Select age group</option>
              <option value="CHILD">Child</option>
              <option value="TEEN">Teen</option>
              <option value="ADULT">Adult</option>
            </select>
          </div>

          <div className="mb-7">
            <label className="mb-2 block text-sm font-semibold text-slate-700">Learning Goal</label>
            <p className="mb-2 text-xs text-slate-500">Choose your primary focus right now.</p>
          <select
            value={learningGoal}
            onChange={(e) => setLearningGoal(e.target.value)}
            className="w-full rounded-lg border border-slate-300 p-3 text-slate-800 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            required
          >
            <option value="">Select your goal</option>
            <option value="improve-literacy">Improve literacy skills</option>
            <option value="learn-new-subject">Learn a new subject</option>
            <option value="exam-preparation">Exam preparation</option>
            <option value="professional-development">Professional development</option>
          </select>
          </div>

          <fieldset className="mb-7 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">Cognitive support profile (optional)</legend>
            <p className="mb-3 text-xs text-slate-600">
              Select all profiles that should shape lesson and quiz rendering.
            </p>
            <div className="space-y-2">
              {COGNITIVE_PROFILE_OPTIONS.map((option) => {
                const checked = cognitiveProfiles.includes(option.value)
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition ${
                      checked ? 'border-slate-700 bg-white' : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProfile(option.value)}
                      className="mt-0.5 h-4 w-4 accent-slate-800"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{option.label}</span>
                      <span className="block text-xs text-slate-600">{option.helper}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

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
