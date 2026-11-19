'use client';

/**
 * Class timetable — teacher/school-admin tool, fully persisted.
 *
 * Every edit is saved per slot (with server-side teacher-conflict detection)
 * and re-read from the server, so the timetable survives refreshes and is
 * shared across the school. Clearing a subject deletes the slot.
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Card, LoadingState, PageHeader, Select } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { useClasses } from '@/features/attendance/api';
import { teacherApi, teacherKeys, type TimetableSlot } from '../api';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;
const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
};
const PERIODS = [
  '8:00-8:40',
  '8:40-9:20',
  '9:20-10:00',
  '10:20-11:00',
  '11:00-11:40',
  '11:40-12:20',
  '13:00-13:40',
  '13:40-14:20',
];

/** day -> period (1-based) -> subject */
type Grid = Record<string, Record<number, string>>;

function toGrid(slots: TimetableSlot[]): Grid {
  const grid: Grid = {};
  for (const slot of slots) grid[slot.dayOfWeek] = { ...(grid[slot.dayOfWeek] ?? {}), [slot.period]: slot.subject };
  return grid;
}

export default function TimetableScreen() {
  const queryClient = useQueryClient();
  const classesQuery = useClasses();
  const classes = classesQuery.data ?? [];
  const [chosenClassId, setChosenClassId] = useState<number | null>(null);
  const classId = chosenClassId ?? classes[0]?.id ?? null;
  const [saving, setSaving] = useState<string | null>(null); // `${day}-${period}` being saved
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const timetable = useQuery({
    queryKey: teacherKeys.timetable(classId ?? 0),
    queryFn: () => teacherApi.timetable(classId!),
    enabled: classId != null,
    select: toGrid,
  });
  const grid = timetable.data ?? {};

  const saveSlot = async (day: string, period: number, subject: string) => {
    if (classId == null) return;
    const key = `${day}-${period}`;
    setSaving(key);
    setError('');
    setNotice('');
    try {
      if (subject.trim() === '') {
        await teacherApi.clearSlot(classId, day, period);
        setNotice('Slot cleared.');
      } else {
        await teacherApi.saveSlot(classId, day, period, subject.trim());
        setNotice('Saved.');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save the slot. Please try again.'));
    } finally {
      // Re-sync from the server so the grid always reflects the truth.
      await queryClient.invalidateQueries({ queryKey: teacherKeys.timetable(classId) });
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Class Timetable"
        actions={
          <Select
            aria-label="Class"
            value={classId ?? ''}
            onChange={(e) => setChosenClassId(Number(e.target.value))}
            className="w-auto"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        }
      />

      {classesQuery.isError && <Alert tone="error">Could not load classes. Please refresh to try again.</Alert>}
      {timetable.isError && <Alert tone="error">Could not load the timetable. Please refresh to try again.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {classesQuery.isLoading || timetable.isLoading ? (
        <LoadingState label="Loading timetable…" />
      ) : (
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full text-sm text-purple-200">
            <thead>
              <tr className="border-b border-purple-300/20">
                <th scope="col" className="p-2 text-left">
                  Time
                </th>
                {DAYS.map((day) => (
                  <th key={day} scope="col" className="p-2 text-left">
                    {DAY_LABELS[day]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((label, i) => (
                <tr key={label} className="border-b border-purple-300/10">
                  <th scope="row" className="whitespace-nowrap p-2 text-left font-normal text-purple-300">
                    {label}
                  </th>
                  {DAYS.map((day) => {
                    const period = i + 1;
                    const saved = grid[day]?.[period] ?? '';
                    return (
                      <td key={day} className="p-1">
                        <input
                          // Uncontrolled cell: re-mount whenever the class or the
                          // saved value changes, so it never shows stale text.
                          key={`${classId}-${day}-${period}-${saved}`}
                          type="text"
                          defaultValue={saved}
                          onBlur={(e) => {
                            if (e.target.value.trim() !== saved) void saveSlot(day, period, e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          disabled={saving === `${day}-${period}`}
                          aria-label={`${DAY_LABELS[day]} ${label}`}
                          className="w-full rounded border border-purple-300/20 bg-white/10 p-1 text-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                          placeholder="Subject"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="text-sm text-purple-300">
        Edit a subject and click away (or press Enter) to save. Clear a subject to free the slot. If a teacher is
        already booked in that period for another class, the school is told before the change is kept.
      </p>
    </div>
  );
}
