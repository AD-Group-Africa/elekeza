import { describe, expect, it } from 'vitest'
import {
  MASTERY_DESCRIPTION,
  MASTERY_ICON,
  MASTERY_LABEL,
  isMasteryState,
} from '@/lib/masteryDisplay'

describe('masteryDisplay', () => {
  it('has a distinct icon per state so meaning never rides on colour alone', () => {
    const icons = Object.values(MASTERY_ICON)
    expect(new Set(icons).size).toBe(icons.length)
  })

  it('has a plain-language label and description for every state', () => {
    ;(Object.keys(MASTERY_LABEL) as (keyof typeof MASTERY_LABEL)[]).forEach((state) => {
      expect(MASTERY_LABEL[state]).not.toBe('')
      expect(MASTERY_DESCRIPTION[state]).not.toBe('')
    })
  })

  it('labels are respectful and never diagnostic', () => {
    const forbidden = /dyslexia|adhd|autis|disorder|retard|stupid|dumb|fail/i
    ;(Object.values(MASTERY_LABEL) as string[]).forEach((label) => {
      expect(label).not.toMatch(forbidden)
    })
    ;(Object.values(MASTERY_DESCRIPTION) as string[]).forEach((d) => {
      expect(d).not.toMatch(forbidden)
    })
  })

  it('isMasteryState guards unknown values', () => {
    expect(isMasteryState('MASTERED')).toBe(true)
    expect(isMasteryState('NEEDS_SUPPORT')).toBe(true)
    expect(isMasteryState('SUPER_SAIYAN')).toBe(false)
    expect(isMasteryState(undefined)).toBe(false)
  })
})
