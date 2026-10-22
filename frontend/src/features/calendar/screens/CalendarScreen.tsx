'use client';

/** School calendar: upcoming exams, due dates and events. Staff can add and remove their own. */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Field, LoadingState, PageHeader, Select, TextInput } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { getErrorMessage } from '@/lib/api';
import { isStaff } from '@/lib/roles';
import { DEADLINE_TYPE_LABEL, calendarApi, calendarKeys, upcoming, useDeadlines, type DeadlineType } from '../api';
import { DeadlineList } from '../components/DeadlineList';

const TYPES = Object.entries(DEADLINE_TYPE_LABEL) as Array<[DeadlineType, string]>;

export default function CalendarScreen() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const staff = isStaff(user?.role);
  const deadlines = useDeadlines();
  const [showPast, setShowPast] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<DeadlineType>('SCHOOL_EVENT');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('08:00');
  const [description, setDescription] = useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: calendarKeys.list });

  const create = useMutation({
    mutationFn: () =>
      calendarApi.create({
        title: title.trim(),
        deadlineType: type,
        dueAt: new Date(`${date}T${time || '08:00'}`).toISOString(),
        description: description.trim() || undefined,
      }),
    onSuccess: async () => {
      setMessage({ tone: 'success', text: `“${title.trim()}” added to the calendar.` });
      setTitle('');
      setDescription('');
      await refresh();
    },
    onError: (err) => setMessage({ tone: 'error', text: getErrorMessage(err, 'Could not add the date.') }),
  });

  const remove = useMutation({
    mutationFn: calendarApi.remove,
    onSuccess: async () => {
      setMessage({ tone: 'success', text: 'Removed from the calendar.' });
      await refresh();
    },
    onError: () => setMessage({ tone: 'error', text: 'Could not remove it.' }),
  });

  const all = deadlines.data ?? [];
  const list = showPast ? all : upcoming(all);

  return (
    <div className="space-y-6">
      <PageHeader title="School calendar" description="Exams, due dates and school events." />
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      <div className={staff ? 'grid items-start gap-6 lg:grid-cols-[22rem_1fr]' : ''}>
        {staff && (
          <Card title="Add a date">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setMessage(null);
                if (!date) return setMessage({ tone: 'error', text: 'Choose a date.' });
                create.mutate();
              }}
            >
              <Field id="cal-title" label="Title">
                <TextInput
                  id="cal-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Term 1 mid-term exams"
                  required
                />
              </Field>
              <Field id="cal-type" label="Type">
                <Select id="cal-type" value={type} onChange={(e) => setType(e.target.value as DeadlineType)}>
                  {TYPES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id="cal-date" label="Date">
                  <TextInput
                    id="cal-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </Field>
                <Field id="cal-time" label="Time">
                  <TextInput id="cal-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </Field>
              </div>
              <Field id="cal-desc" label="Details (optional)">
                <TextInput id="cal-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
              <Button type="submit" className="w-full" loading={create.isPending}>
                Add to calendar
              </Button>
            </form>
          </Card>
        )}

        <Card
          title={showPast ? 'All dates' : 'Coming up'}
          actions={
            <label className="flex items-center gap-2 text-xs text-purple-300">
              <input
                type="checkbox"
                checked={showPast}
                onChange={(e) => setShowPast(e.target.checked)}
                className="h-4 w-4"
              />
              Show past dates
            </label>
          }
        >
          {deadlines.isLoading ? (
            <LoadingState />
          ) : (
            <DeadlineList
              deadlines={list}
              empty={staff ? 'Nothing scheduled yet — add the first date.' : 'Nothing scheduled.'}
              canDelete={(d) => user?.role === 'ADMIN' || d.createdBy === user?.learnerId}
              onDelete={(d) => remove.mutate(d.id)}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
