/**
 * Count label helpers — pluralization used across class pickers and stats.
 *
 * Spec: "1 learner" for exactly one; "N learners" for zero and any count
 * above one. Keeping this in one place means future surfaces (e.g. guardian,
 * reports) reuse the same wording instead of re-inventing it.
 */

/** "0 learners" / "1 learner" / "N learners" — the standard form. */
export function learnerCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'learner' : 'learners'}`;
}
