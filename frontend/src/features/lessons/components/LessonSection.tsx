'use client';

import { useAccessibilitySettings, useTextToSpeech } from '@/features/accessibility';
import { sectionText, type LessonSection as Section } from '../api';

/**
 * Per-section read-aloud button. Shown only when the learner turned on
 * read-aloud — either in this device's accessibility settings or in their
 * server-side "Listen to lessons" preference.
 */
function ListenButton({ text, label, serverTts }: { text: string; label: string; serverTts: boolean }) {
  const { speak, stop, isSpeaking } = useTextToSpeech({ rate: 0.9 });
  const { settings } = useAccessibilitySettings();
  if (!(settings.textToSpeech || settings.readTextAloud || serverTts)) return null;
  return (
    <button
      type="button"
      onClick={() => (isSpeaking ? stop() : speak(text))}
      className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-purple-300/30 bg-white/10 px-3 py-1 text-xs text-purple-100 hover:bg-white/20"
      aria-label={`${isSpeaking ? 'Stop reading' : 'Listen to'} ${label}`}
    >
      <span aria-hidden="true">🔊</span>
      {isSpeaking ? 'Stop reading' : 'Listen'}
    </button>
  );
}

/** One lesson section: heading, optional Listen button, body text. */
export function LessonSection({
  section,
  index,
  total,
  showPosition,
  serverTts,
}: {
  section: Section;
  index: number;
  total: number;
  /** Shows "Section N of M" (reading mode). */
  showPosition: boolean;
  serverTts: boolean;
}) {
  const bodyText = sectionText(section.body);
  const heading = section.heading?.trim();
  const headingId = `lesson-section-${index}`;

  return (
    <section
      className="glass-card p-5"
      aria-labelledby={heading ? headingId : undefined}
      aria-label={heading ? undefined : `Section ${index + 1}`}
    >
      {heading && (
        <h2 id={headingId} className="mb-3 text-xl font-semibold text-purple-100">
          {heading}
        </h2>
      )}
      <ListenButton
        text={`${heading ? heading + '. ' : ''}${bodyText}`}
        label={heading || `Section ${index + 1}`}
        serverTts={serverTts}
      />
      <div className="whitespace-pre-line leading-relaxed text-purple-200">{bodyText}</div>
      {showPosition && (
        <p className="mt-3 text-xs text-purple-300">
          Section {index + 1} of {total}
        </p>
      )}
    </section>
  );
}

/** Reading progress that never relies on colour alone. */
export function ReadingProgress({ current, total, completed }: { current: number; total: number; completed: boolean }) {
  const pct = total > 0 ? Math.min(100, Math.round(((current + 1) / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-purple-300" aria-live="polite">
        {completed ? 'Completed' : `Section ${current + 1} of ${total}`}
      </span>
      <span className="text-purple-400" aria-hidden="true">
        ·
      </span>
      <span className="text-purple-300">{pct}%</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Reading progress"
        />
      </div>
    </div>
  );
}
