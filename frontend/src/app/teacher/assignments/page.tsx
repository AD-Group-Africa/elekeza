'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { ClipboardCheck, Plus } from 'lucide-react';
import Toast from '@/components/Toast';

/** Row from GET /api/teacher/assignments — one lesson assigned to one learner. */
interface Assignment {
  id: number;
  contentId: number;
  lessonTitle: string;
  studentId: number;
  studentName: string;
  assignedAt: string;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | string;
  score: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Not started',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
};

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [contentId, setContentId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState('');
  // Labelled targets for the form (audit EL-F-010: raw IDs replaced)
  const [lessons, setLessons] = useState<{ id: number; title: string }[]>([]);
  const [students, setStudents] = useState<{ id: number; name: string }[]>([]);

  const fetchAssignments = async () => {
    try {
      const res = await api.get('/teacher/assignments');
      setAssignments(res.data);
    } catch {
      setMessage('Could not load assignments. Please refresh to try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
    // Load labelled choices for the assignment form (EL-F-010)
    api.get('/content/list').then(res => setLessons(res.data || [])).catch(() => undefined);
    api.get('/teacher/students').then(res => setStudents(res.data || [])).catch(() => undefined);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/teacher/content/assign', {
        contentId: parseInt(contentId),
        studentIds: [parseInt(studentId)],
      });
      setShowForm(false);
      setContentId('');
      setStudentId('');
      setMessage('');
      setToast('Assignment created!'); // audit EL-F-011: visible confirmation
      fetchAssignments();
    } catch {
      setMessage('Failed to create assignment.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-purple-200">Assignments</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={18} /> New Assignment
        </button>
      </div>

      {showForm && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-purple-200 mb-4">Assign Lesson to Student</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label htmlFor="assign-lesson" className="block text-sm text-purple-300 mb-1">Lesson</label>
              <select
                id="assign-lesson"
                value={contentId}
                onChange={(e) => setContentId(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white"
                required
              >
                <option value="" className="text-gray-900">Choose a lesson…</option>
                {lessons.map(l => (
                  <option key={l.id} value={l.id} className="text-gray-900">{l.title} (#{l.id})</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="assign-student" className="block text-sm text-purple-300 mb-1">Student</label>
              <select
                id="assign-student"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white"
                required
              >
                <option value="" className="text-gray-900">Choose a student…</option>
                {students.map(s => (
                  <option key={s.id} value={s.id} className="text-gray-900">{s.name} (#{s.id})</option>
                ))}
              </select>
            </div>
            <button type="submit" className="bg-purple-600 text-white px-6 py-2 rounded-lg">Assign</button>
          </form>
          {message && <p className="text-purple-300 text-sm">{message}</p>}
        </div>
      )}

      <div className="glass-card p-4">
        {loading ? (
          <p className="text-purple-300">Loading assignments…</p>
        ) : assignments.length === 0 ? (
          <div className="text-center py-8">
            <ClipboardCheck size={48} className="text-purple-400 mx-auto mb-4" />
            <p className="text-purple-200">No assignments yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map(a => (
              <div key={a.id} className="bg-white/5 p-4 rounded-lg flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h3 className="text-purple-200 font-semibold">{a.lessonTitle}</h3>
                  <p className="text-purple-300 text-sm">
                    {a.studentName}
                    {a.assignedAt ? ` · assigned ${new Date(a.assignedAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs px-2 py-1 rounded-full bg-purple-600/30 text-purple-100">
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                  {a.score != null && (
                    <p className="text-purple-300 text-sm mt-1">Score {Math.round(a.score)}%</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  );
}