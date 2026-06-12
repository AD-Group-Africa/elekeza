'use client'
import { useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'

interface AdaptiveState {
    directive: 'easier' | 'same' | 'harder' | 'revisit' | null
    message: string | null
    difficultyLevel: number
}

export function useQuizAdaptive(quizId: string) {
    const [adaptive, setAdaptive] = useState<AdaptiveState>({
        directive: null,
        message: null,
        difficultyLevel: 2,
    })
    const questionStartTime = useRef<number>(Date.now())

    const startTimer = useCallback(() => {
        questionStartTime.current = Date.now()
    }, [])

    const submitAnswer = useCallback(
        async (questionId: string, answer: string) => {
            const latencyMs = Date.now() - questionStartTime.current
            const { data } = await api.post(`/api/quiz/${quizId}/answer`, {
                questionId,
                answer,
                latencyMs,
            })
            setAdaptive({
                directive: data.adaptiveDirective,
                message: data.adaptiveMessage,
                difficultyLevel: data.nextDifficultyLevel,
            })
            return data
        },
        [quizId]
    )

    return { adaptive, startTimer, submitAnswer }
}