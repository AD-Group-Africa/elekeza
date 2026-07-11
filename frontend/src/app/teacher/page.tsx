'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Analytics {
  totalLearners: number;
  activeLearners: number;
  lessonsCreated: number;
  lessonsAssigned: number;
  completionRate: number;
  averageScore: number;
  atRiskStudents: number;
  weeklyActivity: { day: string; completed: number }[];
  recentAssignments: { studentName: string; lessonId: number; score: number; date: string }[];
  totalQuizzes: number;
}

const COLORS = ['#3B6DE5', '#8B45F5', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

export default function TeacherDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'lessons' | 'students' | 'assign'>('overview');
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [lessons, setLessons] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/teacher'),
      api.get('/teacher/students'),
      api.get('/content/list')
    ])
      .then(([analyticsRes, studentsRes, lessonsRes]) => {
        setAnalytics(analyticsRes.data);
        setStudents(studentsRes.data);
        setLessons(lessonsRes.data);
      })
      .catch(() => setError('Unable to load dashboard. Please ensure the backend is running on port 9090.'))
      .finally(() => setLoading(false));
  }, []);

  const handleFileUpload = async () => {
    if (!lessonFile) return;
    setUploading(true);
    setUploadMessage('');
    const formData = new FormData();
    formData.append('file', lessonFile);
    formData.append('title', lessonTitle);
    try {
      await api.post('/content/upload/file', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadMessage('Lesson uploaded successfully! AI is processing...');
      setLessonTitle('');
      setLessonFile(null);
      const lessonsRes = await api.get('/content/list');
      setLessons(lessonsRes.data);
    } catch (e: any) {
      setUploadMessage('Upload failed: ' + (e.response?.data?.message || e.message));
    } finally {
      setUploading(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedLessonId || selectedStudents.length === 0) return;
    try {
      await api.post('/teacher/content/assign', {
        contentId: Number(selectedLessonId),
        studentIds: selectedStudents.map(Number)
      });
      alert(`Lesson assigned to ${selectedStudents.length} student(s)`);
      setSelectedStudents([]);
      setSelectedLessonId('');
    } catch (e: any) {
      alert('Assignment failed: ' + (e.response?.data?.message || e.message));
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <SidebarLayout>
        <div className="animate-pulse p-6">
          <div className="h-8 bg-gray-700 rounded w-1/3 mb-8"></div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-800 rounded-xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-800 rounded-xl"></div>
            <div className="h-64 bg-gray-800 rounded-xl"></div>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <SidebarLayout>
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">Connection Error</h2>
          <p className="text-gray-400 max-w-md">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
            Retry
          </button>
        </div>
      </SidebarLayout>
    );
  }

  if (!analytics) return null;

  return (
    <SidebarLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <h1 className="text-3xl font-bold text-white mb-4 md:mb-0">Teacher Dashboard</h1>
        <div className="flex gap-2 flex-wrap">
          {(['overview', 'lessons', 'students', 'assign'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab ? 'bg-white text-purple-700 shadow' : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[
              { label: 'Total Learners', value: analytics.totalLearners, color: 'from-blue-500 to-blue-600' },
              { label: 'Active This Week', value: analytics.activeLearners, color: 'from-green-500 to-green-600' },
              { label: 'Avg Score', value: `${analytics.averageScore.toFixed(1)}%`, color: 'from-purple-500 to-purple-600' },
              { label: 'Completion', value: `${analytics.completionRate.toFixed(0)}%`, color: 'from-yellow-500 to-yellow-600' },
              { label: 'At Risk', value: analytics.atRiskStudents, color: 'from-red-500 to-red-600' },
              { label: 'Quizzes', value: analytics.totalQuizzes, color: 'from-pink-500 to-pink-600' },
            ].map((card, i) => (
              <div key={i} className={`bg-gradient-to-br ${card.color} rounded-xl p-4 shadow-lg`}>
                <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{card.label}</p>
                <p className="text-white text-2xl font-bold mt-1">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Weekly Activity */}
            <div className="bg-white rounded-xl p-6 shadow">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Weekly Activity</h2>
              {analytics.weeklyActivity.every(d => d.completed === 0) ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p>No activity this week yet</p>
                  <p className="text-sm mt-1">Assign lessons to start tracking progress</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.weeklyActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="completed" fill="#3B6DE5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Completion Pie */}
            <div className="bg-white rounded-xl p-6 shadow">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Lesson Completion</h2>
              {analytics.lessonsAssigned === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                  <p>No lessons assigned yet</p>
                  <p className="text-sm mt-1">Upload and assign your first lesson</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Completed', value: analytics.completionRate },
                        { name: 'Pending', value: 100 - analytics.completionRate }
                      ]}
                      cx="50%" cy="50%" outerRadius={100} dataKey="value"
                      label={({ name, value }) => `${name}: ${value.toFixed(0)}%`}
                    >
                      {[0, 1].map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent Assignments Table */}
          <div className="bg-white rounded-xl p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Assignments</h2>
            {analytics.recentAssignments.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No assignments recorded yet</p>
                <p className="text-sm mt-1">Student progress will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-gray-500 text-sm border-b">
                      <th className="pb-3 font-medium">Student</th>
                      <th className="pb-3 font-medium">Lesson</th>
                      <th className="pb-3 font-medium">Score</th>
                      <th className="pb-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.recentAssignments.map((a, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 text-gray-700">{a.studentName}</td>
                        <td className="py-3 text-gray-600">Lesson #{a.lessonId}</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            a.score >= 70 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {a.score}%
                          </span>
                        </td>
                        <td className="py-3 text-sm text-gray-500">{new Date(a.date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Lessons Tab */}
      {activeTab === 'lessons' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Upload New Lesson</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lesson Title (optional)</label>
                <input type="text" value={lessonTitle} onChange={e => setLessonTitle(e.target.value)}
                  placeholder="e.g. The Water Cycle"
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Document (PDF, DOCX, TXT)</label>
                <input type="file" accept=".pdf,.docx,.txt" onChange={e => setLessonFile(e.target.files?.[0] || null)}
                  className="w-full border border-gray-300 rounded-lg p-3" />
              </div>
              <button onClick={handleFileUpload} disabled={uploading || !lessonFile}
                className="w-full bg-purple-600 text-white rounded-lg p-3 font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Uploading & AI Processing...
                  </span>
                ) : 'Upload & AI Simplify'}
              </button>
              {uploadMessage && (
                <div className={`p-3 rounded-lg text-sm ${uploadMessage.includes('failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                  {uploadMessage}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Lessons ({lessons.length})</h2>
            {lessons.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p>No lessons yet</p>
                <p className="text-sm mt-1">Upload your first lesson to get started</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {lessons.map((lesson: any) => (
                  <div key={lesson.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                    <div>
                      <p className="font-medium text-gray-700">{lesson.title || 'Untitled Lesson'}</p>
                      <p className="text-sm text-gray-500">ID: {lesson.id}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      lesson.status === 'READY' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {lesson.status || 'PROCESSING'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Students Tab */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Students ({students.length})</h2>
          {students.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>No students yet</p>
              <p className="text-sm mt-1">Create your first student to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-500 text-sm border-b">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">SNE Type</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 text-gray-700 font-medium">{s.name}</td>
                      <td className="py-3 text-gray-600">{s.email}</td>
                      <td className="py-3">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          {s.sneType || 'NONE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Assign Tab */}
      {activeTab === 'assign' && (
        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Bulk Assign Lesson</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Lesson</label>
              <select value={selectedLessonId} onChange={e => setSelectedLessonId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500">
                <option value="">Choose a lesson...</option>
                {lessons.map(l => (
                  <option key={l.id} value={l.id}>{l.title || `Lesson #${l.id}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Students ({selectedStudents.length} selected)
              </label>
              <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-2">
                {students.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No students available</p>
                ) : (
                  students.map((s: any) => (
                    <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input type="checkbox" checked={selectedStudents.includes(s.id)}
                        onChange={() => setSelectedStudents(prev =>
                          prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                        )}
                        className="rounded text-purple-600 focus:ring-purple-500" />
                      <span className="text-gray-700">{s.name}</span>
                      <span className="text-gray-400 text-sm">{s.sneType || 'NONE'}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <button onClick={handleBulkAssign} disabled={!selectedLessonId || selectedStudents.length === 0}
              className="w-full bg-purple-600 text-white rounded-lg p-3 font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
              Assign to {selectedStudents.length} student(s)
            </button>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}

