'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle } from 'lucide-react';

/**
 * Institutional engagement summary for school administrators.
 * Backed by the real telemetry pipeline: GET /api/engagement/institutions/{id}/summary
 * (SCHOOL_ADMIN is tenant-checked server-side). Shows a transparent empty
 * state before the pilot produces data — never fabricated numbers.
 */
interface EngagementSummary {
  institutionId: number;
  windowDays: number;
  totalEvents: number;
  activeUsers: number;
  lessonsStarted: number;
  lessonsCompleted: number;
  quizzesCompleted: number;
  assignmentsSubmitted: number;
  examsSubmitted: number;
  tutorInteractions: number;
  accessibilityFeatureUses: number;
}

export default function AdminEngagementPage() {
  const { user } = useAuth();
  const institutionId = user?.institutionId;
  const [summary, setSummary] = useState<EngagementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!institutionId) {
      setError('Engagement data is not available for your account.');
      setLoading(false);
      return;
    }
    api.get(`/engagement/institutions/${institutionId}/summary?days=30`)
      .then(res => setSummary(res.data))
      .catch(() => setError('Engagement data is not available for your account.'))
      .finally(() => setLoading(false));
  }, [institutionId]);

  if (loading) return <p className="text-purple-200 p-6">Loading engagement data…</p>;

  if (error || !summary) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-purple-200">Engagement</h1>
        <div className="glass-card p-6 flex items-start gap-3">
          <AlertTriangle size={20} className="text-purple-300 mt-1" />
          <div>
            <p className="text-purple-200">{error || 'No engagement data yet.'}</p>
            <Link href="/admin" className="text-purple-300 underline text-sm mt-2 inline-block">Back to dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  const rows: Array<{ label: string; value: number }> = [
    { label: 'Active learners/staff (30d)', value: summary.activeUsers },
    { label: 'Lessons started', value: summary.lessonsStarted },
    { label: 'Lessons completed', value: summary.lessonsCompleted },
    { label: 'Quizzes completed', value: summary.quizzesCompleted },
    { label: 'Assignments submitted', value: summary.assignmentsSubmitted },
    { label: 'Exams submitted', value: summary.examsSubmitted },
    { label: 'AI Tutor interactions', value: summary.tutorInteractions },
    { label: 'Accessibility feature uses', value: summary.accessibilityFeatureUses },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-purple-200">Engagement — last {summary.windowDays} days</h1>
        <p className="text-purple-300 text-sm mt-1">{summary.totalEvents} recorded events</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {rows.map(r => (
          <div key={r.label} className="glass-card p-4">
            <p className="text-3xl font-bold text-white">{r.value}</p>
            <p className="text-purple-300 text-xs mt-1">{r.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
