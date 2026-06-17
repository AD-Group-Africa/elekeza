'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings'
import { useAuth } from '@/hooks/useAuth'
import { contentAPI } from '@/lib/api'
import PageShell from '@/components/ui/PageShell'
import StatusBanner from '@/components/ui/StatusBanner'
import ActionBar from '@/components/ui/ActionBar'
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog'

export default function UploadPage() {
  const { user, loading: authLoading } = useAuth()
  const { settings, toggleSetting } = useAccessibilitySettings()
  const router = useRouter()
  const [text, setText] = useState('')
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  const trimmedText = text.trim()
  const characterCount = text.length
  const wordCount = useMemo(
    () =>
      trimmedText.length === 0
        ? 0
        : trimmedText.split(/\s+/).filter(Boolean).length,
    [trimmedText]
  )
  const estimatedMinutes = useMemo(
    () => Math.max(1, Math.ceil(wordCount / 200)),
    [wordCount]
  )
  const canUpload = trimmedText.length > 0 && !loading

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!trimmedText) {
      setError('Please enter some text to upload')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await contentAPI.uploadText({
        text: trimmedText,
        subject: subject.trim() || undefined,
      })

      const lessonId = res.data?.lessonId || res.data?.id
      if (!lessonId) {
        throw new Error('Missing lesson id in response')
      }

      router.push(`/lesson/${lessonId}`)
    } catch {
      setError('Failed to upload content. Please try again.')
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
    <PageShell
      withSidebar
      calmUI={settings.calmUI}
      focusMode={settings.focusMode}
      showAccessibilityToolbar
      onCalmToggle={() => toggleSetting('calmUI')}
      onFocusToggle={() => toggleSetting('focusMode')}
    >
      <section className="mb-6 rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-900 p-6 text-white shadow-md">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">New Learning Input</p>
        <h1 className="mt-2 text-3xl font-bold">Upload Text Content</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-200">
          Paste any lesson text, notes, or document excerpts. We will transform it into a structured learning
          experience with simplified explanations and guided follow-up learning.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && (
            <div className="mb-4">
              <StatusBanner tone="error">{error}</StatusBanner>
            </div>
          )}

          <form onSubmit={handleUpload}>
            <div className="mb-5">
              <label className="mb-2 block text-sm font-semibold text-slate-800">Subject (optional)</label>
              <p className="mb-2 text-xs text-slate-500">Keep the subject short so lessons are easy to classify.</p>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="e.g., Mathematics, History, Science"
              />
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-sm font-semibold text-slate-800">Content Text</label>
              <p className="mb-2 text-xs text-slate-500">Paste one topic at a time for clearer simplification output.</p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="h-72 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="Paste your text content here..."
                required
              />
            </div>

            <div className="mb-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Characters</p>
                <p className="text-lg font-semibold text-slate-900">{characterCount}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Words</p>
                <p className="text-lg font-semibold text-slate-900">{wordCount}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Read Time</p>
                <p className="text-lg font-semibold text-slate-900">~{estimatedMinutes} min</p>
              </div>
            </div>

            <ActionBar
              align="between"
              primaryAction={(
                <button
                  type="submit"
                  disabled={!canUpload}
                  className="inline-flex min-w-56 items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                      AI is simplifying your content...
                    </>
                  ) : (
                    'Upload and Process'
                  )}
                </button>
              )}
              secondaryAction={(
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    disabled={!text && !subject}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Clear Content
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard')}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    Back to Dashboard
                  </button>
                </div>
              )}
            />
          </form>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Tips for Better Results</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>Use clear section breaks between ideas.</li>
              <li>Include headings if your text has multiple topics.</li>
              <li>Keep each upload focused on one subject area.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">What Happens Next</h2>
            <ol className="mt-3 space-y-2 text-sm text-slate-600">
              <li>1. Text is analyzed and simplified.</li>
              <li>2. Key terms and sections are generated.</li>
              <li>3. You are redirected to your lesson page.</li>
            </ol>
            {loading && (
              <p className="mt-3 rounded-lg bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-800">
                Processing normally takes around 5 to 15 seconds.
              </p>
            )}
          </div>
        </aside>
      </div>

      <ConfirmActionDialog
        open={showClearConfirm}
        title="Clear current input?"
        description="This will remove your subject and text from the form."
        confirmText="Clear"
        onCancel={() => setShowClearConfirm(false)}
        onConfirm={() => {
          setText('')
          setSubject('')
          setError('')
          setShowClearConfirm(false)
        }}
      />
    </PageShell>
  )
}
