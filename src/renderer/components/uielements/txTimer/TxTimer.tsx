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

  // ── Active / pending ──────────────────────────────────────────────
  if (active) {
    return (
      <div className={clsx('flex items-center justify-center', className)}>
        <div className="relative flex h-10 w-10 items-center justify-center">
          {/* Spinning ring */}
          <svg className="h-10 w-10 animate-spin" viewBox="0 0 40 40">
            <circle
              cx="20"
              cy="20"
              r="17"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-gray0 dark:text-gray0d"
            />
            <circle
              cx="20"
              cy="20"
              r="17"
              fill="none"
              stroke="url(#spinner-gradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 17}
              strokeDashoffset={2 * Math.PI * 17 * 0.7}
              className="origin-center -rotate-90"
            />
            <defs>
              <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--color-turquoise)" />
                <stop offset="100%" stopColor="var(--color-cyanblue)" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    )
  }

  // ── Completed (success / refunded) ────────────────────────────────
  return (
    <div className={clsx('flex items-center justify-center', className)}>
      <div
        className={clsx(
          'animate-bounce-in flex h-10 w-10 items-center justify-center rounded-full',
          refunded ? 'bg-red/15' : 'bg-success/15'
        )}>
        {refunded ? (
          <ArrowPathIcon className="h-5 w-5 text-red" />
        ) : (
          <CheckIcon className="h-5 w-5 text-success" strokeWidth={2.5} />
        )}
      </div>
    </div>
  )
}
