'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/axios';
import { ArrowLeft, BookOpen, ClipboardCheck, TrendingUp, Calendar } from 'lucide-react';
import Link from 'next/link';

interface WardData {
  name?: string;
  sneType?: string;
  lessonsCompleted?: number;
  lessonsPending?: number;
  averageScore?: number;
  lastActive?: string;
  recentQuizzes?: { lessonId?: number; score?: number; date?: string }[];
  progressHistory?: { date?: string; score?: number }[];
}

export default function WardDetail() {
  const { id } = useParams();
  const [ward, setWard] = useState<WardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/guardian/wards/' + id)
      .then(res => setWard(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-6 text-purple-200">Loading…</div>;

  if (!ward) return <div className="p-6 text-red-400">Ward not found.</div>;

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
            <p className="text-purple-300">{ward.sneType || 'No SNE profile'}</p>
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
            <p className="text-lg font-bold text-purple-100">{ward.lastActive || 'N/A'}</p>
          </div>
        </div>

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