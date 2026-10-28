'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, Plus, X } from 'lucide-react';
import { Alert, Button, Card, Field, LoadingState, PageHeader, Select, TextInput } from '@/components/ui';
import { teacherApi, teacherKeys, type NewIntervention } from '../api';

const today = () => new Date().toISOString().slice(0, 10);
const INTERVENTION_TYPES = [
  ['EXTRA_PRACTICE', 'Extra practice'],
  ['REVIEW_SESSION', 'Review session'],
  ['PEER_SUPPORT', 'Peer support'],
  ['PARENT_CONTACT', 'Parent contact'],
  ['OTHER', 'Other'],
] as const;
const humanize = (code: string) =>
  code
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

const emptyForm = () => ({ learnerId: '', type: 'EXTRA_PRACTICE', target: '', startDate: today(), reviewDate: '' });

/** Learners who may need support (never a diagnosis) and the actions taken. */
export default function SupportSignalsScreen() {
  const queryClient = useQueryClient();
  const signals = useQuery({ queryKey: teacherKeys.signals, queryFn: teacherApi.supportSignals });
  const interventions = useQuery({ queryKey: teacherKeys.interventions, queryFn: teacherApi.interventions });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // One entry per learner (a learner can have several open signals).
  const learners = Array.from(new Map((signals.data ?? []).map((s) => [s.learnerId, s.learnerName])).entries());
  const learnerName = (id: number) => learners.find(([lid]) => lid === id)?.[1] ?? `Learner #${id}`;

  const act = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'acknowledge' | 'dismiss' }) =>
      teacherApi.actOnSignal(id, action),
    onSuccess: async (_res, { action }) => {
      setMessage({ tone: 'success', text: action === 'acknowledge' ? 'Signal acknowledged.' : 'Signal dismissed.' });
      await queryClient.invalidateQueries({ queryKey: teacherKeys.signals });
    },
    onError: () => setMessage({ tone: 'error', text: 'Action failed.' }),
  });

  const create = useMutation({
    mutationFn: (payload: NewIntervention) => teacherApi.createIntervention(payload),
    onSuccess: async () => {
      setMessage({ tone: 'success', text: 'Intervention created.' });
      setShowForm(false);
      setForm(emptyForm());
      await queryClient.invalidateQueries({ queryKey: teacherKeys.interventions });
    },
    onError: () => setMessage({ tone: 'error', text: 'Failed to create intervention.' }),
  });

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.learnerId || !form.target.trim()) {
      setMessage({ tone: 'error', text: 'Select a learner and describe the support action.' });
      return;
    }
    setMessage(null);
    create.mutate({
      learnerId: Number(form.learnerId),
      type: form.type,
      target: form.target,
      startDate: form.startDate,
      reviewDate: form.reviewDate || null,
    });
  };

  const signalList = signals.data ?? [];
  const interventionList = interventions.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Signals"
        description="Potential support required — review and act, never a final diagnosis."
        actions={
          <Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => setShowForm((s) => !s)}>
            Create Intervention
          </Button>
        }
      />

      {signals.isError && <Alert tone="error">Could not load support signals. Please refresh to try again.</Alert>}
      {message && <Alert tone={message.tone}>{message.text}</Alert>}

      {showForm && (
        <Card title="New Intervention">
          <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-2">
            <Field id="iv-learner" label="Learner">
              <Select
                id="iv-learner"
                value={form.learnerId}
                onChange={(e) => setForm({ ...form, learnerId: e.target.value })}
              >
                <option value="">Select learner…</option>
                {learners.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="iv-type" label="Support type">
              <Select id="iv-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {INTERVENTION_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="iv-target" label="Support action" className="sm:col-span-2">
              <TextInput
                id="iv-target"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                placeholder="e.g. weekly review of the water-cycle strand with an extra practice quiz"
              />
            </Field>
            <Field id="iv-start" label="Start date">
              <TextInput
                id="iv-start"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </Field>
            <Field id="iv-review" label="Review date (optional)">
              <TextInput
                id="iv-review"
                type="date"
                value={form.reviewDate}
                onChange={(e) => setForm({ ...form, reviewDate: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" loading={create.isPending}>
                Save Intervention
              </Button>
            </div>
          </form>
        </Card>
      )}

      {signals.isLoading ? (
        <LoadingState />
      ) : signalList.length === 0 ? (
        <Card padding="lg" className="text-center text-purple-300">
          No open support signals. Signals are generated from learning data (low scores, declining performance, repeated
          failures, inactivity).
        </Card>
      ) : (
        <ul className="space-y-3">
          {signalList.map((s) => (
            <li key={s.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="mt-1 text-yellow-400" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-purple-100">{s.learnerName}</p>
                      <p className="text-xs text-purple-300">
                        {humanize(s.signalType)} · {humanize(s.status)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Check size={14} aria-hidden="true" />}
                      onClick={() => act.mutate({ id: s.id, action: 'acknowledge' })}
                    >
                      Acknowledge
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<X size={14} aria-hidden="true" />}
                      onClick={() => act.mutate({ id: s.id, action: 'dismiss' })}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
                <div className="mt-3 pl-8">
                  <p className="text-sm text-purple-300">Why:</p>
                  <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-purple-200">
                    {s.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {interventionList.length > 0 && (
        <section aria-labelledby="interventions-heading" className="space-y-3">
          <h2 id="interventions-heading" className="pt-2 text-lg font-semibold text-purple-200">
            Interventions
          </h2>
          {interventionList.map((iv) => (
            <Card key={iv.id}>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-purple-100">
                  {humanize(iv.type)} · {learnerName(iv.learnerId)}
                </p>
                <span className="text-xs text-purple-300">{humanize(iv.status)}</span>
              </div>
              <p className="mt-1 text-sm text-purple-300">{iv.target}</p>
              <p className="mt-1 text-xs text-purple-400">
                Start {iv.startDate}
                {iv.reviewDate ? ` · Review ${iv.reviewDate}` : ''}
              </p>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
