'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { contentAPI, quizAPI } from '@/lib/api'
import { Lesson, Section, KeyTerm } from '@/types'

export default function LessonPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const lessonId = params.id as string

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [currentSection, setCurrentSection] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sectionStartTime, setSectionStartTime] = useState<Date>(new Date())

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
      return
    }

    if (lessonId) {
      fetchLesson()
    }
  }, [user, authLoading, lessonId, router])

  useEffect(() => {
    // Reset timer when section changes
    setSectionStartTime(new Date())
  }, [currentSection])

  const fetchLesson = async () => {
    try {
      const lessonData = await contentAPI.getLesson(lessonId)
      setLesson(lessonData)
    } catch (err: any) {
      setError('Failed to load lesson')
    } finally {
      setLoading(false)
    }
  }

  const handleSectionProgress = async () => {
    if (!lesson) return

    const section = lesson.sections[currentSection]
    const timeSpent = Math.floor((new Date().getTime() - sectionStartTime.getTime()) / 1000)

    try {
      await contentAPI.updateSectionProgress(lessonId, section.id, { additionalSeconds: timeSpent })
    } catch (err) {
      console.error('Failed to update progress')
    }
  }

  const handleNextSection = async () => {
    await handleSectionProgress()

    if (currentSection < lesson!.sections.length - 1) {
      setCurrentSection(currentSection + 1)
    } else {
      // Lesson complete, go to quiz
      router.push(`/quiz/${lessonId}`)
    }
  }

  const handleTermTap = async (termId: string) => {
    try {
      const response = await contentAPI.tapTerm(lessonId, { termId })
      // Could show definition in a modal or tooltip
      alert(`Definition: ${response.definition}`)
    } catch (err) {
      console.error('Failed to get term definition')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-elekeza-indigo mx-auto mb-4"></div>
          <p className="text-gray-600">Loading lesson...</p>
        </div>
      </div>
    )
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo p-6">
        <div className="bg-white/90 backdrop-blur-lg p-10 rounded-2xl shadow-xl border border-white/50 max-w-md text-center">
          <div className="text-red-500 mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">Error Loading Lesson</h2>
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

  const section = lesson.sections[currentSection]
  const progress = ((currentSection + 1) / lesson.sections.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-lg border-b border-white/50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-elekeza-deep-blue">Elekeza</h1>
              <p className="text-elekeza-indigo text-sm">Reading: {lesson.title}</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-elekeza-indigo hover:underline"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="mb-2 flex justify-between text-sm text-gray-600">
          <span>Section {currentSection + 1} of {lesson.sections.length}</span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-elekeza-indigo h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 pb-8">
        <div className="bg-white/90 backdrop-blur-lg p-8 rounded-2xl shadow-xl border border-white/50">
          {/* Section Title */}
          <h2 className="text-2xl font-bold text-gray-800 mb-6">{section.heading}</h2>

          {/* Section Content */}
          <div className="prose prose-lg max-w-none mb-8">
            <div className="text-gray-700 leading-relaxed text-lg">
              {section.body.split(' ').map((word, index) => {
                const term = lesson.keyTerms.find(t => t.term.toLowerCase() === word.toLowerCase().replace(/[.,!?;]$/, ''))
                if (term) {
                  return (
                    <span key={index}>
                      <button
                        onClick={() => handleTermTap(term.id)}
                        className="text-elekeza-indigo hover:underline font-semibold"
                      >
                        {word}
                      </button>{' '}
                    </span>
                  )
                }
                return <span key={index}>{word} </span>
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => {
                if (currentSection > 0) {
                  handleSectionProgress()
                  setCurrentSection(currentSection - 1)
                }
              }}
              disabled={currentSection === 0}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <button
              onClick={handleNextSection}
              className="px-6 py-3 bg-elekeza-deep-blue text-white rounded-lg hover:bg-elekeza-indigo"
            >
              {currentSection === lesson.sections.length - 1 ? 'Take Quiz' : 'Next Section'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
