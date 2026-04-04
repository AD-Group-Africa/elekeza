'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { contentAPI } from '@/lib/api'

export default function UploadPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [text, setText] = useState('')
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) {
      setError('Please enter some text to upload')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await contentAPI.uploadText({
        text: text.trim(),
        subject: subject.trim() || undefined,
      })

      const lessonId = response?.lessonId || response?.id
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-elekeza-indigo mx-auto mb-4"></div>
          <p className="text-gray-700">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-elekeza-deep-blue mb-2">Elekeza</h1>
          <p className="text-elekeza-indigo text-sm">Upload content to start learning</p>
        </div>

        <div className="bg-white/90 backdrop-blur-lg p-8 rounded-2xl shadow-xl border border-white/50">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Text Content</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleUpload}>
            <div className="mb-4">
              <label className="block text-gray-800 mb-2">Subject (optional)</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-200 text-gray-900 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-elekeza-indigo"
                placeholder="e.g., Mathematics, History, Science"
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-800 mb-2">Content Text</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-200 text-gray-900 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-elekeza-indigo h-64 resize-none"
                placeholder="Paste your text content here..."
                required
              />
              <div className="mt-2 text-right text-sm text-gray-600">
                {text.length} characters
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-elekeza-deep-blue hover:bg-elekeza-indigo text-white py-3 rounded-lg font-semibold transition duration-200 disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  AI is simplifying your content...
                </>
              ) : (
                'Upload & Process'
              )}
            </button>
          </form>

          {loading && (
            <div className="mt-4 text-center text-gray-700">
              <p>This may take 5-15 seconds as our AI processes your content.</p>
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-elekeza-indigo hover:underline"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}
