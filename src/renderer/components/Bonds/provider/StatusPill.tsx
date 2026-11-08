import clsx from 'clsx'

export type StatusPillTone = 'accent' | 'success' | 'warning' | 'neutral'

const TONE_CLASS: Record<StatusPillTone, { pill: string; dot: string }> = {
  accent: { pill: 'bg-turquoise/10 text-turquoise', dot: 'bg-turquoise' },
  success: { pill: 'bg-success/10 text-success', dot: 'bg-success' },
  warning: {
    pill: 'bg-warning0/10 text-warning0 dark:bg-warning0d/10 dark:text-warning0d',
    dot: 'bg-warning0 dark:bg-warning0d'
  },
  neutral: {
    pill: 'bg-gray2/10 text-gray2 dark:bg-gray2d/15 dark:text-gray2d',
    dot: 'bg-gray2 dark:bg-gray2d'
  }
}

type Props = {
  tone: StatusPillTone
  pulse?: boolean
  className?: string
  children: React.ReactNode
}

export const StatusPill = ({ tone, pulse = false, className, children }: Props) => {
  const { pill, dot } = TONE_CLASS[tone]
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-main-semi-bold text-[11px] leading-none tracking-[1px] whitespace-nowrap uppercase',
        pill,
        className
      )}>
      <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', dot, pulse && 'animate-pulse')} />
      {children}
    </span>
  )
}
