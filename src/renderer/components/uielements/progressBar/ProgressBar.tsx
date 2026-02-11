import { useMemo } from 'react'
import { Transition } from '@headlessui/react'
import clsx from 'clsx'

type CustomProps = {
  withLabel?: boolean
  labelPosition?: 'top' | 'bottom'
  hasError?: boolean
  labels?: string[]
  customInfo?: string
  showInfo?: boolean
  className?: string
  heightPx?: number // optional control of bar height
}

type Props = CustomProps & {
  percent?: number
  strokeLinecap?: 'round' | 'square' | 'butt'
}

export const ProgressBar = ({
  percent = 10,
  withLabel = false,
  labelPosition,
  labels = ['0%', '50%', '100%'],
  strokeLinecap = 'round',
  customInfo = 'info',
  showInfo = false,
  hasError = false,
  className = '',
  heightPx = 8
}: Props): JSX.Element => {
  const safePercent = Number.isFinite(percent) ? percent : 0
  const clamped = Math.max(0, Math.min(100, safePercent))

  const percentLabels = useMemo(
    () => (
      <div className="mb-1 flex w-full items-center justify-between text-xs text-text2 dark:text-text2d">
        {labels.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
    ),
    [labels]
  )

  return (
    <div className={clsx('w-full space-y-1', className)}>
      {withLabel && labelPosition === 'top' && percentLabels}

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className="relative w-full overflow-hidden rounded-full"
        style={{ height: heightPx }}
        title={showInfo ? customInfo : undefined}>
        {/* Track */}
        <div className="absolute inset-0 rounded-full bg-bg2 dark:bg-bg2d" />

        {/* Bar */}
        <div
          className={clsx(
            'relative h-full transition-[width] duration-300 ease-out',
            strokeLinecap === 'round' && 'rounded-full'
          )}
          style={{ width: `${clamped}%` }}>
          <div className="h-full w-full rounded-full bg-gradient-to-r from-[#0068F7] to-[#23DCC8]" />
        </div>

        {/* Error overlay border */}
        {hasError && <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-red-500/70" />}

        {/* Center info */}
        <Transition
          show={!!showInfo}
          enter="transition-opacity duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0">
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden={!showInfo}>
            <span className="px-1 text-[11px] font-medium text-gray-700 dark:text-gray-200">{customInfo}</span>
          </div>
        </Transition>
      </div>

      {withLabel && labelPosition !== 'top' && percentLabels}
    </div>
  )
}
