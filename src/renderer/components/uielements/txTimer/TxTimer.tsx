import { useCallback, useState, useEffect } from 'react'

import { CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

import useInterval, { INACTIVE_INTERVAL } from '../../../hooks/useInterval'

export type Props = {
  className?: string
  interval?: number
  maxSec?: number
  maxValue?: number
  maxDuration?: number
  refunded?: boolean
  startTime?: number
  status: boolean
  value?: number
  onChange?: (_: number) => void
  onEnd?: () => void
}

const SIZE = 88
const STROKE = 4

const ProgressRing = ({ percent, active }: { percent: number; active: boolean }) => {
  const r = (SIZE - STROKE) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, percent))
  const offset = c * (1 - clamped / 100)

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
      {/* Trail */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={STROKE}
        className="text-gray0 dark:text-gray0d"
      />
      {/* Progress arc */}
      {active && (
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={r}
          fill="none"
          stroke="url(#progress-gradient)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      )}
      <defs>
        <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--color-turquoise)" />
          <stop offset="100%" stopColor="var(--color-cyanblue)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export const TxTimer = ({
  status = false,
  value = NaN,
  maxValue = 100,
  maxSec = 0,
  startTime = NaN,
  onChange = () => {},
  interval = 1000,
  maxDuration = 100,
  refunded = false,
  onEnd = () => {},
  className = ''
}: Props): JSX.Element => {
  const [active, setActive] = useState(true)
  const [totalDuration, setTotalDuration] = useState<number>(0)
  const [internalValue, setInternalValue] = useState<number>(0)

  const isEnd = useCallback(() => {
    if (maxSec > 0 && totalDuration >= maxSec) return true
    return (value || internalValue) >= maxValue
  }, [internalValue, maxSec, maxValue, totalDuration, value])

  const countHandler = useCallback(() => {
    if (!value) {
      setInternalValue((current) => {
        if (current < 80) return current + 15
        if (current < 95) return current + 1
        return current
      })
    }
    onChange(value || internalValue)
  }, [internalValue, onChange, value])

  const countInterval = startTime && active && !isEnd() ? interval : INACTIVE_INTERVAL
  useInterval(countHandler, countInterval)

  const countSecHandler = useCallback(() => {
    const diff = (Date.now() - startTime) / 1000
    setTotalDuration(diff)
  }, [startTime])

  const countSecInterval = startTime && active && !isEnd() ? 100 : INACTIVE_INTERVAL
  useInterval(countSecHandler, countSecInterval)

  const handleEndTimer = useCallback(() => {
    onEnd()
    setTotalDuration(0)
    setActive(false)
  }, [onEnd])

  useEffect(() => {
    if (isEnd() && active) {
      const id = setTimeout(handleEndTimer, maxDuration)
      return () => clearTimeout(id)
    }
  }, [handleEndTimer, isEnd, active, maxDuration])

  useEffect(() => {
    setActive(status)
  }, [status])

  useEffect(() => {
    if (isEnd() || !active) {
      setTotalDuration(0)
    }
  }, [active, isEnd])

  const progressBarValue = value || internalValue
  const percent = (progressBarValue / maxValue) * 100
  const totalDurationString = totalDuration < 10 ? totalDuration.toFixed(1) : Math.round(totalDuration).toString()

  // ── Active / pending state ────────────────────────────────────────
  if (active) {
    return (
      <div className={clsx('relative inline-flex items-center justify-center', className)}>
        {/* Subtle outer glow while active */}
        <div
          className="absolute inset-0 animate-pulse rounded-full bg-turquoise/10"
          style={{ width: SIZE, height: SIZE }}
        />

        <ProgressRing percent={percent} active />

        {/* Center content */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ width: SIZE, height: SIZE }}>
          <span className="font-main-semi-bold text-xl text-text0 tabular-nums dark:text-text0d">
            {totalDurationString}
          </span>
          <span className="font-main text-[10px] tracking-wider text-text2 uppercase dark:text-text2d">sec</span>
        </div>
      </div>
    )
  }

  // ── Completed state (success / refunded) ──────────────────────────
  return (
    <div className={clsx('relative inline-flex items-center justify-center', className)}>
      <div
        className={clsx(
          'flex items-center justify-center rounded-full transition-all duration-500',
          refunded ? 'bg-red/10' : 'bg-success/15'
        )}
        style={{ width: SIZE, height: SIZE }}>
        <div
          className={clsx(
            'animate-bounce-in flex items-center justify-center rounded-full',
            refunded ? 'bg-red/20' : 'bg-success/25'
          )}
          style={{ width: SIZE * 0.7, height: SIZE * 0.7 }}>
          {refunded ? (
            <ArrowPathIcon className="h-7 w-7 text-red" />
          ) : (
            <CheckIcon className="h-7 w-7 text-success" strokeWidth={2.5} />
          )}
        </div>
      </div>
    </div>
  )
}
