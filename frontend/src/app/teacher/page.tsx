'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

interface Student {
  id: string;
  name: string;
  sneType: string;
}

export default function TeacherDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState({ email: '', fullName: '', password: '', sneType: 'DYSLEXIA' });
  const [assignLessonId, setAssignLessonId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [progress, setProgress] = useState<any>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/teacher/students')
      .then(res => setStudents(res.data))
      .catch(err => console.error('Error fetching students:', err));
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
      setError(err.response?.data?.message || 'Failed to create student. Is the backend running on port 9090?');
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!assignLessonId || !selectedStudentId) {
      alert('Please select a lesson and student.');
      return;
    }
    try {
      await api.post('/teacher/content/assign', {
        contentId: Number(assignLessonId),
        studentIds: [Number(selectedStudentId)],
      });
      alert('Lesson assigned!');
    } catch (err: any) {
      alert('Error assigning lesson: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleViewProgress = async (student: Student) => {
    try {
      const res = await api.get(`/teacher/student/${student.id}/progress`);
      setSelectedStudent(student);
      setProgress(res.data);
    } catch (err: any) {
      alert('Error fetching progress: ' + (err.response?.data?.message || err.message));
    }
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

      {/* Create Student Card */}
      <div className="card mb-6">
        <h2 className="text-xl font-semibold text-blue-900 mb-4">Create Learner</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input className="border border-gray-300 rounded-lg px-3 py-2" placeholder="Email"
            value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
          <input className="border border-gray-300 rounded-lg px-3 py-2" placeholder="Full Name"
            value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} />
          <input className="border border-gray-300 rounded-lg px-3 py-2" type="password" placeholder="Password"
            value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
          <select className="border border-gray-300 rounded-lg px-3 py-2"
            value={form.sneType} onChange={e => setForm({...form, sneType: e.target.value})}>
            <option>DYSLEXIA</option><option>ADHD</option><option>AUTISM</option><option>DYSCALCULIA</option><option>INTELLECTUAL_DISABILITY</option>
          </select>
        </div>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="btn-primary mt-4 disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Student'}
        </button>
      </div>

      {/* Assign Lesson Card */}
      <div className="card mb-6">
        <h2 className="text-xl font-semibold text-blue-900 mb-4">Assign Lesson</h2>
        <div className="flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lesson ID</label>
            <input className="border border-gray-300 rounded-lg px-3 py-2 w-24" placeholder="1"
              value={assignLessonId} onChange={e => setAssignLessonId(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Student</label>
            <select className="border border-gray-300 rounded-lg px-3 py-2"
              value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)}>
              <option value="">Select student</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button onClick={handleAssign} className="btn-primary py-2">Assign</button>
        </div>
      </div>

      {/* Student List */}
      <div className="card">
        <h2 className="text-xl font-semibold text-blue-900 mb-4">Students</h2>
        {students.length === 0 ? (
          <p className="text-gray-500">No students yet. Create one above.</p>
        ) : (
          <ul className="space-y-2">
            {students.map(s => (
              <li key={s.id} className="flex justify-between items-center border-b pb-2">
                <span className="text-gray-700">{s.name} ({s.sneType})</span>
                <button onClick={() => handleViewProgress(s)} className="btn-outline text-sm py-1 px-3">
                  Progress
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedStudent && progress && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900">{selectedStudent.name}'s Progress</h3>
            <p className="text-gray-600">Completed lessons: {progress.completedLessons}</p>
            <p className="text-gray-600">Average quiz score: {progress.lastQuizScore ?? 'N/A'}</p>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
