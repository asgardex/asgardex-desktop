import { useCallback, useState } from 'react'

import clsx from 'clsx'

type Props = {
  values: number[]
  labels?: string[]
  activeIndex?: number | null
  className?: string
  strokeClassName?: string
  strokeWidth?: number
  showLastDot?: boolean
}

const WIDTH = 100
const HEIGHT = 40
const PADDING = 3

export const SparkLine = ({
  values,
  labels,
  activeIndex,
  className,
  strokeClassName = 'text-turquoise',
  strokeWidth = 1.5,
  showLastDot = false
}: Props) => {
  const [hovered, setHovered] = useState<number | null>(null)
  const interactive = activeIndex === undefined && !!labels

  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!interactive) return
      const { left, width } = event.currentTarget.getBoundingClientRect()
      const ratio = Math.min(Math.max((event.clientX - left) / width, 0), 1)
      setHovered(Math.round(ratio * (values.length - 1)))
    },
    [interactive, values.length]
  )

  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values.map((value, index) => {
    const x = PADDING + (index / (values.length - 1)) * (WIDTH - PADDING * 2)
    const y = HEIGHT - PADDING - ((value - min) / range) * (HEIGHT - PADDING * 2)
    return { x, y }
  })

  const last = points[points.length - 1]
  const active = activeIndex === undefined ? hovered : activeIndex
  const activePoint = active !== null && active >= 0 && active < points.length ? points[active] : null
  const activeLabel = active !== null && labels ? labels[active] : undefined

  return (
    <div
      className={clsx('relative h-full w-full', strokeClassName, className)}
      onMouseMove={onMouseMove}
      onMouseLeave={interactive ? () => setHovered(null) : undefined}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-full w-full">
        <polyline
          points={points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {showLastDot && !activePoint && (
        <span
          className="pointer-events-none absolute h-[8px] w-[8px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-current"
          style={{ left: `${(last.x / WIDTH) * 100}%`, top: `${(last.y / HEIGHT) * 100}%` }}
        />
      )}
      {activePoint && (
        <>
          {interactive && (
            <span
              className="pointer-events-none absolute top-0 bottom-0 border-l border-dashed border-gray1 dark:border-gray1d"
              style={{ left: `${(activePoint.x / WIDTH) * 100}%` }}
            />
          )}
          <span
            className="pointer-events-none absolute h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-solid border-bg0 bg-current dark:border-bg0d"
            style={{ left: `${(activePoint.x / WIDTH) * 100}%`, top: `${(activePoint.y / HEIGHT) * 100}%` }}
          />
          {activeLabel && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md bg-bg0d/90 px-2 py-1 text-xs whitespace-nowrap text-white shadow-lg"
              style={{ left: `${(activePoint.x / WIDTH) * 100}%`, top: `${(activePoint.y / HEIGHT) * 100}%` }}>
              {activeLabel}
            </div>
          )}
        </>
      )}
    </div>
  )
}
