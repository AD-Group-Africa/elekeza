'use client';

/**
 * Class timetable — teacher/school-admin tool, fully persisted.
 *
 * Every edit is saved through POST /api/timetable/slot (per-slot upsert with
 * server-side teacher-conflict detection) and re-read from the server, so the
 * timetable survives refreshes and is shared across the school. Clearing a
 * subject deletes the slot.
 */

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import { attendanceAPI, type ClassInfo } from '@/lib/api';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday', FRIDAY: 'Friday',
};
const PERIODS = ['8:00-8:40', '8:40-9:20', '9:20-10:00', '10:20-11:00', '11:00-11:40', '11:40-12:20', '13:00-13:40', '13:40-14:20'];

interface Slot { dayOfWeek: string; period: number; subject: string }

type Grid = Record<string, Record<number, string>>; // day -> period(1-based) -> subject

export default function TimetablePage() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [grid, setGrid] = useState<Grid>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // `${day}-${period}` being saved
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let live = true;
    attendanceAPI.classes()
      .then(res => {
        if (!live) return;
        setClasses(res.data);
        if (res.data.length > 0) setClassId(res.data[0].id);
      })
      .catch(() => { if (live) setError('Could not load classes. Please refresh to try again.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const loadTimetable = useCallback(async (cid: number) => {
    setError('');
    try {
      const res = await api.get<Slot[]>(`/timetable/${cid}`);
      const next: Grid = {};
      for (const slot of res.data) {
        next[slot.dayOfWeek] = { ...(next[slot.dayOfWeek] ?? {}), [slot.period]: slot.subject };
      }
      setGrid(next);
    } catch {
      setError('Could not load the timetable. Please refresh to try again.');
    }
  }, []);

  useEffect(() => {
    if (classId != null) void loadTimetable(classId);
  }, [classId, loadTimetable]);

  const saveSlot = async (day: string, periodIndex: number, subject: string) => {
    if (classId == null) return;
    const key = `${day}-${periodIndex}`;
    setSaving(key);
    setError('');
    setNotice('');
    try {
      if (subject.trim() === '') {
        await api.delete(`/timetable/${classId}/${day}/${periodIndex}`);
        setGrid(prev => {
          const next = { ...prev, [day]: { ...(prev[day] ?? {}) } };
          delete next[day][periodIndex];
          return next;
        });
        setNotice('Slot cleared.');
      } else {
        await api.post('/timetable/slot', { classId, day, period: periodIndex, subject: subject.trim() });
        setGrid(prev => ({ ...prev, [day]: { ...(prev[day] ?? {}), [periodIndex]: subject.trim() } }));
        setNotice('Saved.');
      }
    } catch (err) {
      const payload = err as { response?: { data?: { message?: string } } };
      setError(payload?.response?.data?.message ?? 'Could not save the slot. Please try again.');
      // Re-sync from the server so the grid reflects the truth.
      await loadTimetable(classId);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-purple-200">Class Timetable</h1>
        <div>
          <label htmlFor="timetable-class" className="sr-only">Class</label>
          <select
            id="timetable-class"
            value={classId ?? ''}
            onChange={(e) => setClassId(Number(e.target.value))}
            className="px-3 py-2 bg-white/10 border border-purple-300/30 rounded-lg text-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
      {notice && <p className="text-purple-300 text-sm" role="status">{notice}</p>}

      {loading ? (
        <p className="text-purple-300 animate-pulse" role="status">Loading timetable…</p>
      ) : (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-purple-200 text-sm">
            <thead>
              <tr className="border-b border-purple-300/20">
                <th className="p-2 text-left">Time</th>
                {DAYS.map(day => (
                  <th key={day} className="p-2 text-left">{DAY_LABELS[day]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((label, i) => (
                <tr key={label} className="border-b border-purple-300/10">
                  <td className="p-2 text-purple-300 whitespace-nowrap">{label}</td>
                  {DAYS.map(day => {
                    const key = `${day}-${i + 1}`;
                    return (
                      <td key={day} className="p-1">
                        <input
                          type="text"
                          defaultValue={grid[day]?.[i + 1] ?? ''}
                          onBlur={(e) => {
                            const current = grid[day]?.[i + 1] ?? '';
                            if (e.target.value.trim() !== current) void saveSlot(day, i + 1, e.target.value);
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          disabled={saving === key}
                          aria-label={`${DAY_LABELS[day]} ${label}`}
                          className="w-full bg-white/10 border border-purple-300/20 rounded p-1 text-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                          placeholder="Subject"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-purple-300 text-sm">
        Edit a subject and click away (or press Enter) to save. Clear a subject to free the slot.
        If a teacher is already booked in that period for another class, the school is told before the change is kept.
      </p>
    </div>
  );
}
