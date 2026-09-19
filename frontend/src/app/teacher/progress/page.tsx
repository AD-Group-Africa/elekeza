'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { User } from 'lucide-react';

interface StudentProgress {
  studentId: string;
  studentName: string;
  completedLessons: number;
  averageScore: number;
}

export default function ProgressPage() {
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const res = await api.get('/teacher/student/progress');
        setStudents(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProgress();
  }, []);

  if (loading) return <p className="text-purple-300">Loading progress…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-purple-200">Progress Tracking</h1>

      {students.length === 0 ? (
        <div className="glass-card p-6 text-center">
          <User size={48} className="text-purple-400 mx-auto mb-4" />
          <p className="text-purple-200">No learner data yet.</p>
        </div>
      ) : (
        <>
          <div className="glass-card p-4">
            <h3 className="text-lg font-semibold text-purple-200 mb-4">Learner Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={students.map(s => ({ name: s.studentName, score: s.averageScore }))}>
                <XAxis dataKey="name" stroke="#a78bfa" />
                <YAxis stroke="#a78bfa" />
                <Tooltip />
                <Bar dataKey="score" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-4">
            <h3 className="text-lg font-semibold text-purple-200 mb-4">Student Details</h3>
            <div className="space-y-3">
              {students.map(s => (
                <div key={s.studentId} className="flex justify-between items-center bg-white/5 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <User size={18} className="text-purple-300" />
                    <span className="text-purple-200">{s.studentName}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-purple-300 text-sm">{s.completedLessons} lessons</p>
                    <p className="text-purple-400 text-xs">{s.averageScore}% avg</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
