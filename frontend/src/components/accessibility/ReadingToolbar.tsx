'use client'
import { useState, useEffect, useCallback } from 'react'
import { useTextToSpeech } from '@/hooks/useTextToSpeech'

interface ReadingPreferences {
    fontFamily: 'atkinson' | 'opendyslexic' | 'system'
    fontSize: number        // 14-28
    lineSpacing: number     // 1.4-2.5
    letterSpacing: 'normal' | 'wide' | 'very-wide'
    backgroundColor: 'white' | 'cream' | 'soft-blue' | 'yellow'
    columnWidth: 'normal' | 'narrow'
    readingRuler: boolean
    ttsRate: number
    ttsPitch: number
}

const DEFAULTS: ReadingPreferences = {
    fontFamily: 'atkinson',
    fontSize: 18,
    lineSpacing: 1.6,
    letterSpacing: 'normal',
    backgroundColor: 'white',
    columnWidth: 'normal',
    readingRuler: false,
    ttsRate: 0.85,
    ttsPitch: 1.0,
}

const BG_COLORS: Record<string, string> = {
    white: '#FFFFFF',
    cream: '#FFF8F0',
    'soft-blue': '#EEF4FF',
    yellow: '#FFFDE7',
}

export function ReadingToolbar({ contentRef }: { contentRef: React.RefObject<HTMLElement> }) {
    const [prefs, setPrefs] = useState<ReadingPreferences>(DEFAULTS)
    const [isOpen, setIsOpen] = useState(false)
    const { speak, stop, isSpeaking } = useTextToSpeech({ rate: prefs.ttsRate, pitch: prefs.ttsPitch })

    // Load saved preferences
    useEffect(() => {
        const saved = localStorage.getItem('reading-prefs')
        if (saved) {
            try { setPrefs({ ...DEFAULTS, ...JSON.parse(saved) }) } catch {}
        }
    }, [])

    // Apply preferences to document
    useEffect(() => {
        const root = document.documentElement
        root.style.setProperty('--reader-font', getFontFamily(prefs.fontFamily))
        root.style.setProperty('--reader-font-size', `${prefs.fontSize}px`)
        root.style.setProperty('--reader-line-height', String(prefs.lineSpacing))
        root.style.setProperty('--reader-letter-spacing', getLetterSpacing(prefs.letterSpacing))
        root.style.setProperty('--reader-bg', BG_COLORS[prefs.backgroundColor] || '#FFFFFF')
        root.style.setProperty('--reader-max-width', prefs.columnWidth === 'narrow' ? '60ch' : '100%')

        if (contentRef.current) {
            contentRef.current.style.fontFamily = getFontFamily(prefs.fontFamily)
            contentRef.current.style.fontSize = `${prefs.fontSize}px`
            contentRef.current.style.lineHeight = String(prefs.lineSpacing)
            contentRef.current.style.letterSpacing = getLetterSpacing(prefs.letterSpacing)
            contentRef.current.style.backgroundColor = BG_COLORS[prefs.backgroundColor]
            contentRef.current.style.maxWidth = prefs.columnWidth === 'narrow' ? '60ch' : 'none'
        }

        localStorage.setItem('reading-prefs', JSON.stringify(prefs))
    }, [prefs, contentRef])

    const update = useCallback((partial: Partial<ReadingPreferences>) => {
        setPrefs((prev) => ({ ...prev, ...partial }))
    }, [])

    const handleReadAloud = () => {
        if (isSpeaking) {
            stop()
        } else if (contentRef.current) {
            const text = contentRef.current.innerText
            speak(text)
        }
    }

    return (
        <div className="border-b bg-gray-50" role="toolbar" aria-label="Reading controls">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium w-full text-left"
                aria-expanded={isOpen}
            >
                <span aria-hidden="true">⚙️</span>
                Reading Controls
                <span className="ml-auto text-gray-400">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
                <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Font Family */}
                    <label className="flex flex-col gap-1">
                        <span className="text-xs text-gray-600">Font</span>
                        <select
                            value={prefs.fontFamily}
                            onChange={(e) => update({ fontFamily: e.target.value as any })}
                            className="text-sm border rounded p-1"
                        >
                            <option value="atkinson">Atkinson Hyperlegible</option>
                            <option value="opendyslexic">OpenDyslexic</option>
                            <option value="system">System Default</option>
                        </select>
                    </label>

                    {/* Font Size */}
                    <label className="flex flex-col gap-1">
                        <span className="text-xs text-gray-600">Size: {prefs.fontSize}px</span>
                        <input
                            type="range"
                            min={14}
                            max={28}
                            value={prefs.fontSize}
                            onChange={(e) => update({ fontSize: Number(e.target.value) })}
                            className="w-full"
                            aria-label={`Font size: ${prefs.fontSize} pixels`}
                        />
                    </label>

                    {/* Line Spacing */}
                    <label className="flex flex-col gap-1">
                        <span className="text-xs text-gray-600">Spacing: {prefs.lineSpacing}</span>
                        <input
                            type="range"
                            min={1.4}
                            max={2.5}
                            step={0.1}
                            value={prefs.lineSpacing}
                            onChange={(e) => update({ lineSpacing: Number(e.target.value) })}
                            className="w-full"
                            aria-label={`Line spacing: ${prefs.lineSpacing}`}
                        />
                    </label>

                    {/* Background Color */}
                    <label className="flex flex-col gap-1">
                        <span className="text-xs text-gray-600">Background</span>
                        <select
                            value={prefs.backgroundColor}
                            onChange={(e) => update({ backgroundColor: e.target.value as any })}
                            className="text-sm border rounded p-1"
                        >
                            <option value="white">White</option>
                            <option value="cream">Cream</option>
                            <option value="soft-blue">Soft Blue</option>
                            <option value="yellow">Yellow</option>
                        </select>
                    </label>

                    {/* TTS Controls */}
                    <div className="flex items-end gap-2">
                        <button
                            onClick={handleReadAloud}
                            className={`px-3 py-1.5 text-sm rounded ${isSpeaking ? 'bg-red-500 text-white' : 'bg-primary text-white'}`}
                            aria-label={isSpeaking ? 'Stop reading aloud' : 'Read lesson aloud'}
                        >
                            {isSpeaking ? '⏹ Stop' : '🔊 Read Aloud'}
                        </button>
                    </div>

                    {/* TTS Speed */}
                    <label className="flex flex-col gap-1">
                        <span className="text-xs text-gray-600">Speed: {prefs.ttsRate.toFixed(2)}x</span>
                        <input
                            type="range"
                            min={0.5}
                            max={2.0}
                            step={0.05}
                            value={prefs.ttsRate}
                            onChange={(e) => update({ ttsRate: Number(e.target.value) })}
                            className="w-full"
                            aria-label={`Reading speed: ${prefs.ttsRate}`}
                        />
                    </label>

                    {/* Column Width */}
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={prefs.columnWidth === 'narrow'}
                            onChange={(e) => update({ columnWidth: e.target.checked ? 'narrow' : 'normal' })}
                        />
                        Narrow Column
                    </label>

                    {/* Reading Ruler */}
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={prefs.readingRuler}
                            onChange={(e) => update({ readingRuler: e.target.checked })}
                        />
                        Reading Ruler
                    </label>

                    {/* Reset */}
                    <button
                        onClick={() => setPrefs(DEFAULTS)}
                        className="text-sm text-gray-500 underline"
                    >
                        Reset to defaults
                    </button>
                </div>
            )}
        </div>
    )
}

function getFontFamily(font: string): string {
    const map: Record<string, string> = {
        atkinson: "'Atkinson Hyperlegible', sans-serif",
        opendyslexic: "'OpenDyslexic', sans-serif",
        system: "system-ui, -apple-system, sans-serif",
    }
    return map[font] || map.system
}

function getLetterSpacing(spacing: string): string {
    const map: Record<string, string> = {
        normal: 'normal',
        wide: '0.05em',
        'very-wide': '0.12em',
    }
    return map[spacing] || 'normal'
}