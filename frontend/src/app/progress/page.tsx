'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { BookOpen, CheckCircle, TrendingUp, Download, BarChart2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function StudentProgress() {
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/progress/dashboard')
      .then(res => setProgress(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const downloadReport = () => {
    const content = 'Elekeza Student Progress Report\n' +
      'Name: ' + (progress?.name || 'Student') + '\n' +
      'Completed Lessons: ' + (progress?.completedLessons || 0) + '\n' +
      'Quizzes Passed: ' + (progress?.quizzesPassed || 0) + '\n' +
      'Average Score: ' + (progress?.averageScore || 0) + '%\n' +
      'Date: ' + new Date().toLocaleDateString();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'progress-report.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <SidebarLayout><div className="p-6 text-purple-200">Loading…</div></SidebarLayout>;

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-purple-200">Your Progress</h1>
          <button onClick={downloadReport} className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Download size={18} /> Download Report
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 text-center">
            <BookOpen size={24} className="text-blue-400 mx-auto mb-2" />
            <p className="text-purple-300 text-sm">Completed Lessons</p>
            <p className="text-2xl font-bold text-purple-100">{progress?.completedLessons || 0}</p>
          </div>
          <div className="glass-card p-4 text-center">
            <CheckCircle size={24} className="text-green-400 mx-auto mb-2" />
            <p className="text-purple-300 text-sm">Quizzes Passed</p>
            <p className="text-2xl font-bold text-purple-100">{progress?.quizzesPassed || 0}</p>
          </div>
          <div className="glass-card p-4 text-center">
            <TrendingUp size={24} className="text-purple-400 mx-auto mb-2" />
            <p className="text-purple-300 text-sm">Average Score</p>
            <p className="text-2xl font-bold text-purple-100">{progress?.averageScore || 0}%</p>
          </div>
          <div className="glass-card p-4 text-center">
            <BarChart2 size={24} className="text-yellow-400 mx-auto mb-2" />
            <p className="text-purple-300 text-sm">Total Quizzes</p>
            <p className="text-2xl font-bold text-purple-100">{progress?.quizzesTaken || 0}</p>
          </div>
        </div>

        {progress?.quizHistory && progress.quizHistory.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-lg font-semibold text-purple-200 mb-4">Quiz Score Progression</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={progress.quizHistory}>
                <XAxis dataKey="date" stroke="#a78bfa" />
                <YAxis stroke="#a78bfa" />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className="glass-card p-4">
            <h3 className="text-lg font-semibold text-purple-200 mb-3">Subject Performance</h3>
            {progress?.subjectPerformance?.length > 0 ? (
              <div className="space-y-2">
                {progress.subjectPerformance.map((sp: any) => (
                  <div key={sp.subject} className="flex justify-between text-purple-200">
                    <span>{sp.subject}</span>
                    <span className="text-purple-300">{sp.averageScore}%</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-purple-300">No subject data yet.</p>}
          </div>
          <div className="glass-card p-4">
            <h3 className="text-lg font-semibold text-purple-200 mb-3">Assignments & Tasks</h3>
            {progress?.assignments?.length > 0 ? (
              <ul className="space-y-2">
                {progress.assignments.map((a: any) => (
                  <li key={a.id} className="text-purple-200 text-sm flex justify-between">
                    <span>{a.title}</span>
                    <span className="text-purple-400">Due: {a.dueDate}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-purple-300">No pending assignments.</p>}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}