'use client';

/**
 * Guardian Daily Digest — one calm snapshot of the ward's day, composed
 * server-side from real records. Plain, encouraging language; no diagnosis,
 * no comparison with other learners. Sections: Learning, Attendance,
 * Classwork, Fees.
 */

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { BookOpen, CalendarCheck, NotebookPen, Wallet, Info } from 'lucide-react';

interface DigestData {
  learnerName?: string;
  learning?: { lessonsCompleted?: number; lessonsPending?: number; averageScore?: number | null };
  attendance?: { rate?: number | null; sessionsMarked?: number; today?: string | null };
  classwork?: {
    dueSoon?: Array<{ id: number; title: string; dueDate: string; submitted: boolean }>;
    missing?: Array<{ id: number; title: string; dueDate: string }>;
    recentFeedback?: Array<{ title: string; score: number | null; points: number; feedback: string | null }>;
  };
  fees?: { outstanding?: number };
}

const money = (v: number) =>
  `KES ${v.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

export default function DailyDigest({ wardId }: { wardId: string | number }) {
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    // Standard axios client: cookie auth, CSRF handling, 401-refresh retry —
    // same contract as every other API call in the app.
    api
      .get(`/guardian/wards/${wardId}/digest`)
      .then((res) => { if (live) setDigest(res.data); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [wardId]);

  if (failed) {
    return (
      <section aria-label="Daily summary" className="glass-card p-5">
        <p className="text-sm opacity-70">Could not load today's summary. Please refresh to try again.</p>
      </section>
    );
  }
  if (!digest) {
    return (
      <section aria-label="Daily summary" className="glass-card p-5">
        <p className="text-sm opacity-70 animate-pulse">Loading today's summary…</p>
      </section>
    );
  }

  const learning = digest.learning ?? {};
  const attendance = digest.attendance ?? {};
  const classwork = digest.classwork ?? {};
  const dueSoon = classwork.dueSoon ?? [];
  const missing = classwork.missing ?? [];
  const feedback = classwork.recentFeedback ?? [];
  const outstanding = digest.fees?.outstanding ?? 0;

  const todayLabel: Record<string, string> = {
    PRESENT: 'Marked present today ✓',
    LATE: 'Arrived late today',
    ABSENT: 'Absent today',
    EXCUSED: 'Excused absence today',
  };

  return (
    <section aria-label="Daily summary" className="glass-card p-5 space-y-4">
      <header>
        <h2 className="text-lg font-semibold flex items-center gap-2"><Info size={18} /> Today at a glance</h2>
        <p className="text-sm opacity-70">A calm daily summary for {digest.learnerName ?? 'your learner'}.</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg bg-white/5 p-3">
          <p className="flex items-center gap-1.5 text-xs opacity-75"><BookOpen size={14} /> Lessons done</p>
          <p className="text-xl font-bold">{learning.lessonsCompleted ?? 0}</p>
          <p className="text-xs opacity-60">{learning.lessonsPending ?? 0} still to go</p>
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <p className="flex items-center gap-1.5 text-xs opacity-75"><CalendarCheck size={14} /> Attendance</p>
          <p className="text-xl font-bold">{attendance.rate != null ? `${attendance.rate}%` : '—'}</p>
          <p className="text-xs opacity-60">
            {attendance.today ? todayLabel[attendance.today] ?? attendance.today : `${attendance.sessionsMarked ?? 0} days recorded`}
          </p>
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <p className="flex items-center gap-1.5 text-xs opacity-75"><NotebookPen size={14} /> Classwork</p>
          <p className="text-xl font-bold">{dueSoon.filter((d) => !d.submitted).length + missing.length}</p>
          <p className="text-xs opacity-60">to attend to</p>
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <p className="flex items-center gap-1.5 text-xs opacity-75"><Wallet size={14} /> Fees balance</p>
          <p className="text-xl font-bold">{money(outstanding)}</p>
          <p className="text-xs opacity-60">{outstanding > 0 ? 'outstanding' : 'all clear'}</p>
        </div>
      </div>

      {(dueSoon.length > 0 || missing.length > 0) && (
        <div>
          <h3 className="text-sm font-semibold mb-1">Coming up</h3>
          <ul className="text-sm space-y-1">
            {missing.map((m) => (
              <li key={`m-${m.id}`}>
                <span className="rounded-full border border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:border-rose-700 px-2 py-0.5 text-xs font-medium mr-2">Past due</span>
                {m.title} <span className="opacity-60">(was due {m.dueDate})</span>
              </li>
            ))}
            {dueSoon.filter((d) => !d.submitted).map((d) => (
              <li key={`d-${d.id}`}>
                <span className="rounded-full border border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 px-2 py-0.5 text-xs font-medium mr-2">Due {d.dueDate}</span>
                {d.title}
              </li>
            ))}
            {dueSoon.filter((d) => d.submitted).map((d) => (
              <li key={`s-${d.id}`} className="opacity-70">
                <span className="rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 px-2 py-0.5 text-xs font-medium mr-2">Done ✓</span>
                {d.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-1">Teacher feedback</h3>
          <ul className="text-sm space-y-1">
            {feedback.map((f, i) => (
              <li key={i}>
                <span className="font-medium">{f.title}:</span> {f.score}/{f.points}
                {f.feedback ? ` — “${f.feedback}”` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
