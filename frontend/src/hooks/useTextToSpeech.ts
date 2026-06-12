'use client'
import { useState, useCallback, useRef, useEffect } from 'react'

interface TTSOptions {
    rate: number   // 0.5 to 2.0
    pitch: number  // 0.5 to 2.0
    voice: string  // 'en-KE', 'sw-TZ', or 'auto'
}

const DEFAULT_OPTIONS: TTSOptions = {
    rate: 0.85,
    pitch: 1.0,
    voice: 'auto',
}

export function useTextToSpeech(options: Partial<TTSOptions> = {}) {
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
    const opts = { ...DEFAULT_OPTIONS, ...options }

    const speak = useCallback(
        (text: string) => {
            if (!synth) return
            synth.cancel()
            const utterance = new SpeechSynthesisUtterance(text)
            utterance.rate = opts.rate
            utterance.pitch = opts.pitch

            // Set voice if available
            if (opts.voice !== 'auto') {
                const voices = synth.getVoices()
                const matching = voices.find((v) => v.lang.startsWith(opts.voice))
                if (matching) utterance.voice = matching
            }

            utterance.onstart = () => {
                setIsSpeaking(true)
                setIsPaused(false)
            }
            utterance.onend = () => {
                setIsSpeaking(false)
                setIsPaused(false)
            }
            utterance.onerror = () => {
                setIsSpeaking(false)
                setIsPaused(false)
            }

            utteranceRef.current = utterance
            synth.speak(utterance)
        },
        [synth, opts.rate, opts.pitch, opts.voice]
    )

    const pause = useCallback(() => {
        synth?.pause()
        setIsPaused(true)
        setIsSpeaking(false)
    }, [synth])

    const resume = useCallback(() => {
        synth?.resume()
        setIsPaused(false)
        setIsSpeaking(true)
    }, [synth])

    const stop = useCallback(() => {
        synth?.cancel()
        setIsSpeaking(false)
        setIsPaused(false)
    }, [synth])

    // Cleanup on unmount
    useEffect(() => {
        return () => synth?.cancel()
    }, [synth])

    return { speak, pause, resume, stop, isSpeaking, isPaused }
}