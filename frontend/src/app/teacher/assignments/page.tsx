'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { ClipboardCheck, Plus } from 'lucide-react';

interface Assignment {
  id: number;
  title: string;
  dueDate: string;
  assignedCount: number;
  submittedCount: number;
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [contentId, setContentId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [message, setMessage] = useState('');

  const fetchAssignments = async () => {
    try {
      const res = await api.get('/teacher/assignments');
      setAssignments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
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
      setMessage('Assignment created!');
      fetchAssignments();
    } catch (err) {
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
              <label className="block text-sm text-purple-300 mb-1">Lesson ID</label>
              <input
                type="number"
                value={contentId}
                onChange={(e) => setContentId(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white"
                placeholder="e.g. 1"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-purple-300 mb-1">Student ID</label>
              <input
                type="number"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-purple-300/30 rounded-lg text-white"
                placeholder="e.g. 4"
                required
              />
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
              <div key={a.id} className="bg-white/5 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <h3 className="text-purple-200 font-semibold">{a.title}</h3>
                  <p className="text-purple-300 text-sm">Due: {a.dueDate}</p>
                </div>
                <button className="text-purple-300 hover:text-white">Review</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}