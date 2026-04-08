import { AdjustmentsHorizontalIcon, EyeIcon } from '@heroicons/react/24/outline'
import { ReactNode } from 'react'

type Props = {
  calmUI: boolean
  focusMode: boolean
  onCalmToggle: () => void
  onFocusToggle: () => void
}

function ModeToggle({
  title,
  subtitle,
  active,
  onToggle,
  icon,
}: {
  title: string
  subtitle: string
  active: boolean
  onToggle: () => void
  icon: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`flex w-full items-center justify-between gap-4 rounded-xl border p-3 text-left transition ${
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
          }`}
        >
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className={`text-xs ${active ? 'text-slate-200' : 'text-slate-500'}`}>{subtitle}</p>
        </div>
      </div>

      <span
        className={`relative inline-flex h-6 w-12 items-center rounded-full border-2 transition ${
          active ? 'border-white/70 bg-white/20' : 'border-slate-300 bg-slate-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
            active ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  )
}

export default function AccessibilityToolbar({ calmUI, focusMode, onCalmToggle, onFocusToggle }: Props) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Display Modes</h2>
        <p className="text-xs text-slate-500">Quick controls</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ModeToggle
          title="Calm UI"
          subtitle="Softer visuals and reduced stimulation"
          active={calmUI}
          onToggle={onCalmToggle}
          icon={<AdjustmentsHorizontalIcon className="h-5 w-5" />}
        />
        <ModeToggle
          title="Focus Mode"
          subtitle="Narrow layout and clearer reading path"
          active={focusMode}
          onToggle={onFocusToggle}
          icon={<EyeIcon className="h-5 w-5" />}
        />
      </div>
    </section>
  )
}
