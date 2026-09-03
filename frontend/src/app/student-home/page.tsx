'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { BookOpen, ClipboardCheck, TrendingUp, Star, Award, Zap, ChevronRight, Play, BrainCircuit, Target } from 'lucide-react';
import Link from 'next/link';

interface ProgressData {
  name?: string;
  streak?: number;
  completedLessons?: number;
  quizzesTaken?: number;
  averageScore?: number;
  upcomingQuizzes?: { title: string; lessonId: number }[];
  recentLessons?: { id: number; title: string }[];
  quizHistory?: { score: number; date?: string }[];
}

export default function StudentHome() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mood, setMood] = useState<string | null>(null);

  useEffect(() => {
    api.get('/progress/dashboard')
      .then(res => setProgress(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SidebarLayout><div className="p-6 text-purple-200 animate-pulse">Loading your dashboard…</div></SidebarLayout>;

  const name = progress?.name || 'Learner';
  const streak = progress?.streak || 0;
  const completedLessons = progress?.completedLessons || 0;
  const quizzesTaken = progress?.quizzesTaken || 0;
  const averageScore = progress?.averageScore || 0;

  // Badge logic
  let badge = 'Rising Star';
  let badgeColor = 'text-purple-300';
  if (streak >= 7) { badge = '7-Day Streak'; badgeColor = 'text-orange-400'; }
  else if (completedLessons >= 10) { badge = 'Scholar'; badgeColor = 'text-blue-400'; }
  else if (averageScore >= 80) { badge = 'Top Scorer'; badgeColor = 'text-green-400'; }

  // Time‑of‑day greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Mood handler (simplified – can be extended)
  const handleMood = (m: string) => {
    setMood(m);
    // In production, POST to backend to adjust difficulty / notify teacher
  };

  // Mock upcoming quiz (replace with real data if available)
  const upcomingQuiz = progress?.upcomingQuizzes?.[0];
  const currentLesson = progress?.recentLessons?.[0]; // The first lesson is the current one

  return (
    <SidebarLayout>
      <div className="space-y-6 pb-20 md:pb-0">
        {/* Hero Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-purple-200">
              {greeting}, {name} 👋
            </h1>
            <p className="text-purple-300 mt-1">You&apos;re doing great today.</p>
            {badge && (
              <span className={'inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ' + badgeColor + ' bg-white/10'}>
                {badge}
              </span>
            )}
          </div>
          {/* Mood Check */}
          <div className="flex items-center gap-2 glass-card p-2 rounded-xl">
            <span className="text-purple-300 text-sm">How are you?</span>
            {['😊', '😐', '😔'].map(m => (
              <button
                key={m}
                onClick={() => handleMood(m)}
                className={'text-2xl p-1 rounded-lg transition ' + (mood === m ? 'bg-purple-600/40 scale-110' : 'hover:bg-white/10')}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Learning Streak + Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {streak > 0 && (
            <div className="glass-card p-4 flex items-center gap-3 col-span-2 md:col-span-1">
              <Zap size={24} className="text-yellow-400" />
              <div>
                <p className="text-purple-200 font-semibold">{streak} Days</p>
                <p className="text-purple-300 text-xs">Learning Streak</p>
              </div>
            </div>
          )}
          <StatCard icon={<BookOpen size={24} className="text-blue-400" />} label="Lessons" value={completedLessons} />
          <StatCard icon={<ClipboardCheck size={24} className="text-green-400" />} label="Quizzes" value={quizzesTaken} />
          <StatCard icon={<Target size={24} className="text-purple-400" />} label="Avg Score" value={averageScore + '%'} />
        </div>

        {/* Continue Learning – Largest Card */}
        {currentLesson && (
          <Link href={'/lesson/' + currentLesson.id} className="block">
            <div className="glass-card p-6 hover:bg-white/5 transition cursor-pointer flex items-center justify-between">
              <div className="flex-1">
                <p className="text-purple-300 text-sm mb-1">Continue Learning</p>
                <h2 className="text-xl font-bold text-purple-200">{currentLesson.title}</h2>
                <div className="flex items-center gap-4 mt-3">
                  <span className="text-purple-400 text-sm">⏱ 8 mins</span>
                  <span className="text-purple-400 text-sm">📘 Easy</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 mt-4">
                  <div className="bg-purple-600 h-2 rounded-full" style={{ width: '63%' }} />
                </div>
                <p className="text-purple-400 text-xs mt-1">63% complete</p>
              </div>
              <ChevronRight size={32} className="text-purple-300 ml-4" />
            </div>
          </Link>
        )}

        {/* Today's Goal */}
        <div className="glass-card p-4">
          <h3 className="text-lg font-semibold text-purple-200 mb-3 flex items-center gap-2">
            <Star size={20} className="text-yellow-400" /> Today&apos;s Goal
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/5 p-3 rounded-lg">
              <BookOpen size={20} className="text-blue-400 mx-auto mb-1" />
              <p className="text-purple-200 font-bold">1</p>
              <p className="text-purple-400 text-xs">Lesson</p>
            </div>
            <div className="bg-white/5 p-3 rounded-lg">
              <ClipboardCheck size={20} className="text-green-400 mx-auto mb-1" />
              <p className="text-purple-200 font-bold">1</p>
              <p className="text-purple-400 text-xs">Quiz</p>
            </div>
            <div className="bg-white/5 p-3 rounded-lg">
              <TrendingUp size={20} className="text-orange-400 mx-auto mb-1" />
              <p className="text-purple-200 font-bold">15</p>
              <p className="text-purple-400 text-xs">Minutes</p>
            </div>
          </div>
        </div>

        {/* Progress Chart (placeholder for real chart) */}
        {progress?.quizHistory && progress.quizHistory.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-lg font-semibold text-purple-200 mb-3">Progress</h3>
            <div className="h-40 flex items-end gap-2">
              {progress.quizHistory.slice(-7).map((entry, i: number) => (
                <div key={i} className="flex-1 flex flex-col items-center">
                  <div className="w-full bg-purple-600/50 rounded-t" style={{ height: (entry.score || 0) * 1.5 + 'px' }} />
                  <span className="text-purple-400 text-xs mt-1">{entry.date?.substring(5)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements Row */}
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

        {/* AI Companion Widget */}
        <div className="glass-card p-4 bg-purple-600/10 border border-purple-500/20">
          <div className="flex items-start gap-3">
            <BrainCircuit size={24} className="text-purple-300 mt-1" />
            <div className="flex-1">
              <p className="text-purple-200 font-semibold">Your AI Companion</p>
              <p className="text-purple-300 text-sm mt-1">Would you like me to explain something differently?</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button className="bg-purple-600/40 text-white px-3 py-1 rounded-full text-sm hover:bg-purple-600/60 transition">Try Again</button>
                <button className="bg-purple-600/40 text-white px-3 py-1 rounded-full text-sm hover:bg-purple-600/60 transition">Show Pictures</button>
                <button className="bg-purple-600/40 text-white px-3 py-1 rounded-full text-sm hover:bg-purple-600/60 transition">Read Aloud</button>
                <button className="bg-purple-600/40 text-white px-3 py-1 rounded-full text-sm hover:bg-purple-600/60 transition">Translate</button>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming */}
        {upcomingQuiz && (
          <div className="glass-card p-4">
            <h3 className="text-lg font-semibold text-purple-200 mb-3">Upcoming</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 font-medium">Quiz: {upcomingQuiz.title}</p>
                <p className="text-purple-400 text-sm">Tomorrow</p>
              </div>
              <Link href={'/quiz/' + upcomingQuiz.lessonId} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm">
                Practice
              </Link>
            </div>
          </div>
        )}
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