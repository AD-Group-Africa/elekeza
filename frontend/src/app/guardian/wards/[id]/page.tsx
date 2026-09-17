'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/axios';
import { ArrowLeft, BookOpen, ClipboardCheck, TrendingUp, Calendar, HeartHandshake } from 'lucide-react';
import Link from 'next/link';
import DailyDigest from '@/components/guardian/DailyDigest';

interface WardData {
  name?: string;
  // Relationship label for this guardian-learner bond.
  relationship?: string;
  sneType?: string;
  lessonsCompleted?: number;
  lessonsPending?: number;
  averageScore?: number;
  lastActive?: string;
  recentQuizzes?: { lessonId?: number; score?: number; date?: string }[];
  progressHistory?: { date?: string; score?: number }[];
}

interface LearningSupport {
  wardName?: string;
  summary?: string;
  profileConfiguredBy?: string[];
}

export default function WardDetail() {
  const { id } = useParams();
  const [ward, setWard] = useState<WardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [support, setSupport] = useState<LearningSupport | null>(null);

  useEffect(() => {
    api.get('/guardian/wards/' + id)
      .then(res => setWard(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
    api.get('/guardian/wards/' + id + '/learning-support')
      .then(res => setSupport(res.data as LearningSupport))
      .catch(() => setSupport(null));
  }, [id]);

  if (loading) return <div className="p-6 opacity-70" role="status">Loading…</div>;

  if (!ward) return <div className="p-6" role="alert">Ward not found.</div>;

  const configuredByLabel = (support?.profileConfiguredBy || [])
    .map((src) => ({ EXPLICIT: 'your child', TEACHER: 'their teacher', GUARDIAN: 'you', OBSERVED: 'Elekeza’s observations', SYSTEM: 'standard defaults' }[src] || src))
    .join(', ');

  return (
    <div className="space-y-6">
      <Link href="/guardian" className="flex items-center gap-2 underline underline-offset-2 hover:no-underline">
        <ArrowLeft size={18} /> Back
      </Link>
      <div className="glass-card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-[var(--ek-moss-600)] flex items-center justify-center text-2xl font-bold text-white">
            {ward.name?.charAt(0) || '?'}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{ward.name}</h1>
            <p className="opacity-75">
              {ward.relationship === 'PARENT' || !ward.relationship
                ? 'Your learner'
                : ward.relationship === 'CAREGIVER'
                  ? 'Learner you support as caregiver'
                  : ward.relationship === 'OLDER_SIBLING'
                    ? "Learner you support as older sibling"
                    : 'Your learner'}
            </p>
            {ward.sneType && ward.sneType !== 'NONE' && (
              <p className="text-xs mt-0.5 opacity-75">Learning profile: {ward.sneType}</p>
            )}
          </div>
        </div>

        {/* Server-composed daily digest: learning / attendance / classwork / fees */}
        <DailyDigest wardId={id as string} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/5 p-4 rounded-lg text-center">
            <BookOpen size={20} className="mx-auto mb-2 opacity-80" />
            <p className="text-xs opacity-75">Completed Lessons</p>
            <p className="text-xl font-bold">{ward.lessonsCompleted || 0}</p>
          </div>
          <div className="bg-white/5 p-4 rounded-lg text-center">
            <Calendar size={20} className="mx-auto mb-2 opacity-80" />
            <p className="text-xs opacity-75">Pending</p>
            <p className="text-xl font-bold">{ward.lessonsPending || 0}</p>
          </div>
          <div className="bg-white/5 p-4 rounded-lg text-center">
            <ClipboardCheck size={20} className="mx-auto mb-2 opacity-80" />
            <p className="text-xs opacity-75">Avg Score</p>
            <p className="text-xl font-bold">{ward.averageScore || 0}%</p>
          </div>
          <div className="bg-white/5 p-4 rounded-lg text-center">
            <TrendingUp size={20} className="mx-auto mb-2 opacity-80" />
            <p className="text-xs opacity-75">Last Active</p>
            <p className="text-lg font-bold">{ward.lastActive ? new Date(ward.lastActive).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'N/A'}</p>
          </div>
        </div>

        {support?.summary && (
          <div className="mb-6 p-4 rounded-xl border border-white/10 bg-white/5">
            <div className="flex items-center gap-2 mb-2">
              <HeartHandshake size={18} className="text-amber-300" />
              <h3 className="font-semibold">How {ward.name} is learning right now</h3>
            </div>
            <p className="text-sm leading-relaxed">{support.summary}</p>
            {configuredByLabel && (
              <p className="text-xs mt-2 opacity-60">Learning preferences set by: {configuredByLabel}</p>
            )}
          </div>
        )}

        {ward.recentQuizzes && ward.recentQuizzes.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Recent Quizzes</h3>
            <div className="space-y-1">
              {ward.recentQuizzes.map((q, i) => (
                <div key={i} className="flex justify-between text-sm opacity-85">
                  <span>Lesson {q.lessonId ?? i + 1}</span>
                  <span>{q.score ?? 0}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {ward.progressHistory && ward.progressHistory.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-2">Progress History</h3>
            <div className="space-y-1">
              {ward.progressHistory.map((p, i) => (
                <div key={i} className="flex justify-between text-sm opacity-85">
                  <span>{p.date?.substring(0, 10) || `Entry ${i + 1}`}</span>
                  <span>{p.score ?? 0}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
