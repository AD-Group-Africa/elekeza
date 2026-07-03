'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

interface Student {
  id: string;
  name: string;
  sneType: string;
}

interface Progress {
  studentName: string;
  completedLessons: number;
  lastQuizScore: number | null;
}

export default function TeacherDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState({ email: '', fullName: '', password: '', sneType: 'DYSLEXIA' });
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/teacher/students')
      .then(res => setStudents(res.data))
      .catch(() => setError('Unable to load students'));
  }, []);

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      await api.post('/teacher/student', form);
      const res = await api.get('/teacher/students');
      setStudents(res.data);
      setForm({ email: '', fullName: '', password: '', sneType: 'DYSLEXIA' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create student');
    } finally {
      setLoading(false);
    }
  };

  const handleViewProgress = async (student: Student) => {
    try {
      const res = await api.get(`/teacher/student/${student.id}/progress`);
      setSelectedStudent(student);
      setProgress(res.data);
    } catch {
      setError('Could not load progress');
    }
  };

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Teacher Dashboard</h1>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

      {/* Create Student */}
      <div className="card mb-6">
        <h2 className="text-xl font-semibold text-blue-900 mb-4">Create Learner</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input className="border border-gray-300 rounded-lg px-3 py-2" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <input className="border border-gray-300 rounded-lg px-3 py-2" placeholder="Full Name" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} />
          <input className="border border-gray-300 rounded-lg px-3 py-2" type="password" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          <select className="border border-gray-300 rounded-lg px-3 py-2" value={form.sneType} onChange={e => setForm({...form, sneType: e.target.value})}>
            <option>DYSLEXIA</option><option>ADHD</option><option>AUTISM</option><option>DYSCALCULIA</option><option>INTELLECTUAL_DISABILITY</option>
          </select>
        </div>
        <button onClick={handleCreate} disabled={loading} className="btn-primary mt-4 disabled:opacity-50">
          {loading ? 'Creating...' : 'Create Student'}
        </button>
      </div>

      {/* Student List & Progress */}
      <div className="card">
        <h2 className="text-xl font-semibold text-blue-900 mb-4">Students</h2>
        {students.length === 0 ? (
          <p className="text-gray-500">No students yet. Create one above.</p>
        ) : (
          <ul className="space-y-2">
            {students.map(s => (
              <li key={s.id} className="flex justify-between items-center border-b pb-2">
                <span className="text-gray-700">{s.name} ({s.sneType})</span>
                <button onClick={() => handleViewProgress(s)} className="btn-outline text-sm py-1 px-3">Progress</button>
              </li>
            ))}
          </ul>
        )}
        {selectedStudent && progress && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900">{progress.studentName}'s Progress</h3>
            <p className="text-gray-600">Completed lessons: {progress.completedLessons}</p>
            <p className="text-gray-600">Last quiz score: {progress.lastQuizScore ?? 'N/A'}</p>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
