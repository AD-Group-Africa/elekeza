'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { progressAPI } from '@/lib/api'
import { DashboardData } from '@/types'
import Sidebar from '@/components/Sidebar'

function formatDateOrFallback(value?: string | null): string {
  if (!value) return 'N/A'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleDateString()
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
      return
    }

    if (user) {
      fetchDashboard()
    }
  }, [user, authLoading, router])

  const fetchDashboard = async () => {
    try {
      const dashboardData = await progressAPI.dashboard()
      setData(dashboardData)
    } catch {
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-elekeza-indigo mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo p-6">
        <div className="bg-white/90 backdrop-blur-lg p-10 rounded-2xl shadow-xl border border-white/50 max-w-md text-center">
          <div className="text-red-500 mb-4">??</div>
          <h2 className="text-xl font-bold mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchDashboard}
            className="bg-elekeza-deep-blue text-white px-6 py-2 rounded-lg hover:bg-elekeza-indigo"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-elekeza-deep-blue via-white to-elekeza-indigo">
      <Sidebar />

      <div className="flex-1">
        {/* Header */}
        <div className="bg-white/90 backdrop-blur-lg border-b border-white/50">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-elekeza-deep-blue">Elekeza</h1>
                <p className="text-elekeza-indigo text-sm">Where learning finds direction</p>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-gray-700">Welcome, {user?.fullName}</span>
                <button
                  onClick={() => router.push('/upload')}
                  className="bg-elekeza-deep-blue text-white px-4 py-2 rounded-lg hover:bg-elekeza-indigo"
                >
                  Upload Content
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg border border-white/50">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Lessons Completed</h3>
              <p className="text-3xl font-bold text-elekeza-deep-blue">{data?.lessonsCompleted || 0}</p>
            </div>
            <div className="bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg border border-white/50">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Average Quiz Score</h3>
              <p className="text-3xl font-bold text-elekeza-indigo">
                {data?.avgQuizScore != null ? `${Math.round(data.avgQuizScore)}%` : 'N/A'}
              </p>
            </div>
            <div className="bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg border border-white/50">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Recent Activity</h3>
              <p className="text-3xl font-bold text-elekeza-cyan">{data?.recentLessons?.length || 0}</p>
            </div>
          </div>

          {/* Recent Lessons */}
          <div className="bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg border border-white/50 mb-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Lessons</h3>
            {data?.recentLessons && data.recentLessons.length > 0 ? (
              <div className="space-y-4">
                {data.recentLessons.map((lesson, index) => (
                  <div key={index} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-800">{lesson.title}</h4>
                      <p className="text-sm text-gray-600">Uploaded {formatDateOrFallback(lesson.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{lesson.estimatedMinutes ?? 0} min</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No lessons completed yet. Upload some content to get started!</p>
            )}
          </div>

          {/* Quiz History */}
          <div className="bg-white/90 backdrop-blur-lg p-6 rounded-xl shadow-lg border border-white/50">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Quiz History</h3>
            {data?.quizHistory && data.quizHistory.length > 0 ? (
              <div className="space-y-4">
                {data.quizHistory.map((quiz, index) => (
                  <div key={index} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-800">{quiz.lessonTitle}</h4>
                      <p className="text-sm text-gray-600">Completed {formatDateOrFallback(quiz.completedAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-elekeza-indigo">{Math.round(quiz.scorePercentage)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No quizzes completed yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
