import { describe, expect, it } from 'vitest'
import { learnerCountLabel } from './pluralize'

/**
 * Bug-fix regression: class pickers previously rendered "1 learners".
 * Spec: singular for exactly one, plural for zero and any count above one.
 */
describe('learnerCountLabel', () => {
  it('uses the singular for exactly one learner', () => {
    expect(learnerCountLabel(1)).toBe('1 learner')
  })

  it('uses the plural for zero', () => {
    expect(learnerCountLabel(0)).toBe('0 learners')
  })

  it('uses the plural for counts above one', () => {
    expect(learnerCountLabel(2)).toBe('2 learners')
    expect(learnerCountLabel(31)).toBe('31 learners')
  })
})
