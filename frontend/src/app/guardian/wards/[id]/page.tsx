'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/axios';
import { ArrowLeft, BookOpen, ClipboardCheck, TrendingUp, Calendar, HeartHandshake } from 'lucide-react';
import Link from 'next/link';

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

  if (loading) return <div className="p-6 text-purple-200">Loading…</div>;

  if (!ward) return <div className="p-6 text-red-400">Ward not found.</div>;

  const configuredByLabel = (support?.profileConfiguredBy || [])
    .map((src) => ({ EXPLICIT: 'your child', TEACHER: 'their teacher', GUARDIAN: 'you', OBSERVED: 'Elekeza’s observations', SYSTEM: 'standard defaults' }[src] || src))
    .join(', ');

  return (
    <div className="space-y-6">
      <Link href="/guardian" className="flex items-center gap-2 text-purple-300 hover:text-white">
        <ArrowLeft size={18} /> Back
      </Link>
      <div className="glass-card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-purple-600 flex items-center justify-center text-2xl font-bold text-white">
            {ward.name?.charAt(0) || '?'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-purple-200">{ward.name}</h1>
            <p className="text-purple-300">
              {ward.relationship === 'PARENT' || !ward.relationship
                ? 'Your learner'
                : ward.relationship === 'CAREGIVER'
                  ? 'Learner you support as caregiver'
                  : ward.relationship === 'OLDER_SIBLING'
                    ? "Learner you support as older sibling"
                    : 'Your learner'}
            </p>
            {ward.sneType && ward.sneType !== 'NONE' && (
              <p className="text-purple-400 text-xs mt-0.5">Learning profile: {ward.sneType}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/5 p-4 rounded-lg text-center">
            <BookOpen size={20} className="text-blue-400 mx-auto mb-2" />
            <p className="text-purple-300 text-xs">Completed Lessons</p>
            <p className="text-xl font-bold text-purple-100">{ward.lessonsCompleted || 0}</p>
          </div>
          <div className="bg-white/5 p-4 rounded-lg text-center">
            <Calendar size={20} className="text-yellow-400 mx-auto mb-2" />
            <p className="text-purple-300 text-xs">Pending</p>
            <p className="text-xl font-bold text-purple-100">{ward.lessonsPending || 0}</p>
          </div>
          <div className="bg-white/5 p-4 rounded-lg text-center">
            <ClipboardCheck size={20} className="text-green-400 mx-auto mb-2" />
            <p className="text-purple-300 text-xs">Avg Score</p>
            <p className="text-xl font-bold text-purple-100">{ward.averageScore || 0}%</p>
          </div>
          <div className="bg-white/5 p-4 rounded-lg text-center">
            <TrendingUp size={20} className="text-purple-400 mx-auto mb-2" />
            <p className="text-purple-300 text-xs">Last Active</p>
            <p className="text-lg font-bold text-purple-100">{ward.lastActive ? new Date(ward.lastActive).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'N/A'}</p>
          </div>
        </div>

        {support?.summary && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-600/20 to-blue-600/10 border border-purple-300/20">
            <div className="flex items-center gap-2 mb-2">
              <HeartHandshake size={18} className="text-amber-300" />
              <h3 className="font-semibold text-purple-100">How {ward.name} is learning right now</h3>
            </div>
            <p className="text-purple-200 text-sm leading-relaxed">{support.summary}</p>
            {configuredByLabel && (
              <p className="text-xs text-purple-300/70 mt-2">Learning preferences set by: {configuredByLabel}</p>
            )}
          </div>
        )}

        {ward.recentQuizzes && ward.recentQuizzes.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-purple-200 mb-2">Recent Quizzes</h3>
            <div className="space-y-1">
              {ward.recentQuizzes.map((q, i) => (
                <div key={i} className="flex justify-between text-purple-300 text-sm">
                  <span>Lesson {q.lessonId ?? i + 1}</span>
                  <span>{q.score ?? 0}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {ward.progressHistory && ward.progressHistory.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-purple-200 mb-2">Progress History</h3>
            <div className="space-y-1">
              {ward.progressHistory.map((p, i) => (
                <div key={i} className="flex justify-between text-purple-300 text-sm">
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
