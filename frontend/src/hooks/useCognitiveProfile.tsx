'use client'

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { CognitiveProfile } from '@/types'
import { persistCognitiveProfiles, readCognitiveProfiles } from '@/lib/cognitiveProfiles'

type CognitiveMode = 'default' | 'dyslexia' | 'adhd' | 'autism' | 'intellectualDisability'

type CognitiveProfileContextType = {
  profiles: CognitiveProfile[]
  activeMode: CognitiveMode
  setProfilesForCurrentUser: (profiles: CognitiveProfile[]) => void
  hasProfile: (profile: CognitiveProfile) => boolean
}

const CognitiveProfileContext = createContext<CognitiveProfileContextType | undefined>(undefined)

const BODY_MODE_CLASSES: Record<CognitiveMode, string> = {
  default: 'cognitive-mode-default',
  dyslexia: 'cognitive-mode-dyslexia',
  adhd: 'cognitive-mode-adhd',
  autism: 'cognitive-mode-autism',
  intellectualDisability: 'cognitive-mode-intellectual-disability',
}

function resolveActiveMode(profiles: CognitiveProfile[]): CognitiveMode {
  if (profiles.includes('DYSLEXIA')) return 'dyslexia'
  if (profiles.includes('ADHD')) return 'adhd'
  if (profiles.includes('AUTISM')) return 'autism'
  if (profiles.includes('INTELLECTUAL_DISABILITY')) return 'intellectualDisability'
  return 'default'
}

export function CognitiveProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [version, setVersion] = useState(0)

  const profiles = useMemo<CognitiveProfile[]>(() => {
    if (!user?.id) return []
    const userProfiles = user.cognitiveProfiles ?? []
    if (userProfiles.length > 0) {
      persistCognitiveProfiles(user.id, userProfiles)
      return [...new Set(userProfiles)]
    }
    return readCognitiveProfiles(user.id)
  }, [user, version])

  const activeMode = useMemo(() => resolveActiveMode(profiles), [profiles])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const body = document.body
    ;(Object.values(BODY_MODE_CLASSES) as string[]).forEach((className) => body.classList.remove(className))
    body.classList.add(BODY_MODE_CLASSES[activeMode])
  }, [activeMode])

  const contextValue = useMemo<CognitiveProfileContextType>(
    () => ({
      profiles,
      activeMode,
      setProfilesForCurrentUser: (nextProfiles: CognitiveProfile[]) => {
        if (!user?.id) return
        const uniqueProfiles = [...new Set(nextProfiles)]
        persistCognitiveProfiles(user.id, uniqueProfiles)
        setVersion((prev) => prev + 1)
      },
      hasProfile: (profile: CognitiveProfile) => profiles.includes(profile),
    }),
    [profiles, activeMode, user]
  )

  return <CognitiveProfileContext.Provider value={contextValue}>{children}</CognitiveProfileContext.Provider>
}

export function useCognitiveProfile() {
  const context = useContext(CognitiveProfileContext)
  if (!context) {
    throw new Error('useCognitiveProfile must be used within CognitiveProfileProvider')
  }
  return context
}

