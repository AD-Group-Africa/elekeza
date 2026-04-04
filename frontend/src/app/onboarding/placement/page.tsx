'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onboardingAPI } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo p-6">
      <div className="bg-white/90 backdrop-blur-lg p-10 rounded-2xl shadow-xl border border-white/50 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-elekeza-deep-blue mb-2">Elekeza</h1>
          <p className="text-elekeza-indigo text-sm">Literacy Assessment</p>
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Question {currentQuestion + 1} of {questions.length}</span>
            <span>{Math.round(((currentQuestion + 1) / questions.length) * 100)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-elekeza-indigo h-2 rounded-full transition-all"
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            {question.question}
          </h3>
          <div className="space-y-3">
            {question.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleAnswer(option.id)}
                className={`w-full p-3 text-left rounded-lg border transition-all ${
                  selectedAnswer === option.id
                    ? 'border-elekeza-indigo bg-elekeza-indigo bg-opacity-10'
                    : 'border-gray-200 hover:border-elekeza-indigo'
                }`}
              >
                <span className="font-semibold mr-2">{option.id.toUpperCase()}.</span>
                {option.text}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleNext}
          disabled={!selectedAnswer || loading}
          className="w-full bg-elekeza-deep-blue hover:bg-elekeza-indigo text-white py-3 rounded-lg font-semibold transition duration-200 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : currentQuestion === questions.length - 1 ? 'Complete Quiz' : 'Next Question'}
        </button>
      </div>
    </div>
  )
}
