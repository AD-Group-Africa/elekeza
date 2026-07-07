'use client';

import { useEffect, useState } from 'react';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { api } from '@/lib/api';

interface Student {
  id: string;
  name: string;
  email: string;
  sneType: string;
}

interface Lesson {
  id: number;
  title: string;
  status: string;
}

export default function TeacherDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [form, setForm] = useState({ email: '', fullName: '', password: '', sneType: 'DYSLEXIA' });
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'students' | 'assign'>('students');

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
      setForm({ email: '', fullName: '', password: '', sneType: 'DYSLEXIA' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create student');
    } finally { setLoading(false); }
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleAssign = async () => {
    if (!selectedLessonId || selectedStudentIds.length === 0) { setError('Select a lesson and at least one student'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/teacher/content/assign', {
        contentId: Number(selectedLessonId),
        studentIds: selectedStudentIds.map(Number)
      });
      alert('Lesson assigned!');
      setSelectedStudentIds([]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Assignment failed');
    } finally { setLoading(false); }
  };

  return (
    <SidebarLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Teacher Dashboard</h1>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}

      <div className="flex gap-4 mb-6">
        <button onClick={() => setTab('students')} className={`btn-primary ${tab === 'students' ? 'opacity-100' : 'opacity-50'}`}>Students</button>
        <button onClick={() => setTab('assign')} className={`btn-primary ${tab === 'assign' ? 'opacity-100' : 'opacity-50'}`}>Assign Lesson</button>
      </div>

      {tab === 'students' && (
        <div className="card mb-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">Create Learner</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input className="border rounded-lg px-3 py-2" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            <input className="border rounded-lg px-3 py-2" placeholder="Full Name" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} />
            <input className="border rounded-lg px-3 py-2" type="password" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
            <select className="border rounded-lg px-3 py-2" value={form.sneType} onChange={e => setForm({...form, sneType: e.target.value})}>
              <option>DYSLEXIA</option><option>ADHD</option><option>AUTISM</option><option>INTELLECTUAL_DISABILITY</option><option>DYSCALCULIA</option><option>NONE</option>
            </select>
          </div>
          <button onClick={handleCreate} disabled={loading} className="btn-primary mt-4 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Student'}
          </button>

          <h2 className="text-xl font-semibold text-blue-900 mt-8 mb-4">Your Students</h2>
          {students.length === 0 ? <p className="text-gray-500">No students in your institution yet.</p> : (
            <ul className="space-y-2">
              {students.map(s => (
                <li key={s.id} className="flex justify-between items-center border-b pb-2">
                  <span className="text-gray-700">{s.name} ({s.sneType})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'assign' && (
        <div className="card mb-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">Assign Lesson</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Lesson</label>
            <select className="border rounded-lg px-3 py-2 w-full" value={selectedLessonId} onChange={e => setSelectedLessonId(e.target.value)}>
              <option value="">Select lesson</option>
              {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Students (select one or more)</label>
            <div className="max-h-48 overflow-y-auto border rounded-lg p-2">
              {students.map(s => (
                <label key={s.id} className="flex items-center gap-2 py-1">
                  <input type="checkbox" checked={selectedStudentIds.includes(s.id)} onChange={() => toggleStudentSelection(s.id)} />
                  {s.name} ({s.sneType})
                </label>
              ))}
            </div>
          </div>
          <button onClick={handleAssign} disabled={loading} className="btn-primary py-2">
            {loading ? 'Assigning...' : `Assign to ${selectedStudentIds.length} student(s)`}
          </button>
        </div>
      )}
    </SidebarLayout>
  );
}
