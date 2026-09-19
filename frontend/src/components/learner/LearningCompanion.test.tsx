import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LearningCompanion from '@/components/learner/LearningCompanion'

/**
 * The companion is an accessibility primitive: it must always announce its
 * state and never lose its accessible name when states change.
 */
describe('LearningCompanion', () => {
  it('announces its state via role=img and aria-label', () => {
    render(<LearningCompanion state="greeting" />)
    const node = screen.getByRole('img')
    expect(node).toHaveAttribute('aria-label', 'Elekeza companion is greeting')
  })

  it('defaults to idle state with an accessible label', () => {
    render(<LearningCompanion />)
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Elekeza companion is idle')
  })

  it('renders an SVG that is hidden from screen readers (decorative interior)', () => {
    render(<LearningCompanion state="celebrating" />)
    const svg = screen.getByRole('img').querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('keeps the accessible name across every supported state', () => {
    const states = [
      'idle', 'greeting', 'explaining', 'thinking', 'encouraging',
      'celebrating', 'hinting', 'concerned', 'success',
    ] as const
    states.forEach((state) => {
      const { unmount } = render(<LearningCompanion state={state} />)
      expect(screen.getByRole('img')).toHaveAttribute(
        'aria-label',
        `Elekeza companion is ${state}`
      )
      unmount()
    })
  })
})
