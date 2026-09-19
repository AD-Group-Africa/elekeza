import { CognitiveProfile } from '@/types'

const STORAGE_PREFIX = 'elekeza-cognitive-profiles:'

export const COGNITIVE_PROFILE_OPTIONS: { value: CognitiveProfile; label: string; helper: string }[] = [
  {
    value: 'DYSLEXIA',
    label: 'Dyslexia',
    helper: 'Reading support with dyslexia-friendly spacing and structure.',
  },
  {
    value: 'ADHD',
    label: 'ADHD',
    helper: 'Attention support with chunked sections and stronger visual cues.',
  },
  {
    value: 'AUTISM',
    label: 'Autism Spectrum',
    helper: 'Predictable layouts, stable patterns, and reduced visual surprises.',
  },
  {
    value: 'INTELLECTUAL_DISABILITY',
    label: 'Intellectual Disability',
    helper: 'Larger type, simplified structure, and larger tap targets.',
  },
  {
    value: 'DYSCALCULIA',
    label: 'Dyscalculia',
    helper: 'Math-related learning support and reduced numeric complexity.',
  },
]

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

export function readCognitiveProfiles(userId: string): CognitiveProfile[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(storageKey(userId))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is CognitiveProfile => typeof item === 'string')
  } catch {
    return []
  }
}

export function persistCognitiveProfiles(userId: string, profiles: CognitiveProfile[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(storageKey(userId), JSON.stringify([...new Set(profiles)]))
}
