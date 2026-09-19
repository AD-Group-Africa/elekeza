/**
 * Client-side display helpers for Mastery states.
 *
 * Single source of truth for state values is the backend (`/api/mastery/*`);
 * this module only owns presentation: human labels, plain-language
 * descriptions, a distinct icon per state (meaning is never carried by colour
 * alone), and tone classes. Mirrors the respectful, non-diagnostic language
 * rule from backend MasteryEngine.
 */
export type MasteryState =
  | 'NOT_ASSESSED'
  | 'DEVELOPING'
  | 'APPROACHING'
  | 'MASTERED'
  | 'NEEDS_SUPPORT'

export const MASTERY_LABEL: Record<MasteryState, string> = {
  NOT_ASSESSED: 'Not assessed yet',
  DEVELOPING: 'Developing',
  APPROACHING: 'Almost there',
  MASTERED: 'Mastered',
  NEEDS_SUPPORT: 'Needs support',
}

export const MASTERY_DESCRIPTION: Record<MasteryState, string> = {
  NOT_ASSESSED: 'Take the quiz to show what you know.',
  DEVELOPING: 'Good start — keep practising this lesson.',
  APPROACHING: 'One more good attempt will confirm it.',
  MASTERED: 'Strong evidence across attempts. Well done!',
  NEEDS_SUPPORT: 'This lesson is difficult right now — ask for help.',
}

/**
 * A distinct icon per state so mastery meaning never depends on colour alone
 * (WCAG 1.4.1). Simple inline glyphs keep the learner surfaces lightweight.
 */
export const MASTERY_ICON: Record<MasteryState, string> = {
  NOT_ASSESSED: '○',
  DEVELOPING: '◔',
  APPROACHING: '◑',
  MASTERED: '●',
  NEEDS_SUPPORT: '⚠',
}

export const MASTERY_TONE_CLASS: Record<MasteryState, string> = {
  NOT_ASSESSED: 'text-purple-200 bg-purple-500/10',
  DEVELOPING: 'text-sky-200 bg-sky-500/10',
  APPROACHING: 'text-amber-200 bg-amber-500/10',
  MASTERED: 'text-emerald-200 bg-emerald-500/10',
  NEEDS_SUPPORT: 'text-rose-200 bg-rose-500/10',
}

export function isMasteryState(value: unknown): value is MasteryState {
  return (
    value === 'NOT_ASSESSED' ||
    value === 'DEVELOPING' ||
    value === 'APPROACHING' ||
    value === 'MASTERED' ||
    value === 'NEEDS_SUPPORT'
  )
}
