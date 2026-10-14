import { useState, useEffect, useMemo } from 'react'

import type { QuoteSwap as QuoteSwapProtocol } from '@xchainjs/xchain-aggregator'
import { option as O } from 'fp-ts'

import { ProgressBar } from '../uielements/progressBar'

interface SwapExpiryProgressBarProps {
  oQuoteProtocol?: O.Option<QuoteSwapProtocol>
  swapExpiry: Date
  /** When set, overrides the quote option. Trade swaps have no aggregator quote object. */
  active?: boolean
}

const SwapExpiryProgressBar = ({ oQuoteProtocol, swapExpiry, active }: SwapExpiryProgressBarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const shouldTick = active ?? (oQuoteProtocol ? O.isSome(oQuoteProtocol) : true)

  // Update the current date every second. Isolated here so the swap form does not rerender each tick.
  useEffect(() => {
    if (!shouldTick) return

    const timer = setInterval(() => {
      setCurrentDate(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [shouldTick])

  // Calculate the progress and render the expiry label
  const renderSwapExpiry = useMemo(() => {
    const quoteValidTime = 15 * 60 * 1000 // 15 minutes in milliseconds
    const remainingTime = swapExpiry.getTime() - currentDate.getTime()
    const remainingTimeInMinutes = Math.floor(remainingTime / (60 * 1000))

    const progress = Math.max(0, (remainingTime / quoteValidTime) * 100)
    const expiryLabel =
      remainingTimeInMinutes < 0 ? `Quote Expired` : `Quote expiring in ${remainingTimeInMinutes} minutes`

    return (
      <ProgressBar
        key={'Quote expiry progress bar'}
        percent={progress}
        withLabel={true}
        labels={[`${expiryLabel}`, ``]}
      />
    )
  }, [swapExpiry, currentDate])

  return <>{renderSwapExpiry}</>
}

export default SwapExpiryProgressBar
