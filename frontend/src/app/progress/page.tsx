'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { TrendingUp, Award, Download, BookOpen, BrainCircuit } from 'lucide-react';

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
      'Lessons Completed: ' + (progress?.completedLessons || 0) + '\n' +
      'Quizzes Taken: ' + (progress?.quizzesTaken || 0) + '\n' +
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

  if (loading) return <SidebarLayout><div className="p-6 text-purple-200">Loading your progress…</div></SidebarLayout>;

  const completedLessons = progress?.completedLessons || 0;
  const quizzesTaken = progress?.quizzesTaken || 0;
  const averageScore = progress?.averageScore || 0;
  const streak = progress?.streak || 0;

  const competencies = [
    { name: 'Critical Thinking', value: 78, strokeColor: 'blue' },
    { name: 'Communication', value: 65, strokeColor: 'green' },
    { name: 'Creativity', value: 91, strokeColor: 'purple' },
    { name: 'Citizenship', value: 84, strokeColor: 'yellow' },
  ];

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-purple-200">My Progress</h1>
          <button onClick={downloadReport} className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Download size={18} /> Download Report
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<BookOpen size={24} className="text-blue-400" />} label="Lessons" value={completedLessons} />
          <StatCard icon={<BrainCircuit size={24} className="text-green-400" />} label="Quizzes" value={quizzesTaken} />
          <StatCard icon={<TrendingUp size={24} className="text-purple-400" />} label="Avg Score" value={averageScore + '%'} />
          <StatCard icon={<Award size={24} className="text-yellow-400" />} label="Streak" value={streak + ' days'} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {competencies.map(c => (
            <div key={c.name} className="glass-card p-4 text-center">
              <div className="relative w-16 h-16 mx-auto mb-2">
                <svg viewBox="0 0 36 36" className="w-full h-full">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/10" />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={c.value + ', 100'}
                    className={'text-' + c.strokeColor + '-400'}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-purple-200">{c.value}%</span>
              </div>
              <p className="text-purple-300 text-xs">{c.name}</p>
            </div>
          ))}
        </div>

        <div className="glass-card p-4">
          <h3 className="text-lg font-semibold text-purple-200 mb-3 flex items-center gap-2">
            <Award size={20} className="text-yellow-400" /> Achievements
          </h3>
          <div className="flex flex-wrap gap-3">
            {completedLessons >= 1 && <Badge emoji="🏅" label="First Lesson" />}
            {quizzesTaken >= 1 && <Badge emoji="🧠" label="Quiz Taker" />}
            {streak >= 3 && <Badge emoji="🔥" label="3-Day Streak" />}
            {streak >= 7 && <Badge emoji="🌟" label="Week Warrior" />}
            {averageScore >= 80 && <Badge emoji="🎯" label="Sharpshooter" />}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="glass-card p-4 flex flex-col items-center">
      {icon}
      <p className="text-purple-300 text-xs mt-2">{label}</p>
      <p className="text-lg font-bold text-purple-100">{value}</p>
    </div>
  );
}

function Badge({ emoji, label }: { emoji: string; label: string }) {
  return (
    <div className="flex items-center gap-1 bg-white/5 px-3 py-1 rounded-full">
      <span>{emoji}</span>
      <span className="text-purple-200 text-xs">{label}</span>
    </div>
  );
}