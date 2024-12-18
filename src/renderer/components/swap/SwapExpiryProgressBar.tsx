import React, { useState, useEffect, useMemo } from 'react'

import { QuoteSwap as QuoteSwapProtocol } from '@xchainjs/xchain-aggregator'
import * as O from 'fp-ts/Option'

import { ProgressBar } from '../uielements/progressBar'

interface SwapExpiryProgressBarProps {
  oQuoteProtocol: O.Option<QuoteSwapProtocol>
  swapExpiry: Date
}

const SwapExpiryProgressBar: React.FC<SwapExpiryProgressBarProps> = ({ oQuoteProtocol, swapExpiry }) => {
  const [currentDate, setCurrentDate] = useState(new Date())

  // Update the current date every second
  useEffect(() => {
    if (O.isNone(oQuoteProtocol)) return

    const timer = setInterval(() => {
      setCurrentDate(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [oQuoteProtocol])

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
