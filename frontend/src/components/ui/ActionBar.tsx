import { ReactNode } from 'react'

type ActionBarProps = {
  primaryAction: ReactNode
  secondaryAction?: ReactNode
  align?: 'left' | 'right' | 'between'
}

export default function ActionBar({
  primaryAction,
  secondaryAction,
  align = 'left',
}: ActionBarProps) {
  const justifyClass =
    align === 'between'
      ? 'justify-between'
      : align === 'right'
        ? 'justify-end'
        : 'justify-start'

  return (
    <div className={`flex flex-wrap items-center gap-3 ${justifyClass}`}>
      {secondaryAction}
      {primaryAction}
    </div>
  )
}

