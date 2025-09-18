import React from 'react'

import * as RD from '@devexperts/remote-data-ts'
import clsx from 'clsx'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import ThorChainIcon from '../../../assets/svg/logo-thorchain.svg?react'
import { TransactionTrackingService } from '../../../services/thorchain/transactionTracking'
import { mayaIconT } from '../../icons'
import { TransactionItem } from './TransactionItem'

export type TransactionTrackerProps = {
  transactionTrackingService: TransactionTrackingService
  className?: string
  protocol?: 'Thorchain' | 'Mayachain'
}

export const TransactionTracker: React.FC<TransactionTrackerProps> = ({
  transactionTrackingService,
  className,
  protocol = 'Thorchain'
}) => {
  const intl = useIntl()

  const transactionsRD = useObservableState(transactionTrackingService.getTransactions$, RD.initial)

  const handleRemoveTransaction = (id: string) => {
    transactionTrackingService.removeTransaction(id)
  }

  if (RD.isInitial(transactionsRD) || RD.isPending(transactionsRD)) {
    return (
      <div className={clsx('p-3', className)}>
        <div className="text-sm text-text2 dark:text-text2d">
          {intl.formatMessage({ id: 'common.transaction.loading' })}
        </div>
      </div>
    )
  }

  if (RD.isFailure(transactionsRD)) {
    return (
      <div className={clsx('p-3', className)}>
        <div className="text-sm text-error0 dark:text-error0d">
          {intl.formatMessage({ id: 'common.transaction.failed' })}
        </div>
      </div>
    )
  }

  const transactions = transactionsRD.value

  if (transactions.length === 0) {
    return null // Don't show anything when no transactions
  }

  const activeTransactions = transactions.filter((tx) => !tx.isComplete)
  const completedTransactions = transactions.filter((tx) => tx.isComplete)

  const protocolIcon =
    protocol === 'Mayachain' ? (
      <img src={mayaIconT} alt="Maya" className="w-3 h-3" />
    ) : (
      <ThorChainIcon className="w-3 h-3 [&>*:not(:first-child)]:fill-text2 [&>*:not(:first-child)]:dark:fill-text2d" />
    )

  const protocolLabel = protocol === 'Mayachain' ? 'Maya' : 'THORChain'

  return (
    <div className={clsx('rounded-lg border border-gray1 dark:border-gray1d bg-bg1 dark:bg-bg1d', className)}>
      {/* Header */}
      <div className="p-2 border-b border-gray1 dark:border-gray1d">
        <div className="flex items-center space-x-2">
          {protocolIcon}
          <span className="text-xs font-medium text-text1 dark:text-text1d">
            {protocolLabel} {intl.formatMessage({ id: 'common.transaction.tracking' })}
          </span>
          {activeTransactions.length > 0 && (
            <span className="bg-turquoise text-white text-xs px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
              {activeTransactions.length}
            </span>
          )}
        </div>
      </div>

      {/* Active transactions */}
      {activeTransactions.length > 0 && (
        <div className="p-2 space-y-2">
          <div className="text-xs font-medium text-text2 dark:text-text2d uppercase tracking-wide">
            {intl.formatMessage({ id: 'common.transaction.active' })}
          </div>
          {activeTransactions.map((transaction) => (
            <TransactionItem key={transaction.id} transaction={transaction} onRemove={handleRemoveTransaction} />
          ))}
        </div>
      )}

      {/* Completed transactions */}
      {completedTransactions.length > 0 && (
        <div className="p-2 space-y-2 border-t border-gray1 dark:border-gray1d">
          <div className="text-xs font-medium text-text2 dark:text-text2d uppercase tracking-wide">
            {intl.formatMessage({ id: 'common.transaction.completed' })}
          </div>
          {completedTransactions.map((transaction) => (
            <TransactionItem key={transaction.id} transaction={transaction} onRemove={handleRemoveTransaction} />
          ))}
        </div>
      )}
    </div>
  )
}
