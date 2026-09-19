'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { Sparkles, Type, AlignLeft, Contrast, MessageSquareText, Lightbulb, Volume2, Eye, Check } from 'lucide-react';

type PrefValue = string;
interface EffectivePref {
  value: PrefValue;
  source: string;
  confidence?: number;
}

type PrefMap = Record<string, EffectivePref>;

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
  icon: React.ComponentType<{ size?: number; className?: string }>;
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

const TOGGLES: { key: 'visualSupport' | 'readAloud'; title: string; description: string; icon: React.ComponentType<{ size?: number; className?: string }>; whenOn: string }[] = [
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

export default function LearnerPreferencesPage() {
  const [prefs, setPrefs] = useState<PrefMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);

  useEffect(() => {
    api.get('/learner/preferences')
      .then((res) => setPrefs(res.data.effective as PrefMap))
      .catch(() => setError('Could not load your learning preferences.'))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async (key: string, value: string) => {
    setError('');
    try {
      const res = await api.put('/learner/preferences', { key, value });
      setPrefs(res.data.effective as PrefMap);
      setSavedKey(key);
      window.setTimeout(() => setSavedKey(null), 1600);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Could not save that preference. Please try again.';
      setError(msg);
    }
  }, []);

  if (loading) {
    return (
      <SidebarLayout>
        <div className="p-6 text-purple-200">Loading your learning preferences…</div>
      </SidebarLayout>
    );
  }

  if (!prefs) {
    return (
      <SidebarLayout>
        <div className="p-6 text-red-400">{error || 'Could not load your learning preferences.'}</div>
      </SidebarLayout>
    );
  }

  const sourceOf = (key: string) => prefs[key]?.source || 'SYSTEM';

  const Segmented = ({ group }: { group: ChoiceGroup }) => {
    const current = prefs[group.key]?.value;
    return (
      <fieldset>
        <legend className="sr-only">{group.title}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={group.title}>
          {group.choices.map((choice) => {
            const active = current === choice.value;
            return (
              <button
                key={choice.value}
                role="radio"
                aria-checked={active}
                onClick={() => save(group.key, choice.value)}
                disabled={savedKey === group.key}
                className={
                  'text-left px-4 py-2 rounded-xl border text-sm transition ' +
                  (active
                    ? 'bg-purple-600/60 border-purple-400 text-white font-medium'
                    : 'bg-white/5 border-purple-300/10 text-purple-200 hover:bg-white/10')
                }
              >
                <span className="block">{choice.label}</span>
                {choice.hint && <span className={'block text-xs ' + (active ? 'text-purple-100' : 'text-purple-300/70')}>{choice.hint}</span>}
              </button>
            );
          })}
        </div>
      </fieldset>
    );
  };

  return (
    <SidebarLayout>
      <div className="max-w-3xl space-y-6">
        <div>
          <div className="flex items-center gap-2 text-purple-300">
            <Sparkles size={20} className="text-amber-300" />
            <span className="text-sm font-medium tracking-wide uppercase">How I learn</span>
          </div>
          <h1 className="text-2xl font-bold text-purple-200 mt-1">Make lessons work for you</h1>
          <p className="text-purple-300 mt-2 max-w-2xl">
            Elekeza shows every lesson in the way that helps <em>you</em> understand it best. You are in control —
            change any of these whenever you like, and your choice follows you on every device.
          </p>
          {error && <div className="mt-3 px-4 py-2 rounded-lg bg-red-500/20 text-red-200 text-sm border border-red-400/30">{error}</div>}
          {savedKey && (
            <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-600/30 text-green-200 text-xs">
              <Check size={14} /> Saved
            </div>
          )}
        </div>

        {GROUPS.map((group) => (
          <section key={group.key} className="glass-card p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="text-purple-100 font-semibold flex items-center gap-2">
                  <group.icon size={18} className="text-purple-400" /> {group.title}
                </h2>
                <p className="text-purple-300/80 text-sm mt-0.5">{group.description}</p>
              </div>
              <span className="text-[11px] text-purple-300/70 whitespace-nowrap pt-1">{SOURCE_LABEL[sourceOf(group.key)]}</span>
            </div>
            <Segmented group={group} />
          </section>
        ))}

        <section className="glass-card p-5">
          <h2 className="text-purple-100 font-semibold flex items-center gap-2">
            <Volume2 size={18} className="text-purple-400" /> Support you can turn on
          </h2>
          <p className="text-purple-300/80 text-sm mt-0.5 mb-4">These are optional helpers — use them only if they help you.</p>
          <div className="space-y-3">
            {TOGGLES.map((toggle) => {
              const on = prefs[toggle.key]?.value === 'true';
              return (
                <div key={toggle.key} className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/5 border border-purple-300/10">
                  <div className="flex items-start gap-3">
                    <toggle.icon size={18} className="text-amber-300 mt-0.5" />
                    <div>
                      <p className="text-purple-100 text-sm font-medium">{toggle.title}</p>
                      <p className="text-purple-300/80 text-xs">{on ? toggle.whenOn : toggle.description}</p>
                      <p className="text-[11px] text-purple-300/60 mt-0.5">{SOURCE_LABEL[sourceOf(toggle.key)]}</p>
                    </div>
                  </div>
                  <button
                    role="switch"
                    aria-checked={on}
                    aria-label={toggle.title}
                    onClick={() => save(toggle.key, on ? 'false' : 'true')}
                    className={
                      'relative w-12 h-7 rounded-full transition shrink-0 ' + (on ? 'bg-green-500/70' : 'bg-white/15')
                    }
                  >
                    <span className={'absolute top-1 w-5 h-5 rounded-full bg-white transition-all ' + (on ? 'left-6' : 'left-1')} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <p className="text-xs text-purple-300/60 max-w-2xl pb-6">
          Elekeza never labels you — it just keeps finding the clearest way to teach each idea. If you change your
          mind, changing a choice here applies from your next lesson.
        </p>
      </div>
    </SidebarLayout>
  );
}
