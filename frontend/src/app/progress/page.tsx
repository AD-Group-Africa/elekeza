'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { BookOpen, CheckCircle, TrendingUp, Download, BarChart2, Award, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface CompetencyProgress {
  area: string;
  progress: number;
}

interface QuizHistoryEntry {
  lessonId: number;
  score: number;
  date: string;
}

interface ProgressDashboardData {
  learningStreak: number;
  completedLessons: number;
  pendingLessons: number;
  averageScore: number;
  weeklyActivity: Array<{ day: string; minutes: number }>;
  quizHistory: QuizHistoryEntry[];
  competencyProgress: CompetencyProgress[];
}

export default function StudentProgress() {
  const [data, setData] = useState<ProgressDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hits the backend endpoint /api/analytics/student mapped under AnalyticsController
    api.get('/analytics/student')
      .then(res => {
        setData(res.data);
      })
      .catch(err => {
        console.error('Error fetching progress data:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const downloadReport = () => {
    const reportContent = 'Elekeza Student Progress Report\n' +
      '====================================\n' +
      'Date: ' + new Date().toLocaleDateString() + '\n' +
      'Completed Lessons: ' + (data?.completedLessons ?? 0) + '\n' +
      'Pending Lessons: ' + (data?.pendingLessons ?? 0) + '\n' +
      'Average Quiz Score: ' + (data?.averageScore ?? 0).toFixed(1) + '%\n' +
      'Learning Streak: ' + (data?.learningStreak ?? 0) + ' days\n\n' +
      'Competency Progress:\n' +
      (data?.competencyProgress ?? []).map(c => ` - ${c.area}: ${c.progress.toFixed(1)}%`).join('\n') + '\n\n' +
      'Thank you for learning with Elekeza!';

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `progress-report-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          <span className="ml-4 text-purple-200">Loading progress...</span>
        </div>
      </SidebarLayout>
    );
  }

  const completed = data?.completedLessons ?? 0;
  const averageScore = data?.averageScore ?? 0;
  const learningStreak = data?.learningStreak ?? 0;
  const pendingLessons = data?.pendingLessons ?? 0;

  // Render SVG Competency Ring
  const renderCompetencyRing = (area: string, progress: number, color: string) => {
    const radius = 40;
    const strokeWidth = 8;
    const normalizedRadius = radius - strokeWidth * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <div key={area} className="flex flex-col items-center p-4 bg-purple-950/20 rounded-xl border border-purple-900/50">
        <div className="relative flex items-center justify-center">
          <svg height={radius * 2} width={radius * 2}>
            <circle
              stroke="rgba(124, 58, 237, 0.1)"
              fill="transparent"
              strokeWidth={strokeWidth}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
            />
            <circle
              stroke={color}
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference + ' ' + circumference}
              style={{ strokeDashoffset }}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              className="transition-all duration-1000 ease-out -rotate-90 origin-center"
            />
          </svg>
          <span className="absolute text-sm font-bold text-purple-100">{progress.toFixed(0)}%</span>
        </div>
        <span className="mt-3 text-xs font-semibold text-purple-300 text-center">{area}</span>
      </div>
    );
  };

  const competencyColors = ['#3b82f6', '#10b981', '#a78bfa', '#f59e0b', '#ec4899'];

  return (
    <SidebarLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 to-pink-300">
              Your Competency Dashboard
            </h1>
            <p className="text-purple-300 text-sm">Visualize your skills, quiz history, and progress records.</p>
          </div>
          <button
            onClick={downloadReport}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-purple-900/30 transition-all duration-200"
          >
            <Download size={18} />
            <span>Download Report</span>
          </button>
        </div>

        {/* KPI Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-5 text-center relative overflow-hidden group hover:border-purple-500/50 transition-all duration-300">
            <BookOpen size={24} className="text-blue-400 mx-auto mb-2" />
            <p className="text-purple-300 text-xs uppercase tracking-wider font-semibold">Completed Lessons</p>
            <p className="text-3xl font-black text-purple-500 mt-1">{completed}</p>
          </div>
          <div className="glass-card p-5 text-center relative overflow-hidden group hover:border-purple-500/50 transition-all duration-300">
            <CheckCircle size={24} className="text-green-400 mx-auto mb-2" />
            <p className="text-purple-300 text-xs uppercase tracking-wider font-semibold">Lessons Assigned</p>
            <p className="text-3xl font-black text-green-400 mt-1">{completed + pendingLessons}</p>
          </div>
          <div className="glass-card p-5 text-center relative overflow-hidden group hover:border-purple-500/50 transition-all duration-300">
            <TrendingUp size={24} className="text-purple-400 mx-auto mb-2" />
            <p className="text-purple-300 text-xs uppercase tracking-wider font-semibold">Average Score</p>
            <p className="text-3xl font-black text-purple-400 mt-1">{averageScore.toFixed(1)}%</p>
          </div>
          <div className="glass-card p-5 text-center relative overflow-hidden group hover:border-purple-500/50 transition-all duration-300">
            <Zap size={24} className="text-yellow-400 mx-auto mb-2" />
            <p className="text-purple-300 text-xs uppercase tracking-wider font-semibold">Learning Streak</p>
            <p className="text-3xl font-black text-yellow-400 mt-1">{learningStreak} Days</p>
          </div>
        </div>

        {/* SVG Competency Rings Section */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Award className="text-purple-400" size={24} />
            <h2 className="text-xl font-bold text-purple-200">Skill Competency Rings</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {(data?.competencyProgress ?? []).map((comp, idx) =>
              renderCompetencyRing(comp.area, comp.progress, competencyColors[idx % competencyColors.length])
            )}
            {(!data?.competencyProgress || data.competencyProgress.length === 0) && (
              <p className="text-purple-300 col-span-full text-center">Complete lessons and quizzes to build your SNE profile.</p>
            )}
          </div>
        </div>

        {/* Graphs and History */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Progression Graph */}
          <div className="glass-card p-5 md:col-span-2 space-y-4">
            <h3 className="text-lg font-bold text-purple-200">Quiz Progression Over Time</h3>
            {data?.quizHistory && data.quizHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={[...data.quizHistory].reverse()}>
                  <XAxis dataKey="date" stroke="#c084fc" />
                  <YAxis stroke="#c084fc" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e1b4b', border: '1px solid #4c1d95', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="score" stroke="#9333ea" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[260px] text-purple-400">
                <BarChart2 size={48} className="text-purple-500/50 mb-2" />
                <p>No quiz score progression available yet.</p>
              </div>
            )}
          </div>

          {/* Actionable Next Steps CTA */}
          <div className="glass-card p-5 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-purple-200">Interactive Next Steps</h3>
              <p className="text-sm text-purple-300 leading-relaxed">
                You have done well on your learning journey! Keep up the momentum to build deep conceptual skills.
              </p>
              <div className="p-4 bg-purple-950/30 rounded-lg border border-purple-900/40 text-xs text-purple-200 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-400"></span>
                  <span>Review key vocabulary terms.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-400"></span>
                  <span>Take simplified quizzes to gain stars.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-pink-400"></span>
                  <span>Unlock SNE visual diagrams.</span>
                </div>
              </div>
            </div>
            <div className="pt-4">
              <a
                href="/student-home"
                className="block text-center w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl transition-all duration-200"
              >
                Go Learn Now
              </a>
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
