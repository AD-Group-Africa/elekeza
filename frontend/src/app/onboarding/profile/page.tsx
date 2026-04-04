'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onboardingAPI } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

export default function ProfileSetupPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [preferredLanguage, setPreferredLanguage] = useState('')
  const [ageGroup, setAgeGroup] = useState('')
  const [learningGoal, setLearningGoal] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      await onboardingAPI.profile({ preferredLanguage, ageGroup, learningGoal })
      router.push('/onboarding/placement')
    } catch {
      setError('Failed to save profile. Please try again.')
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
      <form
        onSubmit={handleSubmit}
        className="bg-white/90 backdrop-blur-lg p-10 rounded-2xl shadow-xl border border-white/50 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-elekeza-deep-blue mb-2">Elekeza</h1>
          <p className="text-elekeza-indigo text-sm">Where learning finds direction</p>
        </div>

        <h2 className="text-2xl font-bold mb-2 text-center text-gray-800">
          Tell us about yourself
        </h2>
        <p className="text-center text-gray-500 mb-8 text-sm">
          This helps us personalize your learning experience
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Preferred Language</label>
          <select
            value={preferredLanguage}
            onChange={(e) => setPreferredLanguage(e.target.value)}
            className="w-full p-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-elekeza-indigo"
            required
          >
            <option value="">Select language</option>
            <option value="en">English</option>
            <option value="sw">Swahili</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Age Group</label>
          <select
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
            className="w-full p-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-elekeza-indigo"
            required
          >
            <option value="">Select age group</option>
            <option value="CHILD">Child</option>
            <option value="TEEN">Teen</option>
            <option value="ADULT">Adult</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 mb-2">Learning Goal</label>
          <select
            value={learningGoal}
            onChange={(e) => setLearningGoal(e.target.value)}
            className="w-full p-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-elekeza-indigo"
            required
          >
            <option value="">Select your goal</option>
            <option value="improve-literacy">Improve literacy skills</option>
            <option value="learn-new-subject">Learn a new subject</option>
            <option value="exam-preparation">Exam preparation</option>
            <option value="professional-development">Professional development</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-elekeza-deep-blue hover:bg-elekeza-indigo text-white py-3 rounded-lg font-semibold transition duration-200 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
