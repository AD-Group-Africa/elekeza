'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PageShell from '@/components/ui/PageShell'
import { useAuth } from '@/hooks/useAuth'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import { useCognitiveProfile } from '@/hooks/useCognitiveProfile'

export default function StudentProfilePage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { settings, toggleSetting } = useAccessibilitySettings()
  const { profiles } = useCognitiveProfile()

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

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
    <PageShell
      withSidebar
      calmUI={settings.calmUI}
      focusMode={settings.focusMode}
      showAccessibilityToolbar
      onCalmToggle={() => toggleSetting('calmUI')}
      onFocusToggle={() => toggleSetting('focusMode')}
    >
      <section className="mb-6 rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-md">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Student Profile</p>
        <h1 className="mt-2 text-3xl font-bold">Your Account Profile</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-200">
          View your account details, onboarding status, and quick links to personalize your learning setup.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Account Details</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Full Name</p>
              <p className="text-sm font-semibold text-slate-900">{user.fullName || 'Not set'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Email</p>
              <p className="text-sm font-semibold text-slate-900">{user.email}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Role</p>
              <p className="text-sm font-semibold text-slate-900">{user.role}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Onboarding Status</p>
              <p className="text-sm font-semibold text-slate-900">
                {user.onboardingComplete ? 'Completed' : 'In progress'}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700">Profile Storage</p>
              <p className="text-sm font-semibold text-emerald-900">
                Disability profile is saved in the database for this user.
              </p>
              <p className="mt-2 text-xs text-emerald-700">Saved Profile</p>
              {profiles.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {profiles.map((profile) => (
                    <span
                      key={profile}
                      className="inline-flex items-center rounded-full border border-emerald-300 bg-white px-2 py-1 text-xs font-semibold text-emerald-900"
                    >
                      {profile}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-semibold text-emerald-900">Not set</p>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Quick Actions</h3>
            <div className="mt-3 space-y-2">
              <button
                onClick={() => router.push('/dashboard/settings')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
              >
                Open Settings
              </button>
              <button
                onClick={() => router.push('/dashboard/history')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
              >
                View History
              </button>
              <button
                onClick={() => router.push('/upload')}
                className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Upload Learning Content
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Profile Editing</h3>
            <p className="mt-2 text-sm text-slate-600">
              Direct profile editing will be enabled once backend profile update endpoints are confirmed.
            </p>
          </section>
        </aside>
      </div>
    </PageShell>
  )
}

