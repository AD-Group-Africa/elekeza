'use client';

/**
 * My Progress — honest learner progress from the real backend.
 *
 * Reads:
 *   - /progress/dashboard  (lessons, quizzes, average score, recent lessons)
 *   - /gamification/student (points, level, stars, achievements)
 *   - /analytics/student   (weekly activity, quiz history)
 *
 * It does NOT show invented CBC competency percentages. Every number here is
 * either from the backend or clearly labelled as a learner-facing badge summary.
 */

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { TrendingUp, Award, Download, BookOpen, Star } from 'lucide-react';

interface ProgressData {
  name?: string;
  completedLessons?: number;
  quizzesTaken?: number;
  averageScore?: number;
  learningStreak?: number;
  recentLessons?: Array<{ id?: number; title?: string; quizScore?: number; completedAt?: string }>;
  upcomingQuizzes?: Array<{ id?: number; lessonId?: number; title?: string }>;
}

interface GamificationData {
  level: number;
  levelName: string;
  points: number;
  nextLevelPoints: number;
  stars: number;
  achievements: string[];
}

interface AnalyticsData {
  learningStreak?: number;
  weeklyActivity?: Array<{ day: string; minutes: number }>;
  quizHistory?: Array<{ lessonId?: number; score?: number; date?: string }>;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="glass-card p-4 flex flex-col items-center">
      {icon}
      <p className="text-purple-300 text-xs mt-2">{label}</p>
      <p className="text-lg font-bold text-purple-100">{value}</p>
    </div>
  );
}

interface BadgeProps {
  emoji: string;
  label: string;
}

function Badge({ emoji, label }: BadgeProps) {
  return (
    <div className="flex items-center gap-1 bg-white/5 px-3 py-1 rounded-full">
      <span>{emoji}</span>
      <span className="text-purple-200 text-xs">{label}</span>
    </div>
  );
}

export default function StudentProgress() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [game, setGame] = useState<GamificationData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [p, g, a] = await Promise.all([
          api.get('/progress/dashboard'),
          api.get('/gamification/student'),
          api.get('/analytics/student'),
        ]);
        setProgress(p.data ?? null);
        setGame(g.data ?? null);
        setAnalytics((a.data as AnalyticsData) ?? null);
      } catch (e: unknown) {
        const message =
          (e as { message?: string }).message ||
          'We could not load your progress right now. Please try again.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const downloadReport = () => {
    const name = progress?.name || 'Student';
    const completedLessons = progress?.completedLessons || 0;
    const quizzesTaken = progress?.quizzesTaken || 0;
    const averageScore = progress?.averageScore || 0;
    const streak = progress?.learningStreak ?? game?.level ?? 0;

    const content =
      'Elekeza Student Progress Report\n' +
      'Name: ' + name + '\n' +
      'Lessons Completed: ' + completedLessons + '\n' +
      'Quizzes Taken: ' + quizzesTaken + '\n' +
      'Average Score: ' + averageScore + '%\n' +
      'Stars: ' + (game?.stars ?? 0) + ' of 5\n' +
      'Level: ' + (game?.level ?? 0) + ' (' + (game?.levelName ?? '') + ')\n' +
      'Points: ' + (game?.points ?? 0) + '\n' +
      'Learning Streak: ' + streak + ' days\n' +
      'Date: ' + new Date().toLocaleDateString();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'elekeza-progress-report.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="p-6 text-purple-200">
          <BookOpen size={24} className="text-purple-400 mx-auto mb-3" />
          <p className="text-center">Loading your progress…</p>
        </div>
      </SidebarLayout>
    );
  }

  if (error && !progress && !game) {
    return (
      <SidebarLayout>
        <div className="p-6 text-center">
          <BookOpen size={40} className="text-purple-400 mx-auto mb-3" />
          <p className="text-purple-200">{error}</p>
          <a
            href="/student-home"
            className="mt-4 inline-block rounded-lg bg-purple-600 px-5 py-2.5 text-sm text-white"
          >
            Back to home
          </a>
        </div>
      </SidebarLayout>
    );
  }

  const completedLessons = progress?.completedLessons || 0;
  const quizzesTaken = progress?.quizzesTaken || 0;
  const averageScore = progress?.averageScore || 0;
  const streak = progress?.learningStreak ?? analytics?.learningStreak ?? 0;

  return (
    <SidebarLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-purple-200">My Progress</h1>
          <button
            onClick={downloadReport}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Download size={18} /> Download report
          </button>
        </div>

        {/* Gamification strip — the learner's earned story */}
        {game && (
          <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-purple-300 text-sm">Your level</p>
                <p className="text-2xl font-bold text-purple-100 mt-0.5">
                  Level {game.level} · {game.levelName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-purple-300 text-sm">Stars</p>
                <p className="text-2xl font-bold text-purple-100 mt-0.5" aria-label={`${game.stars} of 5 stars`}>
                  {'★'.repeat(game.stars)}
                  {'☆'.repeat(Math.max(0, 5 - game.stars))}
                </p>
              </div>
            </div>

            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-violet-400 transition-[width] duration-700"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      100 * (1 - (game.nextLevelPoints / 50))
                    )
                  )}%`,
                }}
                role="progressbar"
                aria-valuenow={game.points}
                aria-valuemin={0}
                aria-valuemax={game.level * 50}
                aria-label={`${game.nextLevelPoints} points to Level ${game.level + 1}`}
              />
            </div>
            <p className="mt-2 text-sm text-purple-300">
              {game.nextLevelPoints} points to Level {game.level + 1}
            </p>
          </div>
        )}

        {/* Real progress stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<BookOpen size={24} className="text-blue-400" />}
            label="Lessons completed"
            value={completedLessons}
          />
          <StatCard
            icon={<Star size={24} className="text-green-400" />}
            label="Quizzes taken"
            value={quizzesTaken}
          />
          <StatCard
            icon={<TrendingUp size={24} className="text-purple-400" />}
            label="Average score"
            value={averageScore + '%'}
          />
          <StatCard
            icon={<Award size={24} className="text-yellow-400" />}
            label="Learning streak"
            value={streak + ' days'}
          />
        </div>

        {/* Achievements — earned, not fabricated */}
        {game && game.achievements.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-lg font-semibold text-purple-200 mb-3 flex items-center gap-2">
              <Award size={20} className="text-yellow-400" /> Achievements
            </h3>
            <div className="flex flex-wrap gap-3">
              {game.achievements.map((label) => (
                <Badge key={label} emoji="🏅" label={label} />
              ))}
            </div>
            {game.achievements.length === 0 && (
              <p className="text-purple-300 text-sm">
                No achievements yet — every lesson and quiz you complete unlocks new ones.
              </p>
            )}
          </div>
        )}

        {/* Recent lessons from the backend */}
        {progress?.recentLessons && progress.recentLessons.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-lg font-semibold text-purple-200 mb-3 flex items-center gap-2">
              <BookOpen size={18} className="text-purple-400" /> Recent lessons
            </h3>
            <ul className="space-y-2">
              {progress.recentLessons.map((lesson) => (
                <li
                  key={lesson.id ?? lesson.title}
                  className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3"
                >
                  <div>
                    <p className="text-purple-200 font-medium">{lesson.title}</p>
                    <p className="text-purple-400 text-xs">
                      {lesson.completedAt ?? 'Completed'}
                    </p>
                  </div>
                  <span className="text-purple-200 font-semibold">
                    {Math.round(lesson.quizScore ?? 0)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weekly activity from analytics */}
        {analytics?.weeklyActivity && analytics.weeklyActivity.length > 0 && (
          <div className="glass-card p-4">
            <h3 className="text-lg font-semibold text-purple-200 mb-3 flex items-center gap-2">
              <TrendingUp size={18} className="text-purple-400" /> This week
            </h3>
            <div className="flex flex-wrap gap-2">
              {analytics.weeklyActivity.map((day) => (
                <div
                  key={day.day}
                  className="rounded-xl bg-white/5 px-3 py-2 text-sm"
                >
                  <span className="text-purple-300">{day.day}</span>
                  <span className="ml-2 font-semibold text-purple-100">
                    {day.minutes} min
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(!progress?.recentLessons || progress.recentLessons.length === 0) && (
          <div className="glass-card p-6 text-center">
            <BookOpen size={40} className="text-purple-400 mx-auto mb-3" />
            <p className="text-purple-200">You have not completed any lessons yet.</p>
            <p className="text-purple-300 text-sm mt-1">
              Open a lesson from your home to start earning progress.
            </p>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
