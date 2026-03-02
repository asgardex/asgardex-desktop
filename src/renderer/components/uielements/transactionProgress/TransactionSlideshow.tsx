import { useCallback, useState, useMemo, useEffect } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useObservableState } from 'observable-hooks'

import { ChainflipTransactionTrackingService } from '../../../services/chainflip/transactionTracking'
import { TransactionTrackingService } from '../../../services/thorchain/transactionTracking'
import { ProviderIcon } from '../../swap/ProviderIcon'
import { ChainflipTransactionItem } from './ChainflipTransactionItem'
import { TransactionItem } from './TransactionItem'

export type TransactionSlideshowProps = {
  thorchainTransactionTrackingService: TransactionTrackingService
  mayachainTransactionTrackingService: TransactionTrackingService
  chainflipTransactionTrackingService: ChainflipTransactionTrackingService
  className?: string
}

export const TransactionSlideshow = ({
  thorchainTransactionTrackingService,
  mayachainTransactionTrackingService,
  chainflipTransactionTrackingService,
  className
}: TransactionSlideshowProps) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  // Tick counter to force re-evaluation of activeTransactions when completed txs age out
  const [tick, setTick] = useState(0)

  // Get transactions from all services
  const thorTransactionsRD = useObservableState(thorchainTransactionTrackingService.getTransactions$, RD.initial)
  const mayaTransactionsRD = useObservableState(mayachainTransactionTrackingService.getTransactions$, RD.initial)
  const chainflipTransactionsRD = useObservableState(chainflipTransactionTrackingService.getTransactions$, RD.initial)

  // Minimum time (ms) to keep completed transactions visible in the slideshow
  const COMPLETED_VISIBILITY_MS = 30000

  // Combine transactions, keeping recently completed ones visible
  const activeTransactions = useMemo(() => {
    const thorTransactions = RD.isSuccess(thorTransactionsRD) ? thorTransactionsRD.value : []
    const mayaTransactions = RD.isSuccess(mayaTransactionsRD) ? mayaTransactionsRD.value : []
    const chainflipTransactions = RD.isSuccess(chainflipTransactionsRD) ? chainflipTransactionsRD.value : []

    const allTransactions = [
      ...thorTransactions.map((tx) => ({ ...tx, protocol: 'Thorchain' as const })),
      ...mayaTransactions.map((tx) => ({ ...tx, protocol: 'Mayachain' as const })),
      ...chainflipTransactions.map((tx) => ({ ...tx, txHash: tx.depositChannelId, protocol: 'Chainflip' as const }))
    ]

    const now = Date.now()
    // Show active transactions + recently completed ones (within visibility window)
    return allTransactions.filter(
      (tx) => !tx.isComplete || (tx.completedAt && now - tx.completedAt < COMPLETED_VISIBILITY_MS)
    )
    // tick dependency forces re-evaluation when visibility timer expires
  }, [thorTransactionsRD, mayaTransactionsRD, chainflipTransactionsRD, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  // Schedule a re-render to remove completed transactions once the visibility window expires
  useEffect(() => {
    const recentlyCompleted = activeTransactions.filter((tx) => tx.isComplete && tx.completedAt)
    if (recentlyCompleted.length === 0) return

    // Find the soonest expiry among recently completed txs
    const now = Date.now()
    const soonestExpiry = Math.min(
      ...recentlyCompleted.map((tx) => (tx.completedAt ?? now) + COMPLETED_VISIBILITY_MS - now)
    )

    if (soonestExpiry <= 0) {
      setTick((t) => t + 1)
      return
    }

    const timer = setTimeout(() => setTick((t) => t + 1), soonestExpiry + 100)
    return () => clearTimeout(timer)
  }, [activeTransactions, COMPLETED_VISIBILITY_MS])

  // Reset index if it's out of bounds
  useEffect(() => {
    if (currentIndex >= activeTransactions.length && activeTransactions.length > 0) {
      setCurrentIndex(0)
    }
  }, [activeTransactions.length, currentIndex])

  const handleRemoveTransaction = useCallback(
    (id: string, protocol: 'Thorchain' | 'Mayachain' | 'Chainflip') => {
      if (protocol === 'Thorchain') {
        thorchainTransactionTrackingService.removeTransaction(id)
      } else if (protocol === 'Mayachain') {
        mayachainTransactionTrackingService.removeTransaction(id)
      } else if (protocol === 'Chainflip') {
        chainflipTransactionTrackingService.removeTransaction(id)
      }
    },
    [mayachainTransactionTrackingService, thorchainTransactionTrackingService, chainflipTransactionTrackingService]
  )

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : activeTransactions.length - 1))
  }, [activeTransactions.length])

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < activeTransactions.length - 1 ? prev + 1 : 0))
  }, [activeTransactions.length])

  // Don't show if no active transactions
  if (activeTransactions.length === 0) {
    return null
  }

  const currentTransaction = activeTransactions[currentIndex]
  const protocolIcon = <ProviderIcon protocol={currentTransaction.protocol} className="!h-4 !w-4" />

  return (
    <div className={clsx('rounded-lg border border-gray1 bg-bg0 p-3 dark:border-gray0d dark:bg-bg1d', className)}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-medium tracking-wide text-text2 uppercase dark:text-text2d">Active Swaps</span>
          <span className="rounded bg-turquoise px-1.5 py-0.5 text-xs font-medium text-white">
            {currentIndex + 1}/{activeTransactions.length}
          </span>
        </div>
        {activeTransactions.length > 1 && (
          <div className="flex items-center space-x-1">
            <button
              onClick={handlePrevious}
              className="rounded p-1 text-text2 transition-colors hover:bg-gray0 hover:text-text0 dark:text-text2d dark:hover:bg-gray0d dark:hover:text-text0d">
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <button
              onClick={handleNext}
              className="rounded p-1 text-text2 transition-colors hover:bg-gray0 hover:text-text0 dark:text-text2d dark:hover:bg-gray0d dark:hover:text-text0d">
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Current Transaction */}
      <div>
        {currentTransaction.protocol === 'Chainflip' ? (
          <ChainflipTransactionItem
            key={currentTransaction.id}
            isMini
            protocol={protocolIcon}
            transaction={currentTransaction}
            onRemove={(id) => handleRemoveTransaction(id, currentTransaction.protocol)}
          />
        ) : (
          <TransactionItem
            key={currentTransaction.id}
            protocol={protocolIcon}
            transaction={currentTransaction}
            isMini
            onRemove={(id) => handleRemoveTransaction(id, currentTransaction.protocol)}
          />
        )}
      </div>
    </div>
  )
}
