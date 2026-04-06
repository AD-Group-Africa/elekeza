'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onboardingAPI } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import PageShell from '@/components/ui/PageShell'
import ProgressStepper from '@/components/ui/ProgressStepper'
import StatusBanner from '@/components/ui/StatusBanner'

const questions = [
  {
    question: "What is the main idea of this sentence: 'The cat sat on the mat.'",
    options: [
      { text: "A dog is sleeping", id: "a" },
      { text: "A cat is on a mat", id: "b" },
      { text: "A bird is flying", id: "c" },
      { text: "A fish is swimming", id: "d" }
    ],
    correct: "b"
  },
  {
    question: "Choose the correct spelling:",
    options: [
      { text: "Recieve", id: "a" },
      { text: "Receive", id: "b" },
      { text: "Recive", id: "c" },
      { text: "Receeve", id: "d" }
    ],
    correct: "b"
  },
  {
    question: "What does 'infer' mean?",
    options: [
      { text: "To run fast", id: "a" },
      { text: "To conclude from evidence", id: "b" },
      { text: "To eat food", id: "c" },
      { text: "To sleep deeply", id: "d" }
    ],
    correct: "b"
  }
]

export default function PlacementQuizPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  const handleAnswer = (answerId: string) => {
    const newAnswers = [...answers]
    newAnswers[currentQuestion] = answerId
    setAnswers(newAnswers)
  }

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      handleSubmit()
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    const score = answers.reduce((acc, answer, index) => {
      return acc + (answer === questions[index].correct ? 1 : 0)
    }, 0)

    try {
      await onboardingAPI.placement({ score, totalQuestions: questions.length })
      router.push('/onboarding/complete')
    } catch {
      setError('Failed to submit quiz. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const question = questions[currentQuestion]
  const selectedAnswer = answers[currentQuestion]

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
    <PageShell withSidebar={false}>
      <div className="mx-auto w-full max-w-3xl">
        <ProgressStepper
          steps={['Profile Setup', 'Placement Quiz', 'Start Learning']}
          currentStep={2}
        />

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="mb-7 text-center">
            <h1 className="text-3xl font-bold text-slate-900">Literacy Placement Quiz</h1>
            <p className="mt-2 text-sm text-slate-600">Pick one answer for each question. This helps us tune your starting level.</p>
          </div>

          <div className="mb-6">
            <div className="mb-2 flex justify-between text-sm text-slate-600">
              <span>Question {currentQuestion + 1} of {questions.length}</span>
              <span>{Math.round(((currentQuestion + 1) / questions.length) * 100)}% complete</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-slate-900 transition-all"
                style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          {error && (
            <div className="mb-4">
              <StatusBanner tone="error">{error}</StatusBanner>
            </div>
          )}

          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-base font-semibold text-slate-800">{question.question}</p>
          </div>

          <div className="mb-7 space-y-3">
            {question.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleAnswer(option.id)}
                className={`w-full rounded-lg border p-3 text-left text-sm transition-all ${
                  selectedAnswer === option.id
                    ? 'border-slate-900 bg-slate-900/5 text-slate-900'
                    : 'border-slate-200 text-slate-700 hover:border-slate-400'
                }`}
              >
                <span className="mr-2 font-semibold">{option.id.toUpperCase()}.</span>
                {option.text}
              </button>
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={!selectedAnswer || loading}
            className="w-full rounded-lg bg-slate-900 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Submitting...' : currentQuestion === questions.length - 1 ? 'Complete Quiz' : 'Next Question'}
          </button>
        </div>
      </div>
    </PageShell>
  )
}
