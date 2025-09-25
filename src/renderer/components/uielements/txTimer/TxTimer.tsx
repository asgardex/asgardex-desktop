import { useCallback, useState, useEffect } from 'react'

import clsx from 'clsx'

import useInterval, { INACTIVE_INTERVAL } from '../../../hooks/useInterval'
import { RefundIcon } from '../../icons/timerIcons'
import * as Styled from './TxTimer.styles'

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

const CircleProgress = ({
  className = '',
  percent, // 0..100
  size = 120, // px
  strokeWidth = 7, // px
  strokeColor = '#0068F7',
  trailColor = 'rgba(242, 243, 243, 0.5)',
  strokeLinecap = 'round' as 'round' | 'butt' | 'square',
  children, // centered content (timer label)
  ariaLabel
}: {
  className?: string
  percent: number
  size?: number
  strokeWidth?: number
  strokeColor?: string
  trailColor?: string
  strokeLinecap?: 'round' | 'butt' | 'square'
  children?: React.ReactNode
  ariaLabel?: string
}) => {
  const clamped = Math.max(0, Math.min(100, percent))
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const dash = c
  const offset = c * (1 - clamped / 100)

  return (
    <div
      className={clsx('relative inline-block', className)}
      style={{ width: size, height: size }}
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {/* trail */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trailColor} strokeWidth={strokeWidth} />
        {/* progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap={strokeLinecap}
          strokeDasharray={dash}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>

      {/* center content */}
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
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
    if (maxSec > 0 && totalDuration >= maxSec) {
      return true
    }
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

  const hide = isEnd() && !active
  const totalDurationString = totalDuration < 10 ? totalDuration.toFixed(1) : Math.round(totalDuration).toString()
  const progressBarValue = value || internalValue

  return (
    <Styled.TxTimerWrapper className={clsx('txTimer-wrapper', className)}>
      <div className="timerchart-icon">
        {!active && <Styled.IconWrapper>{!refunded ? <Styled.SuccessIcon /> : <RefundIcon />}</Styled.IconWrapper>}
      </div>
      {active && (
        <CircleProgress
          percent={(progressBarValue / maxValue) * 100}
          strokeColor="#0068F7"
          strokeWidth={7}
          strokeLinecap="round"
          trailColor="rgba(242, 243, 243, 0.5)"
          className={hide ? 'hide' : 'timerchart-circular-progressbar'}
          size={120}>
          <Styled.TimerLabel>{totalDurationString}s</Styled.TimerLabel>
        </CircleProgress>
      )}
    </Styled.TxTimerWrapper>
  )
}
