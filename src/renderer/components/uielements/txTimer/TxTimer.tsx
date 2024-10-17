import React, { useCallback, useState, useEffect } from 'react'

import { Progress } from 'antd'

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

export const TxTimer: React.FC<Props> = (props): JSX.Element => {
  const {
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
  } = props

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
    <Styled.TxTimerWrapper className={`txTimer-wrapper ${className}`}>
      <div className="timerchart-icon">
        {!active && <Styled.IconWrapper>{!refunded ? <Styled.SuccessIcon /> : <RefundIcon />}</Styled.IconWrapper>}
      </div>
      {active && (
        <Progress
          type="circle"
          percent={(progressBarValue / maxValue) * 100}
          format={() => `${totalDurationString}s`}
          strokeColor="#23DCC8"
          strokeWidth={7}
          strokeLinecap="round"
          trailColor="rgba(242, 243, 243, 0.5)"
          className={hide ? 'hide' : 'timerchart-circular-progressbar'}
          width={120}
        />
      )}
    </Styled.TxTimerWrapper>
  )
}
