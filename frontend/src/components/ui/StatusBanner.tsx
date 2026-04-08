import { ReactNode } from 'react'

type StatusTone = 'success' | 'error' | 'info' | 'warning'

type StatusBannerProps = {
  tone: StatusTone
  children: ReactNode
}

const toneClasses: Record<StatusTone, string> = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  error: 'border-red-300 bg-red-50 text-red-700',
  info: 'border-sky-300 bg-sky-50 text-sky-800',
  warning: 'border-amber-300 bg-amber-50 text-amber-800',
}

export default function StatusBanner({ tone, children }: StatusBannerProps) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${toneClasses[tone]}`}>
      {children}
    </div>
  )
}

