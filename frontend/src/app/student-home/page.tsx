'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { BookOpen, ClipboardCheck, TrendingUp, Award, Zap } from 'lucide-react';
import Link from 'next/link';

export default function StudentHome() {
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/progress/dashboard')
      .then(res => setProgress(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SidebarLayout><div className="p-6 text-purple-200">Loading…</div></SidebarLayout>;

  const streak = progress?.streak || 0;
  const completedLessons = progress?.completedLessons || 0;
  const avgScore = progress?.averageScore || 0;

  let badge = 'Rising Star';
  let badgeColor = 'text-purple-300';
  if (streak >= 5) { badge = 'Fire Streak'; badgeColor = 'text-orange-400'; }
  else if (completedLessons >= 5) { badge = 'Scholar'; badgeColor = 'text-blue-400'; }
  else if (avgScore >= 80) { badge = 'Top Scorer'; badgeColor = 'text-green-400'; }

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-purple-200">Welcome{progress?.name ? ', ' + progress.name : ''}!</h1>
          <span className={'px-3 py-1 rounded-full text-xs font-semibold ' + badgeColor + ' bg-white/10'}>{badge}</span>
        </div>

        {streak > 0 && (
          <div className="glass-card p-4 flex items-center gap-3">
            <Zap size={24} className="text-yellow-400" />
            <div>
              <p className="text-purple-200 font-semibold">{streak} Day Streak!</p>
              <p className="text-purple-300 text-sm">Keep it up!</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 flex flex-col items-center">
            <BookOpen size={24} className="text-blue-400 mb-2" />
            <p className="text-purple-300 text-sm">Lessons</p>
            <p className="text-2xl font-bold text-purple-100">{completedLessons}</p>
          </div>
          <div className="glass-card p-4 flex flex-col items-center">
            <ClipboardCheck size={24} className="text-green-400 mb-2" />
            <p className="text-purple-300 text-sm">Quizzes</p>
            <p className="text-2xl font-bold text-purple-100">{progress?.quizzesTaken || 0}</p>
          </div>
          <div className="glass-card p-4 flex flex-col items-center">
            <TrendingUp size={24} className="text-purple-400 mb-2" />
            <p className="text-purple-300 text-sm">Avg Score</p>
            <p className="text-2xl font-bold text-purple-100">{avgScore}%</p>
          </div>
          <div className="glass-card p-4 flex flex-col items-center">
            <Award size={24} className="text-yellow-400 mb-2" />
            <p className="text-purple-300 text-sm">Streak</p>
            <p className="text-2xl font-bold text-purple-100">{streak} days</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-card p-4">
            <h3 className="text-lg font-semibold text-purple-200 mb-3">Recent Lessons</h3>
            {progress?.recentLessons?.length > 0 ? (
              <ul className="space-y-2">
                {progress.recentLessons.map((l: any, idx: number) => (
                  l.id ? (
                    <li key={l.id || idx} className="flex justify-between text-purple-200">
                      <span>{l.title}</span>
                      <Link href={'/lesson/' + l.id} className="text-purple-400 hover:underline">Continue</Link>
                    </li>
                  ) : null
                ))}
              </ul>
            ) : (
              <p className="text-purple-300">No lessons assigned yet.</p>
            )}
          </div>
          <div className="glass-card p-4">
            <h3 className="text-lg font-semibold text-purple-200 mb-3">Upcoming Quizzes</h3>
            {progress?.upcomingQuizzes?.length > 0 ? (
              <ul className="space-y-2">
                {progress.upcomingQuizzes.map((q: any, idx: number) => (
                  q.lessonId ? (
                    <li key={q.id || idx} className="flex justify-between text-purple-200">
                      <span>{q.title}</span>
                      <Link href={'/quiz/' + q.lessonId} className="text-purple-400 hover:underline">Start</Link>
                    </li>
                  ) : null
                ))}
              </ul>
            ) : (
              <p className="text-purple-300">No quizzes available.</p>
            )}
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}