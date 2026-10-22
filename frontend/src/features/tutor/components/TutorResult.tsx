'use client';

import { ArrowLeft } from 'lucide-react';
import type { PracticeQuestion, TutorResponse } from '../api';

const panel = 'rounded-xl border border-line bg-surface p-5';
const secondaryButton = 'rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface-hover';

/** The engine emits a tiny markdown subset (## heading, - bullets, **bold**). */
function SimpleMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-semibold">
              {line.slice(3)}
            </h3>
          );
        if (line.startsWith('- ')) {
          return (
            <div key={i} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        if (!line.trim()) return null;
        return (
          <p key={i} className="whitespace-pre-line">
            {line.split(/\*\*(.+?)\*\*/g).map((part, j) => (j % 2 === 1 ? <strong key={j}>{part}</strong> : part))}
          </p>
        );
      })}
    </div>
  );
}

/** Renders one tutor response for whichever action was asked. */
export function TutorResult({
  result,
  practice,
  answer,
  busy,
  onAnswer,
  onCheckAnswer,
  onSimpler,
  onAnotherPractice,
  onBack,
}: {
  result: TutorResponse;
  practice: PracticeQuestion | null;
  answer: number | null;
  busy: boolean;
  onAnswer: (index: number) => void;
  onCheckAnswer: () => void;
  onSimpler: () => void;
  onAnotherPractice: () => void;
  onBack: () => void;
}) {
  return (
    <div className={`${panel} space-y-4`}>
      {result.intro && <p className="text-sm font-medium opacity-90">{result.intro}</p>}

      {result.action === 'EXPLAIN' && (
        <div className="space-y-3">
          <p className="whitespace-pre-line">{result.content}</p>
          <button type="button" onClick={onSimpler} className={secondaryButton}>
            Let&apos;s make it simpler
          </button>
        </div>
      )}

      {result.action === 'SUMMARY' && <SimpleMarkdown text={result.content ?? ''} />}

      {result.action === 'TRANSLATE' && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide opacity-70">Kiswahili ({result.translatedBy})</p>
          <p className="whitespace-pre-line">{result.content}</p>
          {result.originalText && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">Show original English</summary>
              <p className="mt-2 opacity-80">{result.originalText}</p>
            </details>
          )}
        </div>
      )}

      {result.action === 'DIAGRAM' && result.diagram && (
        <div className="space-y-3">
          <p className="font-semibold">{result.diagram.title}</p>
          <ol className="space-y-2" aria-label={result.diagram.altText}>
            {result.diagram.nodes.map((n, i) => (
              <li key={n.id} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-sm font-bold"
                >
                  {i + 1}
                </span>
                <span>{n.label}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm opacity-75">{result.diagram.altText}</p>
        </div>
      )}

      {result.action === 'PRACTICE' && practice && (
        <fieldset className="space-y-4">
          <legend className="whitespace-pre-line font-medium">{practice.question}</legend>
          <div className="grid gap-2">
            {practice.options.map((opt, i) => (
              <label
                key={i}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 hover:bg-surface-hover"
              >
                <input type="radio" name="tutor-practice" checked={answer === i} onChange={() => onAnswer(i)} />
                <span>{opt}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={onCheckAnswer}
            disabled={answer === null || busy}
            className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-contrast disabled:opacity-50"
          >
            Check my answer
          </button>
        </fieldset>
      )}

      {result.action === 'PRACTICE' && result.feedback && (
        <div className="space-y-3">
          <p className={'font-semibold ' + (result.feedback.correct ? 'text-green-500' : 'text-amber-500')}>
            {result.feedback.correct ? 'Correct!' : 'Not quite — keep going.'}
          </p>
          <p>{result.feedback.explanation}</p>
          <button type="button" onClick={onAnotherPractice} className={secondaryButton}>
            Another practice question
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line pt-2">
        <button type="button" onClick={onBack} className={secondaryButton}>
          <ArrowLeft size={14} className="mr-1 inline" aria-hidden="true" /> Back to choices
        </button>
      </div>
    </div>
  );
}
