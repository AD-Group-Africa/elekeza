type ProgressStepperProps = {
  steps: string[]
  currentStep: number
}

export default function ProgressStepper({ steps, currentStep }: ProgressStepperProps) {
  const safeCurrentStep = Math.max(1, Math.min(currentStep, steps.length))

  return (
    <div className="rounded-2xl border border-slate-200 glass-card px-4 py-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-purple-300">
        <span>Step {safeCurrentStep} of {steps.length}</span>
        <span>{Math.round((safeCurrentStep / steps.length) * 100)}% complete</span>
      </div>

      <div className="mb-4 h-2 w-full rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-slate-900 transition-all duration-300"
          style={{ width: `${(safeCurrentStep / steps.length) * 100}%` }}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => {
          const stepNumber = index + 1
          const isCurrent = safeCurrentStep === stepNumber
          const isDone = safeCurrentStep > stepNumber

          return (
            <div
              key={step}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                isCurrent
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : isDone
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {step}
            </div>
          )
        })}
      </div>
    </div>
  )
}


