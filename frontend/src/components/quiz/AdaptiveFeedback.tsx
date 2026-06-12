'use client'
import { useEffect, useState } from 'react'

interface Props {
    directive: string | null
    message: string | null
    isVisible: boolean
}

export function AdaptiveFeedback({ directive, message, isVisible }: Props) {
    const [show, setShow] = useState(false)

    useEffect(() => {
        if (isVisible && message) {
            setShow(true)
            const timer = setTimeout(() => setShow(false), 4000)
            return () => clearTimeout(timer)
        }
    }, [isVisible, message])

    if (!show || !message) return null

    const colors: Record<string, string> = {
        harder: 'bg-green-50 border-green-400 text-green-800',
        same: 'bg-blue-50 border-blue-400 text-blue-800',
        easier: 'bg-amber-50 border-amber-400 text-amber-800',
        revisit: 'bg-purple-50 border-purple-400 text-purple-800',
    }

    return (
        <div
            role="status"
            aria-live="polite"
            className={`p-4 border-l-4 rounded-r-md transition-opacity duration-300 ${colors[directive || 'same'] || colors.same}`}
        >
            <p className="font-medium">{message}</p>
        </div>
    )
}