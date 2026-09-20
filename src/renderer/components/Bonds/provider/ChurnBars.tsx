import { ReactNode, useState } from 'react'

import clsx from 'clsx'

export type ChurnBar = {
  value: number
  /** tooltip content shown on hover, e.g. "1,498 RUNE · 21 Jun 2026" */
  label?: ReactNode
}

type Props = {
  /** oldest first */
  bars: ChurnBar[]
  highlightLast?: boolean
  /** hovered bar controlled by the parent (shared hover across overlaid charts) */
  activeIndex?: number | null
  onActiveIndexChange?: (index: number | null) => void
  className?: string
}

export const ChurnBars = ({ bars, highlightLast = true, activeIndex, onActiveIndexChange, className }: Props) => {
  const [hovered, setHovered] = useState<number | null>(null)
  const active = activeIndex === undefined ? hovered : activeIndex

  const setActive = (index: number | null) => {
    setHovered(index)
    onActiveIndexChange?.(index)
  }

  const max = Math.max(...bars.map(({ value }) => value), 0)

  return (
    <div className={clsx('flex h-full w-full items-end gap-[3px]', className)}>
      {bars.map((bar, index) => {
        const isLast = index === bars.length - 1
        const height = max > 0 ? Math.max((bar.value / max) * 100, 2) : 2
        const isActive = active === index

        return (
          <div
            key={index}
            className="relative flex h-full flex-1 items-end"
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}>
            <div
              style={{ height: `${height}%` }}
              className={clsx(
                'w-full rounded-t-sm transition-colors',
                isActive ? 'bg-turquoise' : isLast && highlightLast ? 'bg-turquoise/70' : 'bg-turquoise/25'
              )}
            />
            {bar.label && isActive && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-md bg-bg0d/90 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg">
                {bar.label}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
