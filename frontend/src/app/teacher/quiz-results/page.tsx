'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { Check, X } from 'lucide-react';

interface QuizResultRow {
  studentName: string;
  lessonTitle: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  correct: boolean;
}

export default function TeacherQuizResults() {
  const [rows, setRows] = useState<QuizResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentFilter, setStudentFilter] = useState('all');

  useEffect(() => {
    api.get('/analytics/teacher/quiz-results')
      .then(res => setRows(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const students = [...new Set(rows.map(r => r.studentName))].sort();
  const filtered = studentFilter === 'all' ? rows : rows.filter(r => r.studentName === studentFilter);
  const correctCount = filtered.filter(r => r.correct).length;

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold text-purple-200">Per-Question Quiz Results</h1>
          <select
            value={studentFilter}
            onChange={e => setStudentFilter(e.target.value)}
            aria-label="Filter by student"
            className="px-3 py-2 rounded-lg border text-purple-200"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
          >
            <option value="all" className="bg-gray-800">All students</option>
            {students.map(s => <option key={s} value={s} className="bg-gray-800">{s}</option>)}
          </select>
        </div>

        {loading ? (
          <p className="text-purple-300">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-6 text-center text-purple-300">
            No completed quiz answers yet. Results appear after learners complete quizzes.
          </div>
        ) : (
          <>
            <div className="glass-card p-4 flex items-center gap-2 text-sm text-purple-200">
              <span>{filtered.length} answers</span>
              <span className="text-purple-300">·</span>
              <span>{correctCount} correct ({Math.round((correctCount / filtered.length) * 100)}%)</span>
            </div>
            <div className="glass-card overflow-x-auto" role="region" aria-label="Quiz results table" tabIndex={0}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-purple-300 border-b border-purple-300/10">
                    <th className="text-left p-3">Student</th>
                    <th className="text-left p-3">Lesson</th>
                    <th className="text-left p-3">Question</th>
                    <th className="text-left p-3">Answer</th>
                    <th className="text-left p-3">Correct</th>
                    <th className="text-left p-3">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={i} className="border-b border-purple-300/5 text-purple-200">
                      <td className="p-3">{r.studentName}</td>
                      <td className="p-3">{r.lessonTitle}</td>
                      <td className="p-3 max-w-xs">{r.question}</td>
                      <td className="p-3 font-semibold">{r.userAnswer}</td>
                      <td className="p-3 text-purple-300">{r.correctAnswer}</td>
                      <td className="p-3">
                        {r.correct
                          ? <Check size={18} className="text-green-400" />
                          : <X size={18} className="text-red-400" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </SidebarLayout>
  );
}
