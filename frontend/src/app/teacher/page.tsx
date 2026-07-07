'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

interface Student { id: string; name: string; sneType: string; }
interface Lesson  { id: number; title: string; status: string; }
interface Progress { studentName: string; completedLessons: number; lastQuizScore: number | null; }

export default function TeacherDashboard() {
  const [students, setStudents]   = useState<Student[]>([]);
  const [lessons, setLessons]     = useState<Lesson[]>([]);
  const [form, setForm]           = useState({ email: '', fullName: '', password: '', sneType: 'NONE' });
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [progress, setProgress]   = useState<Progress | null>(null);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignLessonId, setAssignLessonId]   = useState('');
  const [assignMsg, setAssignMsg] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [tab, setTab]             = useState<'students' | 'assign'>('students');

  useEffect(() => {
    api.get('/teacher/students').then(res => setStudents(res.data)).catch(() => {});
    api.get('/content/list').then(res => setLessons(res.data)).catch(() => {});
  }, []);

  const handleCreate = async () => {
    setError(''); setLoading(true);
    try {
      await api.post('/teacher/student', form);
      const res = await api.get('/teacher/students');
      setStudents(res.data);
      setForm({ email: '', fullName: '', password: '', sneType: 'NONE' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create student');
    } finally { setLoading(false); }
  };

  const handleViewProgress = async (student: Student) => {
    try {
      const res = await api.get(`/teacher/student/${student.id}/progress`);
      setSelectedStudent(student);
      setProgress(res.data);
    } catch { setError('Could not load progress'); }
  };

  const handleAssign = async () => {
    if (!assignStudentId || !assignLessonId) {
      setAssignMsg('Please select both a student and a lesson.'); return;
    }
    try {
      await api.post('/teacher/content/assign', {
        contentId:  Number(assignLessonId),
        studentIds: [Number(assignStudentId)],
      });
      setAssignMsg(`✅ Lesson assigned successfully!`);
      setAssignStudentId('');
      setAssignLessonId('');
    } catch { setAssignMsg('❌ Assignment failed. Try again.'); }
  };

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Teacher Dashboard</h1>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-2 mb-6">
        {(['students', 'assign'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg font-medium transition ${tab === t ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
          >
            {t === 'students' ? '👥 Manage Students' : '📚 Assign Lessons'}
          </button>
        ))}
      </div>

      {tab === 'students' && (
        <>
          {/* Create student */}
          <div className="card mb-6">
            <h2 className="text-xl font-semibold text-blue-900 mb-4">Create Learner</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400"
                placeholder="Email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
              <input
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400"
                placeholder="Full Name" value={form.fullName}
                onChange={e => setForm({ ...form, fullName: e.target.value })}
              />
              <input
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400"
                type="password" placeholder="Password" value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400"
                value={form.sneType} onChange={e => setForm({ ...form, sneType: e.target.value })}
              >
                <option value="NONE">No SNE profile</option>
                <option value="DYSLEXIA">Dyslexia</option>
                <option value="ADHD">ADHD</option>
                <option value="AUTISM">Autism</option>
                <option value="INTELLECTUAL_DISABILITY">Intellectual Disability</option>
              </select>
            </div>
            <button onClick={handleCreate} disabled={loading} className="btn-primary mt-4 disabled:opacity-50">
              {loading ? 'Creating…' : 'Create Learner'}
            </button>
          </div>

          {/* Student list */}
          <div className="card">
            <h2 className="text-xl font-semibold text-blue-900 mb-4">
              Students ({students.length})
            </h2>
            {students.length === 0 ? (
              <p className="text-gray-500">No students yet. Create one above.</p>
            ) : (
              <ul className="space-y-2">
                {students.map(s => (
                  <li key={s.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                    <div>
                      <span className="text-gray-800 font-medium">{s.name}</span>
                      {s.sneType && s.sneType !== 'NONE' && (
                        <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          {s.sneType.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleViewProgress(s)}
                      className="btn-outline text-sm py-1 px-3"
                    >
                      Progress
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedStudent && progress && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900">{progress.studentName}'s Progress</h3>
                <p className="text-gray-600">Lessons completed: {progress.completedLessons}</p>
                <p className="text-gray-600">
                  Last quiz score: {progress.lastQuizScore != null ? `${progress.lastQuizScore}%` : 'N/A'}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'assign' && (
        <div className="card">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">Assign a Lesson to a Learner</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Student</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400"
                value={assignStudentId}
                onChange={e => setAssignStudentId(e.target.value)}
              >
                <option value="">— choose a student —</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Lesson</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-400"
                value={assignLessonId}
                onChange={e => setAssignLessonId(e.target.value)}
              >
                <option value="">— choose a lesson —</option>
                {lessons.filter(l => l.status === 'READY').map(l => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>
          </div>
          <button onClick={handleAssign} className="btn-primary">
            Assign Lesson
          </button>
          {assignMsg && (
            <p className={`mt-3 text-sm ${assignMsg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
              {assignMsg}
            </p>
          )}

          {lessons.length === 0 && (
            <p className="mt-4 text-gray-500 text-sm">
              No lessons available yet.{' '}
              <a href="/upload" className="text-purple-600 hover:underline">Upload content</a> first.
            </p>
          )}
        </div>
      )}
    </SidebarLayout>
  );
}
