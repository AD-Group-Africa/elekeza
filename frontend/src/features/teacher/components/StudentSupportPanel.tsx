'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, RefreshCw } from 'lucide-react';
import { getErrorMessage, getErrorStatus } from '@/lib/api';
import { MASTERY_ICON, MASTERY_LABEL, MASTERY_TONE_CLASS, masteryStateOf } from '@/features/learner';
import { teacherApi, teacherKeys } from '../api';

// One-line friendly render of the effective presentation values.
const PRESENTATION_LABELS: Record<string, (v: string) => string> = {
  density: (v) => ({ COMPACT: 'More at once', STANDARD: 'Balanced layout', SPACIOUS: 'Roomier layout' })[v] || v,
  explanationStyle: (v) =>
    ({
      CONCISE: 'Short and clear',
      STEP_BY_STEP: 'Step-by-step',
      EXAMPLE_FIRST: 'Examples first',
      DETAILED: 'Detailed',
    })[v] || v,
  exampleFrequency: (v) => ({ LOW: 'Few examples', MEDIUM: 'Some examples', HIGH: 'Plenty of examples' })[v] || v,
  textSize: (v) => ({ SMALL: 'Smaller text', MEDIUM: 'Standard text', LARGE: 'Larger text' })[v] || v,
  contrast: (v) => (v === 'HIGH' ? 'High contrast' : 'Standard contrast'),
  visualSupport: (v) => (v === 'true' ? 'Visual support' : ''),
  readAloud: (v) => (v === 'true' ? 'Listen button' : ''),
};

const SOURCE_LABEL: Record<string, string> = {
  EXPLICIT: 'The student',
  TEACHER: 'Teachers',
  GUARDIAN: 'Parent/guardian',
  SYSTEM: 'Standard defaults',
  OBSERVED: 'Learning signals',
};

const GUIDE_OPTIONS: { key: string; value: string; label: string }[] = [
  { key: 'explanationStyle', value: 'STEP_BY_STEP', label: 'Prefer step-by-step' },
  { key: 'explanationStyle', value: 'EXAMPLE_FIRST', label: 'Prefer examples first' },
  { key: 'density', value: 'SPACIOUS', label: 'Roomier layout' },
  { key: 'exampleFrequency', value: 'HIGH', label: 'More examples' },
];

const caption = 'mb-1 text-xs uppercase tracking-wide text-purple-300/80';

/**
 * How a learner is doing and what helps them: mastery evidence, preferred
 * presentation, and teacher guidance (which never overrides the learner's
 * own choices).
 */
export function StudentSupportPanel({ studentId }: { studentId: number }) {
  const queryClient = useQueryClient();
  const support = useQuery({
    queryKey: teacherKeys.support(studentId),
    queryFn: () => teacherApi.learningSupport(studentId),
  });
  // Mastery is non-fatal: the panel stays useful if it fails.
  const mastery = useQuery({
    queryKey: teacherKeys.mastery(studentId),
    queryFn: () => teacherApi.learnerMastery(studentId),
  });
  const [guideMsg, setGuideMsg] = useState('');

  const guide = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => teacherApi.applyGuidance(studentId, key, value),
    onSuccess: async (res) => {
      setGuideMsg(`Guidance saved (${res.source}). The student can still change it.`);
      await queryClient.invalidateQueries({ queryKey: teacherKeys.support(studentId) });
    },
    onError: (err) =>
      setGuideMsg(
        getErrorStatus(err) === 409
          ? 'This learner chose this preference themselves — respect their choice. Guidance was not applied.'
          : 'Could not apply that guidance.',
      ),
  });

  if (support.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-purple-300" role="status">
        <RefreshCw size={14} className="animate-spin" aria-hidden="true" /> Loading learning support…
      </p>
    );
  }
  if (support.isError || !support.data) {
    return (
      <p className="flex items-center gap-1 text-sm text-amber-300" role="alert">
        <Info size={14} aria-hidden="true" /> {getErrorMessage(support.error, 'Could not load learning support.')}
      </p>
    );
  }

  const summary = support.data;
  const rows = mastery.data ?? [];
  const presentation = Object.entries(summary.presentation || {})
    .map(([key, value]) => ({ key, label: (PRESENTATION_LABELS[key] || ((v: string) => v))(value) }))
    .filter((item) => item.label.length > 0);

  return (
    <div className="space-y-3 text-sm text-purple-200">
      {rows.length > 0 && (
        <div>
          <p className={caption}>Lesson mastery evidence</p>
          <ul className="space-y-1.5">
            {rows.map((row) => {
              const st = masteryStateOf(row.state);
              return (
                <li key={row.contentId} className="rounded-lg bg-white/5 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-purple-100">{row.title}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${MASTERY_TONE_CLASS[st]}`}>
                      <span aria-hidden="true">{MASTERY_ICON[st]} </span>
                      {MASTERY_LABEL[st]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-purple-400">
                    {row.attempts} attempt{row.attempts === 1 ? '' : 's'} · {row.reason}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <dl className="flex flex-wrap gap-6">
        <div>
          <dt className={caption}>Current mastery</dt>
          <dd className="text-lg font-semibold text-purple-100">{Math.round(summary.mastery || 0)}%</dd>
        </div>
        <div>
          <dt className={caption}>AI confidence</dt>
          <dd className="text-lg font-semibold text-purple-100">{summary.aiConfidence || 'Emerging'}</dd>
        </div>
        <div>
          <dt className={caption}>Profile set by</dt>
          <dd className="text-lg font-semibold text-purple-100">
            {(summary.profileSource || ['SYSTEM']).map((src) => SOURCE_LABEL[src] || src).join(', ')}
          </dd>
        </div>
      </dl>

      <div>
        <p className={caption}>Responds well to</p>
        {summary.respondsWellTo?.length ? (
          <div className="flex flex-wrap gap-2">
            {summary.respondsWellTo.map((item) => (
              <span key={item} className="rounded-full bg-green-600/30 px-2.5 py-1 text-xs text-green-200">
                ✓ {item}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-purple-300/70">Not enough evidence yet — keep teaching as usual.</p>
        )}
      </div>

      <div>
        <p className={caption}>Currently benefits from</p>
        {summary.currentlyBenefitsFrom?.length ? (
          <ul className="list-inside list-disc space-y-0.5 text-purple-300">
            {summary.currentlyBenefitsFrom.map((item, i) => (
              <li key={i}>
                {item.note}
                {item.lessonId ? ` (lesson ${item.lessonId})` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-purple-300/70">Nothing flagged — steady progress.</p>
        )}
      </div>

      {presentation.length > 0 && (
        <div>
          <p className={caption}>Preferred presentation</p>
          <div className="flex flex-wrap gap-2">
            {presentation.map(({ key, label }) => (
              <span key={key} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-purple-200">
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-purple-300/10 pt-2">
        <p className={caption}>Add your guidance</p>
        <div className="flex flex-wrap gap-2">
          {GUIDE_OPTIONS.map((option) => (
            <button
              key={option.key + option.value}
              type="button"
              disabled={guide.isPending}
              onClick={() => {
                setGuideMsg('');
                guide.mutate(option);
              }}
              className="rounded-lg border border-purple-300/20 bg-white/5 px-3 py-1.5 text-xs text-purple-200 hover:bg-white/10 disabled:opacity-50"
            >
              {option.label}
            </button>
          ))}
        </div>
        {guideMsg && (
          <p className="mt-2 text-xs text-amber-200" role="status">
            {guideMsg}
          </p>
        )}
        <p className="mt-2 text-[11px] text-purple-300/60">
          If a student chose a preference themselves, their choice always wins — Elekeza never overrides the learner.
        </p>
      </div>
    </div>
  );
}
