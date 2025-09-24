import { useCallback, useState, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import SwapIcon from '../../../assets/svg/icon-swap.svg?react'
import ThorChainIcon from '../../../assets/svg/logo-thorchain.svg?react'
import { TransactionTrackingService } from '../../../services/thorchain/transactionTracking'
import { mayaIconT } from '../../icons'
import { Label } from '../label'
import { TransactionItem } from '../transactionProgress/TransactionItem'

export type TransactionQuickDialProps = {
  thorchainTransactionTrackingService: TransactionTrackingService
  mayachainTransactionTrackingService: TransactionTrackingService
  className?: string
}

export const TransactionQuickDial = ({
  thorchainTransactionTrackingService,
  mayachainTransactionTrackingService,
  className
}: TransactionQuickDialProps) => {
  const intl = useIntl()
  const [isExpanded, setIsExpanded] = useState(false)

  // Get transactions from both services
  const thorTransactionsRD = useObservableState(thorchainTransactionTrackingService.getTransactions$, RD.initial)
  const mayaTransactionsRD = useObservableState(mayachainTransactionTrackingService.getTransactions$, RD.initial)

  // Combine and filter active transactions
  const activeTransactions = useMemo(() => {
    const thorTransactions = RD.isSuccess(thorTransactionsRD) ? thorTransactionsRD.value : []
    const mayaTransactions = RD.isSuccess(mayaTransactionsRD) ? mayaTransactionsRD.value : []

    // Combine all transactions and filter for active ones
    const allTransactions = [
      ...thorTransactions.map((tx) => ({ ...tx, protocol: 'Thorchain' as const })),
      ...mayaTransactions.map((tx) => ({ ...tx, protocol: 'Mayachain' as const }))
    ]

    return allTransactions.filter((tx) => !tx.isComplete)
  }, [thorTransactionsRD, mayaTransactionsRD])

  const handleRemoveTransaction = useCallback(
    (id: string, protocol: 'Thorchain' | 'Mayachain') => {
      if (protocol === 'Thorchain') {
        thorchainTransactionTrackingService.removeTransaction(id)
      } else {
        mayachainTransactionTrackingService.removeTransaction(id)
      }
    },
    [mayachainTransactionTrackingService, thorchainTransactionTrackingService]
  )

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  // Don't show if no active transactions
  if (activeTransactions.length === 0) {
    return null
  }

  return (
    <div className={clsx('fixed bottom-4 right-4 z-50', className)}>
      <div
        className={clsx(
          'relative w-14 h-14 rounded-full shadow-lg cursor-pointer',
          'flex items-center justify-center',
          'bg-turquoise transition-all duration-300 ease-in-out'
        )}
        onClick={toggleExpanded}
        onMouseDown={(e) => {
          e.stopPropagation()
        }}>
        {isExpanded ? <XMarkIcon className="w-6 h-6 text-white" /> : <SwapIcon className="w-8 h-8 text-white" />}
        <div className="flex items-center justify-center absolute -top-1 -right-1 w-5 h-5 bg-error0 rounded-full">
          <Label align="center" size="small">
            {activeTransactions.length}
          </Label>
        </div>
      </div>

      {/* Expanded Content Panel */}
      {isExpanded && (
        <div
          className={clsx(
            'absolute bottom-16 right-0 w-80',
            'bg-white dark:bg-bg1d rounded-lg shadow-xl border border-gray0 dark:border-gray0d',
            'transition-all duration-200 ease-out',
            'transform origin-bottom-right',
            'z-40'
          )}>
          {/* Header */}
          <div className="p-3 border-b border-gray0 dark:border-gray0d">
            <div className="flex items-center space-x-2">
              <div className="flex items-center -space-x-1">
                <SwapIcon className="w-4 h-4 text-text0 dark:text-text0d" />
              </div>
              <span className="text-sm font-medium text-text0 dark:text-text0d">
                {intl.formatMessage({ id: 'common.transaction.tracking' })}
              </span>
            </div>
          </div>

          {/* Transaction List */}
          <div className="max-h-96 overflow-y-auto">
            <div className="p-3 space-y-2">
              <div className="text-xs font-medium text-text2 dark:text-text2d uppercase tracking-wide">
                {intl.formatMessage({ id: 'common.transaction.active' })} ({activeTransactions.length})
              </div>

              {activeTransactions.map((transaction) => {
                const protocolIcon =
                  transaction.protocol === 'Mayachain' ? (
                    <img src={mayaIconT} alt="Maya" className="w-3 h-3 rounded-full" />
                  ) : (
                    <ThorChainIcon className="w-3 h-3 [&>*:not(:first-child)]:fill-text2 [&>*:not(:first-child)]:dark:fill-text2d" />
                  )

                return (
                  <TransactionItem
                    key={transaction.id}
                    protocol={protocolIcon}
                    transaction={transaction}
                    onRemove={(id) => handleRemoveTransaction(id, transaction.protocol)}
                  />
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
