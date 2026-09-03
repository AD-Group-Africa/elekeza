'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { User, TrendingUp, BookOpen, Calendar, MessageSquare, Award } from 'lucide-react';
import Link from 'next/link';

interface ChildRow {
  id: number;
  name?: string;
  sneType?: string;
  grade?: string;
  lessonsCompleted?: number;
  lessonsPending?: number;
  averageScore?: number;
  lastActive?: string;
}

export default function GuardianDashboard() {
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/guardian/wards')
      .then(res => setChildren(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-purple-200 animate-pulse">Loading your children&apos;s progress…</div>;

  if (children.length === 0) {
    return (
      <div className="glass-card p-6 text-center max-w-md mx-auto mt-10">
        <User size={48} className="text-purple-400 mx-auto mb-4" />
        <p className="text-purple-200">No linked children yet.</p>
        <p className="text-purple-300 text-sm mt-2">Contact your school to link your child&apos;s account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-purple-200">Parent Dashboard</h1>

      {/* Child Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {children.map(child => (
          <Link
            key={child.id}
            href={'/guardian/wards/' + child.id}
            className="glass-card px-4 py-2 rounded-full text-purple-200 hover:bg-white/10 transition whitespace-nowrap"
          >
            {child.name}
          </Link>
        ))}
      </div>

      {/* Child Cards */}
      {children.map(child => (
        <div key={child.id} className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-purple-600 flex items-center justify-center text-lg font-bold text-white">
              {child.name?.charAt(0) || '?'}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-purple-200">{child.name}</h2>
              <p className="text-purple-300 text-sm">{child.sneType || 'No SNE profile'} · Grade {child.grade || 'N/A'}</p>
            </div>
            <Link
              href={'/guardian/wards/' + child.id}
              className="ml-auto text-purple-300 hover:text-white text-sm underline"
            >
              View Details
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 p-3 rounded-lg text-center">
              <BookOpen size={20} className="text-blue-400 mx-auto mb-1" />
              <p className="text-purple-300 text-xs">Completed</p>
              <p className="text-lg font-bold text-purple-100">{child.lessonsCompleted || 0}</p>
            </div>
            <div className="bg-white/5 p-3 rounded-lg text-center">
              <Calendar size={20} className="text-green-400 mx-auto mb-1" />
              <p className="text-purple-300 text-xs">Pending</p>
              <p className="text-lg font-bold text-purple-100">{child.lessonsPending || 0}</p>
            </div>
            <div className="bg-white/5 p-3 rounded-lg text-center">
              <TrendingUp size={20} className="text-purple-400 mx-auto mb-1" />
              <p className="text-purple-300 text-xs">Avg Score</p>
              <p className="text-lg font-bold text-purple-100">{child.averageScore || 0}%</p>
            </div>
            <div className="bg-white/5 p-3 rounded-lg text-center">
              <Award size={20} className="text-yellow-400 mx-auto mb-1" />
              <p className="text-purple-300 text-xs">Last Active</p>
              <p className="text-lg font-bold text-purple-100">{child.lastActive || 'N/A'}</p>
            </div>
          </div>

          {/* Teacher Notes */}
          <div className="bg-purple-600/10 border border-purple-500/20 p-3 rounded-lg">
            <p className="text-purple-300 text-sm flex items-center gap-1">
              <MessageSquare size={14} /> Teacher note: Great improvement this week! Keep practicing fractions.
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}