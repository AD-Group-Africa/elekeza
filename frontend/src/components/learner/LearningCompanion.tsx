'use client';

/**
 * Elekeza — the learning companion.
 *
 * The character is a UX primitive, not a decoration: it greets, explains,
 * encourages, hints and celebrates. Built as pure SVG + CSS so there is no
 * animation library, no image asset to load, and it respects reduced motion.
 */

export type CompanionState =
  | 'idle'
  | 'greeting'
  | 'explaining'
  | 'thinking'
  | 'encouraging'
  | 'celebrating'
  | 'hinting'
  | 'concerned'
  | 'success';

interface LearningCompanionProps {
  state?: CompanionState;
  size?: number;
  className?: string;
}

// One gentle bounce loop for lively states; static otherwise. Honours
// prefers-reduced-motion via the global CSS media query (see globals.css).
const LIVELY: Record<CompanionState, boolean> = {
  idle: false,
  greeting: true,
  explaining: false,
  thinking: true,
  encouraging: true,
  celebrating: true,
  hinting: true,
  concerned: false,
  success: true,
};

export default function LearningCompanion({ state = 'idle', size = 96, className = '' }: LearningCompanionProps) {
  // Eyes: happy arcs when celebrating/success, wide when thinking/hinting.
  const happy = state === 'celebrating' || state === 'success' || state === 'greeting';
  const wide = state === 'thinking' || state === 'hinting' || state === 'concerned';
  const lively = LIVELY[state];

  return (
    <span
      className={'elekeza-companion inline-block ' + (lively ? 'companion-lively ' : '') + className}
      role="img"
      aria-label={`Elekeza companion is ${state}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        {/* Warm rounded body */}
        <ellipse cx="50" cy="58" rx="30" ry="28" fill="#7C3AED" />
        <ellipse cx="50" cy="58" rx="30" ry="28" fill="url(#bodyShade)" />
        {/* Belly */}
        <ellipse cx="50" cy="66" rx="19" ry="17" fill="#EDE9FE" />
        {/* Head */}
        <circle cx="50" cy="36" r="20" fill="#7C3AED" />
        {/* Ears */}
        <circle cx="33" cy="24" r="7" fill="#7C3AED" />
        <circle cx="67" cy="24" r="7" fill="#7C3AED" />
        <circle cx="33" cy="24" r="4" fill="#F5D0FE" />
        <circle cx="67" cy="24" r="4" fill="#F5D0FE" />
        {/* Eyes */}
        {happy ? (
          <>
            <path d="M 39 34 Q 43 29 47 34" stroke="#1E1B4B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M 53 34 Q 57 29 61 34" stroke="#1E1B4B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        ) : wide ? (
          <>
            <circle cx="43" cy="33" r="3.4" fill="#1E1B4B" />
            <circle cx="57" cy="33" r="3.4" fill="#1E1B4B" />
          </>
        ) : (
          <>
            <circle cx="43" cy="33" r="2.8" fill="#1E1B4B" />
            <circle cx="57" cy="33" r="2.8" fill="#1E1B4B" />
          </>
        )}
        {/* Cheeks */}
        <circle cx="38" cy="40" r="3" fill="#F0ABFC" opacity="0.8" />
        <circle cx="62" cy="40" r="3" fill="#F0ABFC" opacity="0.8" />
        {/* Mouth */}
        {state === 'concerned' ? (
          <path d="M 45 44 Q 50 41 55 44" stroke="#1E1B4B" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        ) : happy ? (
          <path d="M 42 41 Q 50 49 58 41" stroke="#1E1B4B" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M 44 43 Q 50 47 56 43" stroke="#1E1B4B" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        )}
        {/* Celebrate stars */}
        {state === 'celebrating' && (
          <>
            <text x="12" y="30" fontSize="14" fill="#FBBF24">✦</text>
            <text x="80" y="26" fontSize="11" fill="#F472B6">✦</text>
            <text x="76" y="70" fontSize="12" fill="#FDE68A">✦</text>
          </>
        )}
        {/* Thinking dots */}
        {state === 'thinking' && (
          <>
            <circle cx="72" cy="22" r="2.5" fill="#C4B5FD" />
            <circle cx="78" cy="16" r="3.2" fill="#A78BFA" />
            <circle cx="85" cy="10" r="4" fill="#8B5CF6" />
          </>
        )}
        <defs>
          <radialGradient id="bodyShade" cx="0.35" cy="0.3" r="1">
            <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#5B21B6" stopOpacity="0.35" />
          </radialGradient>
        </defs>
      </svg>
      <style jsx>{`
        .companion-lively {
          animation: companion-bounce 2.4s ease-in-out infinite;
        }
        @keyframes companion-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .companion-lively { animation: none; }
        }
      `}</style>
    </span>
  );
}
