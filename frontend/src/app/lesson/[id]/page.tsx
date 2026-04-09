'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useCognitiveProfile } from '@/hooks/useCognitiveProfile'
import { contentAPI } from '@/lib/api'
import { Lesson, Section } from '@/types'

function parseSection(section: Section) {
  if (section.heading || section.body) {
    return {
      heading: section.heading ?? `Section`,
      body: section.body ?? '',
    }
  }

  const raw = section.content ?? ''
  const [headingPart, ...bodyParts] = raw.split(/\n\s*\n/)
  const heading = headingPart?.trim() || 'Section'
  const body = bodyParts.join('\n\n').trim() || headingPart?.trim() || ''
  return { heading, body }
}

export default function LessonPage() {
  const { user, loading: authLoading } = useAuth()
  const { activeMode, hasProfile } = useCognitiveProfile()
  const router = useRouter()
  const params = useParams()
  const lessonId = params.id as string

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [currentSection, setCurrentSection] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sectionStartTime, setSectionStartTime] = useState<Date>(new Date())
  const [termDefinition, setTermDefinition] = useState('')

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
    } catch {
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
    } catch {
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
      await contentAPI.tapTerm(lessonId, { termId })
      const term = lesson?.keyTerms.find((item) => item.id === termId)
      setTermDefinition(term?.definition ?? 'Definition unavailable for this term.')
    } catch {
      console.error('Failed to get term definition')
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-elekeza-indigo mx-auto mb-4"></div>
          <p className="text-slate-800">Loading lesson...</p>
        </div>
      </div>
    )
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo p-6">
        <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-200 max-w-md text-center">
          <div className="text-red-500 mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Error Loading Lesson</h2>
          <p className="text-slate-700 mb-4">{error}</p>
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

  if (!lesson.sections || lesson.sections.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo p-6">
        <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-200 max-w-md text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">No Lesson Sections Found</h2>
          <p className="text-slate-700 mb-4">This lesson was created, but no readable sections were returned.</p>
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
  const { heading, body } = parseSection(section)
  const progress = ((currentSection + 1) / lesson.sections.length) * 100

  return (
    <div className="lesson-shell">
      {hasProfile('ADHD') && (
        <div className="adhd-progress-mini">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-1 text-xs font-semibold text-slate-700">
            <span>Focused Reading Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="adhd-progress-mini-track">
            <div className="adhd-progress-mini-fill transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className={`adaptive-reading-width mx-auto px-6 ${hasProfile('ADHD') ? 'pt-14 pb-4' : 'py-4'}`}>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-elekeza-deep-blue">Elekeza</h1>
              <p className="text-slate-700 text-sm">Reading: {lesson.title}</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="text-slate-800 hover:underline font-medium"
            >
              ← Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="adaptive-reading-width mx-auto px-6 py-4">
        <div className="mb-2 flex justify-between text-sm text-slate-800 font-medium">
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
      <div className="adaptive-reading-width mx-auto px-6 pb-8">
        <div
          className={`rounded-2xl border p-8 shadow-xl ${
            hasProfile('AUTISM')
              ? 'border-slate-300 bg-slate-100'
              : hasProfile('ADHD')
              ? currentSection % 2 === 0
                ? 'border-blue-200 bg-blue-50 adhd-enter'
                : 'border-indigo-200 bg-indigo-50 adhd-enter'
              : hasProfile('DYSLEXIA')
              ? 'border-amber-200 bg-[#FAFAF0]'
              : hasProfile('INTELLECTUAL_DISABILITY')
              ? 'border-slate-800 bg-white'
              : 'border-slate-200 bg-white'
          }`}
        >
          {/* Section Title */}
          <h2 className="mb-6 flex items-center gap-2 text-2xl font-bold text-slate-900">
            {hasProfile('INTELLECTUAL_DISABILITY') && <span className="id-section-icon">i</span>}
            <span>{heading}</span>
          </h2>

          {/* Section Content */}
          <div className="mb-8">
            <div className={`text-slate-900 ${hasProfile('INTELLECTUAL_DISABILITY') ? 'text-xl leading-9' : 'text-lg leading-relaxed'}`}>
              {hasProfile('DYSLEXIA') ? (
                <ul className="dyslexia-bullet-list space-y-3">
                  {(body || '')
                    .split(/(?<=[.!?])\s+/)
                    .filter((line) => line.trim().length > 0)
                    .map((sentence, sentenceIndex) => (
                      <li key={`sentence-${sentenceIndex}`}>
                        {sentence.split(' ').map((word, index) => {
                          const clean = word.toLowerCase().replace(/[.,!?;:]$/, '')
                          const term = lesson.keyTerms.find((t) => t.term.toLowerCase() === clean)
                          if (!term) return <span key={`plain-${sentenceIndex}-${index}`}>{word} </span>
                          return (
                            <button
                              key={`term-${term.id}-${index}`}
                              onClick={() => handleTermTap(term.id)}
                              className="dyslexia-keyterm font-semibold text-blue-900 hover:text-blue-700"
                            >
                              {word}{' '}
                            </button>
                          )
                        })}
                      </li>
                    ))}
                </ul>
              ) : hasProfile('AUTISM') ? (
                <div className="autism-card-grid">
                  <div className="autism-card">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Definition:</p>
                    <p className="mt-1 text-slate-900">{heading}</p>
                  </div>
                  <div className="autism-card">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Example:</p>
                    <p className="mt-1 whitespace-pre-line text-slate-900">{body}</p>
                  </div>
                  <div className="autism-card">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Why this matters:</p>
                    <p className="mt-1 text-slate-900">Understanding this section supports better recall in the quiz and later lessons.</p>
                  </div>
                </div>
              ) : (
                <div className="whitespace-pre-line">
                  {(body || '').split(' ').map((word, index) => {
                    const term = lesson.keyTerms.find((t) => t.term.toLowerCase() === word.toLowerCase().replace(/[.,!?;:]$/, ''))
                    if (term) {
                      return (
                        <span key={index}>
                          <button
                            onClick={() => handleTermTap(term.id)}
                            className="font-semibold text-blue-700 underline-offset-2 hover:text-blue-800 hover:underline"
                          >
                            {word}
                          </button>{' '}
                        </span>
                      )
                    }
                    return <span key={index}>{word} </span>
                  })}
                </div>
              )}
            </div>
          </div>

          {termDefinition && (
            <div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              <p className="font-semibold">Definition</p>
              <p>{termDefinition}</p>
            </div>
          )}

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
              className={`rounded-lg bg-slate-100 px-6 py-3 text-slate-800 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                activeMode === 'intellectualDisability' ? 'min-h-12 text-lg font-semibold' : ''
              }`}
            >
              Previous
            </button>

            <button
              onClick={handleNextSection}
              className={`rounded-lg bg-elekeza-deep-blue px-6 py-3 text-white hover:bg-elekeza-indigo ${
                activeMode === 'intellectualDisability' ? 'min-h-12 text-lg font-semibold' : ''
              }`}
            >
              {currentSection === lesson.sections.length - 1 ? 'Take Quiz' : 'Next Section'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

