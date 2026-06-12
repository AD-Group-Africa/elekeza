'use client'
import { useEffect, useState, useCallback } from 'react'

export function ReadingRuler({ enabled, containerRef }: { enabled: boolean; containerRef: React.RefObject<HTMLElement> }) {
    const [y, setY] = useState(0)

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!enabled || !containerRef.current) return
            const rect = containerRef.current.getBoundingClientRect()
            const relativeY = e.clientY - rect.top
            setY(relativeY)
        },
        [enabled, containerRef]
    )

    useEffect(() => {
        if (enabled) {
            window.addEventListener('mousemove', handleMouseMove)
        }
        return () => window.removeEventListener('mousemove', handleMouseMove)
    }, [enabled, handleMouseMove])

    if (!enabled) return null

    return (
        <div
            className="pointer-events-none absolute left-0 right-0 h-0.5 bg-yellow-400 opacity-60 z-10"
            style={{ top: `${y}px` }}
            aria-hidden="true"
        />
    )
}