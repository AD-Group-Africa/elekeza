'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { quizAPI } from '@/lib/api'
import { QuizStartResponse, Question, QuizAnswerResponse, QuizCompleteResponse } from '@/types'

export default function QuizPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const lessonId = params.lessonId as string

  const [quizData, setQuizData] = useState<QuizStartResponse | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showResult, setShowResult] = useState(false)
  const [result, setResult] = useState<QuizCompleteResponse | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState<Date>(new Date())

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
      return
    }

    if (lessonId) {
      startQuiz()
    }
  }, [user, authLoading, lessonId, router])

  useEffect(() => {
    setQuestionStartTime(new Date())
  }, [currentQuestionIndex])

  const startQuiz = async () => {
    try {
      const data = await quizAPI.start(lessonId)
      setQuizData(data)
      setAnswers(new Array(data.totalQuestions).fill(''))
    } catch (err: any) {
      setError('Failed to start quiz')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerSelect = (answerId: string) => {
    const newAnswers = [...answers]
    newAnswers[currentQuestionIndex] = answerId
    setAnswers(newAnswers)
  }

  const handleSubmitAnswer = async () => {
    if (!quizData || !answers[currentQuestionIndex]) return

    setSubmitting(true)
    const latencyMs = new Date().getTime() - questionStartTime.getTime()

    try {
      const response: QuizAnswerResponse = await quizAPI.answer(quizData.quizId, {
        questionId: quizData.firstQuestion.id, // This should be the current question id
        selectedOptionId: answers[currentQuestionIndex],
        latencyMs
      })

      if (response.quizComplete) {
        // Quiz finished
        const completeData = await quizAPI.complete(quizData.quizId)
        setResult(completeData)
        setShowResult(true)
      } else if (response.nextQuestion) {
        // Next question
        setCurrentQuestionIndex(currentQuestionIndex + 1)
        // Update quizData with next question
        setQuizData({
          ...quizData,
          firstQuestion: response.nextQuestion
        })
      }
    } catch (err: any) {
      setError('Failed to submit answer')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-elekeza-indigo mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo p-6">
        <div className="bg-white/90 backdrop-blur-lg p-10 rounded-2xl shadow-xl border border-white/50 max-w-md text-center">
          <div className="text-red-500 mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Error Loading Quiz</h2>
          <p className="text-gray-600 mb-4">{error}</p>
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

  if (showResult && result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo p-6">
        <div className="bg-white/90 backdrop-blur-lg p-10 rounded-2xl shadow-xl border border-white/50 max-w-md text-center">
          <div className="text-6xl mb-4">
            {result.scorePercentage >= 70 ? '🎉' : result.scorePercentage >= 50 ? '👍' : '💪'}
          </div>
          <h2 className="text-2xl font-bold mb-2 text-gray-800">Quiz Complete!</h2>
          <div className="mb-6">
            <p className="text-3xl font-bold text-elekeza-indigo mb-2">{result.scorePercentage}%</p>
            <p className="text-gray-600">
              {result.correctCount} out of {result.totalQuestions} correct
            </p>
          </div>
          <p className="text-gray-700 mb-6">{result.summaryMessage}</p>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-elekeza-deep-blue text-white py-3 rounded-lg hover:bg-elekeza-indigo"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => router.push('/upload')}
              className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300"
            >
              Upload More Content
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!quizData) return null

  const currentQuestion = quizData.firstQuestion
  const progress = ((currentQuestionIndex + 1) / quizData.totalQuestions) * 100
  const selectedAnswer = answers[currentQuestionIndex]

  return (
    <div className="min-h-screen bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-elekeza-deep-blue mb-2">Elekeza</h1>
          <p className="text-elekeza-indigo text-sm">Quiz Time!</p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Question {currentQuestionIndex + 1} of {quizData.totalQuestions}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-elekeza-indigo h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Question */}
        <div className="bg-white/90 backdrop-blur-lg p-8 rounded-2xl shadow-xl border border-white/50">
          <h2 className="text-xl font-bold text-gray-800 mb-6">{currentQuestion.text}</h2>

          <div className="space-y-3 mb-8">
            {currentQuestion.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleAnswerSelect(option.id)}
                className={`w-full p-4 text-left rounded-lg border transition-all ${
                  selectedAnswer === option.id
                    ? 'border-elekeza-indigo bg-elekeza-indigo bg-opacity-10'
                    : 'border-gray-200 hover:border-elekeza-indigo'
                }`}
              >
                <span className="font-semibold mr-3">{option.id.toUpperCase()}.</span>
                {option.text}
              </button>
            ))}
          </div>

          <button
            onClick={handleSubmitAnswer}
            disabled={!selectedAnswer || submitting}
            className="w-full bg-elekeza-deep-blue hover:bg-elekeza-indigo text-white py-3 rounded-lg font-semibold transition duration-200 disabled:opacity-50 flex items-center justify-center"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              'Submit Answer'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
