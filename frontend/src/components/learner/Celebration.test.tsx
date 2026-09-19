import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import Celebration, { type CelebrationData } from '@/components/learner/Celebration'

const onContinue = vi.fn()

const base: CelebrationData = {
  score: 85,
  stars: 4,
  xpEarned: 50,
  companionMessage: 'Great progress today!',
}

const renderCelebration = (data: Partial<CelebrationData> = {}) =>
  render(<Celebration data={{ ...base, ...data }} onContinue={onContinue} />)

describe('Celebration', () => {
  beforeEach(() => {
    onContinue.mockClear()
  })

  it('announces completion assertively as an alertdialog', () => {
    renderCelebration()
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveAttribute('aria-label', 'Quiz complete')
    expect(dialog).toHaveAttribute('aria-live', 'assertive')
  })

  it('is dismissible — a dialog a learner can never close would trap them', () => {
    renderCelebration()
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('shows the star rating with an accessible label, not colour alone', () => {
    renderCelebration()
    expect(screen.getByRole('img', { name: '4 of 5 stars' })).toBeInTheDocument()
  })

  it('shows score and XP', () => {
    renderCelebration()
    expect(screen.getByText('Score 85%')).toBeInTheDocument()
    expect(screen.getByText('+50 XP')).toBeInTheDocument()
  })

  it('rounds fractional scores for display', () => {
    renderCelebration({ score: 66.66 })
    expect(screen.getByText('Score 67%')).toBeInTheDocument()
  })

  it('uses the encouraging headline for passing scores', () => {
    renderCelebration({ score: 90 })
    expect(screen.getByText('Amazing work!')).toBeInTheDocument()
  })

  it('still celebrates lower scores without shaming', () => {
    renderCelebration({ score: 40, stars: 2, xpEarned: 10 })
    expect(screen.getByText('You did it!')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '2 of 5 stars' })).toBeInTheDocument()
  })

  it('shows the level-up message when a level was gained', () => {
    renderCelebration({ levelUp: { level: 3, levelName: 'Sapling' } })
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/Level 3 — Sapling/)).toBeInTheDocument()
  })

  it('omits the XP chip when no XP was earned', () => {
    renderCelebration({ xpEarned: 0 })
    expect(screen.queryByText(/XP/)).not.toBeInTheDocument()
  })
})
