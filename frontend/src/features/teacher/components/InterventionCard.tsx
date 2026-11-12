'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, TextInput } from '@/components/ui';
import { teacherApi, teacherKeys, type Intervention } from '../api';

const humanize = (code: string) =>
  code
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());

/** One intervention; active ones can be closed with an outcome note. */
export function InterventionCard({
  intervention: iv,
  learnerName,
}: {
  intervention: Intervention;
  learnerName: string;
}) {
  const queryClient = useQueryClient();
  const [closing, setClosing] = useState(false);
  const [outcome, setOutcome] = useState('');
  const close = useMutation({
    mutationFn: (status: 'COMPLETED' | 'CANCELLED') =>
      teacherApi.closeIntervention(iv.id, status, outcome.trim() || undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teacherKeys.interventions }),
  });
  const active = iv.status === 'ACTIVE';

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-purple-100">
          {humanize(iv.type)} · {learnerName}
        </p>
        <Badge tone={active ? 'info' : iv.status === 'COMPLETED' ? 'success' : 'neutral'}>{humanize(iv.status)}</Badge>
      </div>
      <p className="mt-1 text-sm text-purple-300">{iv.target}</p>
      <p className="mt-1 text-xs text-purple-400">
        Start {iv.startDate}
        {iv.reviewDate ? ` · Review ${iv.reviewDate}` : ''}
      </p>
      {active &&
        (closing ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TextInput
              aria-label="Outcome (optional)"
              placeholder="What happened? (optional)"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="min-w-[14rem] flex-1 py-1.5 text-sm"
            />
            <Button size="sm" variant="success" loading={close.isPending} onClick={() => close.mutate('COMPLETED')}>
              Mark complete
            </Button>
            <Button size="sm" variant="secondary" disabled={close.isPending} onClick={() => close.mutate('CANCELLED')}>
              Cancel it
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setClosing(false)}>
              Back
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => setClosing(true)}>
            Close intervention
          </Button>
        ))}
      {close.isError && (
        <p className="mt-2 text-xs text-danger" role="alert">
          Could not update the intervention.
        </p>
      )}
    </Card>
  );
}
