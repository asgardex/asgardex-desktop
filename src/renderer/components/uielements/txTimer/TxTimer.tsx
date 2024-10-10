import React, { useCallback, useState, useEffect } from 'react'

import theme from '@asgardex/asgardex-theme'
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
  /** Start time to count seconds (optional) Without a startTime no counter will start internally  */
  startTime?: number
  status: boolean
  /** value for progress bar (optional)  */
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
  // internal value if value has not been set
  const [internalValue, setInternalValue] = useState<number>(0)

  // Check if duration has reached the end
  const isEnd = useCallback(() => {
    if (maxSec > 0 && totalDuration >= maxSec) {
      return true
    }
    return (value || internalValue) >= maxValue
  }, [internalValue, maxSec, maxValue, totalDuration, value])

  // Callback for counting
  const countHandler = useCallback(() => {
    if (!value) {
      setInternalValue((current) => {
        if (current < 80) {
          return current + 15
        }
        if (current < 95) {
          return current + 1
        }
        return current
      })
    }
    onChange(value || internalValue)
  }, [internalValue, onChange, value])

  // Interval to inform outside world about counting
  const countInterval = startTime && active && !isEnd() ? interval : INACTIVE_INTERVAL
  useInterval(countHandler, countInterval)

  // Callback for counting time differences
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

  const totalDurationString =
    totalDuration < 10 ? Number(totalDuration).toFixed(1) : Math.round(totalDuration).toString()

  const progressBarValue = value || internalValue

  return (
    <>
      <Styled.TxTimerWrapper className={`txTimer-wrapper ${className}`}>
        <div className="timerchart-icon">
          {!active && <Styled.IconWrapper>{!refunded ? <Styled.SuccessIcon /> : <RefundIcon />}</Styled.IconWrapper>}
        </div>
        {active && (
          <Progress
            type="circle"
            percent={(progressBarValue / maxValue) * 100}
            format={() => `${totalDurationString}s`}
            strokeWidth={7}
            strokeColor={theme.dark.palette.primary[0] || '#23DCC8'}
            trailColor="rgba(242, 243, 243, 0.5)"
            width={120}
          />
        )}
      </Styled.TxTimerWrapper>
    </>
  )
}
