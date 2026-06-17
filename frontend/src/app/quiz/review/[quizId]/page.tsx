'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { quizAPI } from '@/lib/api'
import { QuizCompleteResponse } from '@/types'

export default function QuizReviewPage() {
  const { user, loading: authLoading } = useAuth()
  const params = useParams()
  const router = useRouter()
  const quizId = params.quizId as string

  const [review, setReview] = useState<QuizCompleteResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
      return
    }
    if (user && quizId) {
      fetchReview()
    }
  }, [authLoading, user, quizId, router])

  async function fetchReview() {
    try {
      const res = await quizAPI.review(quizId)
      const data = res.data
      setReview(data)
    } catch {
      setError('Failed to load quiz review')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo">
        <p className="text-slate-700">Loading quiz review...</p>
      </div>
    )
  }

  if (error || !review) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Quiz Review Error</h2>
          <p className="text-slate-700 mb-4">{error || 'No review data found'}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-elekeza-deep-blue text-white px-6 py-2 rounded-lg hover:bg-elekeza-indigo"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Quiz Review</h1>
        <p className="text-slate-700 mb-6">
          Score: <span className="font-semibold">{Math.round(review.scorePercentage)}%</span> ({review.correctCount}/{review.totalQuestions})
        </p>

        {review.failedQuestions && review.failedQuestions.length > 0 ? (
          <div className="space-y-3">
            {review.failedQuestions.map((q, idx) => (
              <div key={q.questionId} className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="font-semibold text-slate-900">{idx + 1}. {q.questionText}</p>
                <p className="mt-1 text-sm text-red-700">
                  Your answer: {q.selectedAnswerText ?? q.selectedOptionId ?? 'Not answered'}
                </p>
                <p className="text-sm text-emerald-700">
                  Correct answer: {q.correctAnswerText ?? q.correctOptionId}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-emerald-700 font-medium">Great work. No failed questions to review.</p>
        )}

        <div className="mt-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-elekeza-deep-blue text-white px-5 py-2 rounded-lg hover:bg-elekeza-indigo"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}

