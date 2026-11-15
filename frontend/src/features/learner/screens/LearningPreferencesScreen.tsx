'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlignLeft, Check, Contrast, Eye, Lightbulb, MessageSquareText, Sparkles, Type, Volume2 } from 'lucide-react';
import { Alert, Card, LoadingState, Switch } from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { learnerApi, learnerKeys, useLearnerPreferences, type PreferenceMap } from '../api';

type Icon = React.ComponentType<{ size?: number; className?: string }>;

const SOURCE_LABEL: Record<string, string> = {
  EXPLICIT: 'Chosen by you',
  TEACHER: 'Set by your teacher',
  GUARDIAN: 'Set by your parent or guardian',
  OBSERVED: 'Suggested from how you learn',
  SYSTEM: 'Standard setting',
};

interface ChoiceGroup {
  key: string;
  title: string;
  description: string;
  icon: Icon;
  choices: { value: string; label: string; hint?: string }[];
}

// Keys the backend exposes with enum values; the UI labels are plain English
// (no accessibility jargon forced on learners).
const GROUPS: ChoiceGroup[] = [
  {
    key: 'density',
    title: 'How much on each screen',
    description: 'Choose how much content you see at once.',
    icon: AlignLeft,
    choices: [
      { value: 'COMPACT', label: 'More at once', hint: 'Fits more on the screen' },
      { value: 'STANDARD', label: 'Balanced', hint: 'The standard layout' },
      { value: 'SPACIOUS', label: 'Roomier', hint: 'One idea at a time, with space to breathe' },
    ],
  },
  {
    key: 'textSize',
    title: 'Text size',
    description: 'Pick the size that is easiest for you to read.',
    icon: Type,
    choices: [
      { value: 'SMALL', label: 'Smaller', hint: 'More text on screen' },
      { value: 'MEDIUM', label: 'Standard', hint: 'The usual size' },
      { value: 'LARGE', label: 'Larger', hint: 'Bigger, easier-to-read text' },
    ],
  },
  {
    key: 'contrast',
    title: 'Screen contrast',
    description: 'Make words stand out more from the background.',
    icon: Contrast,
    choices: [
      { value: 'STANDARD', label: 'Standard', hint: 'The usual look' },
      { value: 'HIGH', label: 'High contrast', hint: 'Stronger difference between text and background' },
    ],
  },
  {
    key: 'explanationStyle',
    title: 'How explanations are written',
    description: 'Lessons can be shown in the way you understand best.',
    icon: MessageSquareText,
    choices: [
      { value: 'CONCISE', label: 'Short and clear', hint: 'Straight to the point' },
      { value: 'STEP_BY_STEP', label: 'Step by step', hint: 'One small step at a time' },
      { value: 'EXAMPLE_FIRST', label: 'Examples first', hint: 'See an example before the rule' },
      { value: 'DETAILED', label: 'Detailed', hint: 'Fuller explanations, going deeper' },
    ],
  },
  {
    key: 'exampleFrequency',
    title: 'Examples',
    description: 'How many worked examples you would like.',
    icon: Lightbulb,
    choices: [
      { value: 'LOW', label: 'A few', hint: 'Just enough to get going' },
      { value: 'MEDIUM', label: 'Some', hint: 'A comfortable number' },
      { value: 'HIGH', label: 'Plenty', hint: 'An example after every idea' },
    ],
  },
];

const TOGGLES: {
  key: 'visualSupport' | 'readAloud';
  title: string;
  description: string;
  icon: Icon;
  whenOn: string;
}[] = [
  {
    key: 'visualSupport',
    title: 'Visual support',
    description: 'Show ideas with pictures, diagrams and structure.',
    icon: Eye,
    whenOn: 'Lessons use visual structure and emphasis.',
  },
  {
    key: 'readAloud',
    title: 'Listen to lessons',
    description: 'Offer a “Listen” button that reads the lesson aloud.',
    icon: Volume2,
    whenOn: 'Lessons can be read aloud to you.',
  },
];

function ChoiceButtons({
  group,
  current,
  disabled,
  onChoose,
}: {
  group: ChoiceGroup;
  current?: string;
  disabled: boolean;
  onChoose: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={group.title}>
      {group.choices.map((choice) => {
        const active = current === choice.value;
        return (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChoose(choice.value)}
            disabled={disabled}
            className={cn(
              'rounded-xl border px-4 py-2 text-left text-sm transition',
              active
                ? 'border-purple-400 bg-purple-600/60 font-medium text-white'
                : 'border-purple-300/10 bg-white/5 text-purple-200 hover:bg-white/10',
            )}
          >
            <span className="block">{choice.label}</span>
            {choice.hint && (
              <span className={cn('block text-xs', active ? 'text-purple-100' : 'text-purple-300/70')}>
                {choice.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function LearningPreferencesScreen() {
  const queryClient = useQueryClient();
  const prefsQuery = useLearnerPreferences();
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => learnerApi.setPreference(key, value),
    onSuccess: (effective, { key }) => {
      queryClient.setQueryData<PreferenceMap>(learnerKeys.preferences, effective);
      setSavedKey(key);
      window.setTimeout(() => setSavedKey(null), 1600);
    },
  });

  if (prefsQuery.isLoading) return <LoadingState label="Loading your learning preferences…" />;
  if (!prefsQuery.data) return <Alert tone="error">Could not load your learning preferences.</Alert>;

  const prefs = prefsQuery.data;
  const sourceOf = (key: string) => SOURCE_LABEL[prefs[key]?.source || 'SYSTEM'] ?? SOURCE_LABEL.SYSTEM;
  const choose = (key: string, value: string) => save.mutate({ key, value });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <div className="flex items-center gap-2 text-purple-300">
          <Sparkles size={20} className="text-amber-300" aria-hidden="true" />
          <span className="text-sm font-medium uppercase tracking-wide">How I learn</span>
        </div>
        <h1 className="mt-1 text-2xl font-bold text-purple-200">Make lessons work for you</h1>
        <p className="mt-2 max-w-2xl text-purple-300">
          Elekeza shows every lesson in the way that helps <em>you</em> understand it best. You are in control — change
          any of these whenever you like, and your choice follows you on every device.
        </p>
        {save.isError && (
          <Alert tone="error" className="mt-3">
            {getErrorMessage(save.error, 'Could not save that preference. Please try again.')}
          </Alert>
        )}
        {savedKey && (
          <p
            role="status"
            className="mt-3 inline-flex items-center gap-1 rounded-full bg-green-600/30 px-3 py-1 text-xs text-green-200"
          >
            <Check size={14} aria-hidden="true" /> Saved
          </p>
        )}
      </div>

      {GROUPS.map((group) => (
        <Card key={group.key} padding="lg">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-purple-100">
                <group.icon size={18} className="text-purple-400" /> {group.title}
              </h2>
              <p className="mt-0.5 text-sm text-purple-300/80">{group.description}</p>
            </div>
            <span className="whitespace-nowrap pt-1 text-[11px] text-purple-300/70">{sourceOf(group.key)}</span>
          </div>
          <ChoiceButtons
            group={group}
            current={prefs[group.key]?.value}
            disabled={save.isPending}
            onChoose={(v) => choose(group.key, v)}
          />
        </Card>
      ))}

      <Card padding="lg">
        <h2 className="flex items-center gap-2 font-semibold text-purple-100">
          <Volume2 size={18} className="text-purple-400" aria-hidden="true" /> Support you can turn on
        </h2>
        <p className="mb-4 mt-0.5 text-sm text-purple-300/80">
          These are optional helpers — use them only if they help you.
        </p>
        <div className="space-y-3">
          {TOGGLES.map((toggle) => {
            const on = prefs[toggle.key]?.value === 'true';
            return (
              <div
                key={toggle.key}
                className="flex items-center justify-between gap-4 rounded-xl border border-purple-300/10 bg-white/5 p-3"
              >
                <div className="flex items-start gap-3">
                  <toggle.icon size={18} className="mt-0.5 text-amber-300" />
                  <div>
                    <p className="text-sm font-medium text-purple-100">{toggle.title}</p>
                    <p className="text-xs text-purple-300/80">{on ? toggle.whenOn : toggle.description}</p>
                    <p className="mt-0.5 text-[11px] text-purple-300/60">{sourceOf(toggle.key)}</p>
                  </div>
                </div>
                <Switch
                  label={toggle.title}
                  checked={on}
                  disabled={save.isPending}
                  onChange={(next) => choose(toggle.key, String(next))}
                />
              </div>
            );
          })}
        </div>
      </Card>

      <p className="max-w-2xl pb-6 text-xs text-purple-300/60">
        Elekeza never labels you — it just keeps finding the clearest way to teach each idea. If you change your mind,
        changing a choice here applies from your next lesson.
      </p>
    </div>
  );
}
