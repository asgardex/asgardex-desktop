import { useState, useEffect, ReactNode, useMemo } from 'react'

import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon, ExclamationCircleIcon, PaperAirplaneIcon, XCircleIcon } from '@heroicons/react/24/solid'
import { assetFromString } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { truncateMiddle } from '../../../helpers/stringHelper'
import { formatSwapTime } from '../../../helpers/timeHelper'
import { OneClickTrackedTransaction } from '../../../services/oneclick/transactionTracking'
import { CopyLabel, Label } from '../label'
import { ProgressBar } from '../progressBar'

export type OneClickTransactionItemProps = {
  protocol?: ReactNode
  isMini?: boolean
  transaction: OneClickTrackedTransaction
  onRemove: (id: string) => void
  className?: string
}

export const OneClickTransactionItem = ({
  protocol,
  isMini = false,
  transaction,
  onRemove,
  className
}: OneClickTransactionItemProps) => {
  const intl = useIntl()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isNewlyCompleted, setIsNewlyCompleted] = useState(false)

  const fromAsset = useMemo(() => {
    const asset = assetFromString(transaction.fromAsset)
    if (!asset) return transaction.fromAsset
    if (isMini) return asset.ticker
    return `${asset.chain}.${asset.ticker}`
  }, [transaction.fromAsset, isMini])

  const toAsset = useMemo(() => {
    const asset = assetFromString(transaction.toAsset)
    if (!asset) return transaction.toAsset
    if (isMini) return asset.ticker
    return `${asset.chain}.${asset.ticker}`
  }, [transaction.toAsset, isMini])

  useEffect(() => {
    if (transaction.isComplete && transaction.completedAt) {
      const timeSinceCompletion = Date.now() - transaction.completedAt
      if (timeSinceCompletion < 2000) {
        setIsNewlyCompleted(true)
        const timer = setTimeout(() => setIsNewlyCompleted(false), 2000)
        return () => clearTimeout(timer)
      }
    }
  }, [transaction.isComplete, transaction.completedAt])

  const handleRemove = () => onRemove(transaction.id)
  const toggleExpanded = () => setIsExpanded(!isExpanded)

  const getRichStatusText = () => {
    if (transaction.isComplete) {
      const state = transaction.stages?.state
      if (state === 'REFUNDED') {
        return {
          text: intl.formatMessage({ id: 'oneclick.status.refunded', defaultMessage: 'Refunded' }),
          detail:
            transaction.stages?.refundReason ??
            intl.formatMessage({ id: 'oneclick.status.refunded.detail', defaultMessage: 'Deposit was refunded' }),
          urgent: false
        }
      }
      if (state === 'FAILED') {
        return {
          text: intl.formatMessage({ id: 'oneclick.status.failed', defaultMessage: 'Failed' }),
          detail: intl.formatMessage({ id: 'oneclick.status.failed.detail', defaultMessage: 'Swap failed' }),
          urgent: false
        }
      }
      return {
        text: intl.formatMessage({ id: 'transaction.status.complete' }),
        detail: null,
        urgent: false
      }
    }

    if (!transaction.stages) {
      return {
        text: intl.formatMessage({ id: 'transaction.status.pending' }),
        detail: intl.formatMessage({
          id: 'oneclick.status.pending.detail',
          defaultMessage: 'Waiting for 1Click to see the deposit...'
        }),
        urgent: false
      }
    }

    switch (transaction.stages.state) {
      case 'KNOWN_DEPOSIT_TX':
        return {
          text: intl.formatMessage({ id: 'oneclick.status.knownDeposit', defaultMessage: 'Deposit registered' }),
          detail: intl.formatMessage({
            id: 'oneclick.status.knownDeposit.detail',
            defaultMessage: '1Click has acknowledged your deposit tx'
          }),
          urgent: false
        }
      case 'PENDING_DEPOSIT':
        return {
          text: intl.formatMessage({ id: 'oneclick.status.pendingDeposit', defaultMessage: 'Awaiting confirmation' }),
          detail: intl.formatMessage({
            id: 'oneclick.status.pendingDeposit.detail',
            defaultMessage: 'Waiting for chain confirmations...'
          }),
          urgent: false
        }
      case 'INCOMPLETE_DEPOSIT':
        return {
          text: intl.formatMessage({ id: 'oneclick.status.incomplete', defaultMessage: 'Partial deposit' }),
          detail: intl.formatMessage({
            id: 'oneclick.status.incomplete.detail',
            defaultMessage: 'Less than the quoted amount was received'
          }),
          urgent: true
        }
      case 'PROCESSING':
        return {
          text: intl.formatMessage({ id: 'oneclick.status.processing', defaultMessage: 'Routing' }),
          detail: intl.formatMessage({
            id: 'oneclick.status.processing.detail',
            defaultMessage: 'Solvers are executing the swap...'
          }),
          urgent: true
        }
      default:
        return {
          text: intl.formatMessage({ id: 'oneclick.status.unknown', defaultMessage: 'Processing' }),
          detail: null,
          urgent: false
        }
    }
  }

  const getProgressPercentage = () => {
    if (transaction.isComplete) return 100
    if (!transaction.stages) return 0
    switch (transaction.stages.state) {
      case 'KNOWN_DEPOSIT_TX':
        return 20
      case 'PENDING_DEPOSIT':
        return 40
      case 'INCOMPLETE_DEPOSIT':
        return 50
      case 'PROCESSING':
        return 75
      case 'SUCCESS':
      case 'REFUNDED':
      case 'FAILED':
        return 100
      default:
        return 10
    }
  }

  const statusInfo = getRichStatusText()
  const progress = getProgressPercentage()
  // Freeze the displayed duration once the swap is complete — otherwise it
  // keeps growing on every re-render triggered by other transactions.
  const endTime = transaction.isComplete && transaction.completedAt ? transaction.completedAt : Date.now()
  const elapsedTime = Math.max(0, endTime - transaction.startTime)

  return (
    <div
      className={clsx(
        'rounded-lg border bg-gray0/30 transition-all duration-500 dark:bg-gray0d/30',
        'border-gray0 dark:border-gray0d',
        isNewlyCompleted && 'animate-pulse',
        className
      )}>
      <div className="p-2">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex min-w-0 items-center space-x-1">
            {protocol && protocol}
            <span className="truncate text-sm font-medium text-text1 dark:text-text1d">
              {fromAsset} → {toAsset}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={toggleExpanded}
              className="p-1 text-text2 transition-colors hover:text-text1 dark:text-text2d dark:hover:text-text1d">
              {isExpanded ? (
                <ChevronUpIcon className="h-3 w-3 text-text2 dark:text-text2d" />
              ) : (
                <ChevronDownIcon className="h-3 w-3 text-text2 dark:text-text2d" />
              )}
            </button>
            <button
              onClick={handleRemove}
              className="p-1 text-text2 transition-colors hover:text-error0 dark:text-text2d dark:hover:text-error0d">
              <XMarkIcon className="h-3 w-3 text-text2 dark:text-text2d" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          {transaction.isComplete ? (
            <div
              className={clsx(
                'flex items-center space-x-1 rounded-lg px-2 py-1',
                transaction.stages?.state === 'FAILED'
                  ? 'bg-error0/80 dark:bg-error0d/80'
                  : transaction.stages?.state === 'REFUNDED'
                    ? 'bg-warning0/80 dark:bg-warning0d/80'
                    : 'bg-turquoise/80 dark:bg-turquoise/80'
              )}>
              {transaction.stages?.state === 'FAILED' ? (
                <XCircleIcon className="h-4 w-4 shrink-0 text-white" />
              ) : transaction.stages?.state === 'REFUNDED' ? (
                <ExclamationCircleIcon className="h-4 w-4 shrink-0 text-white" />
              ) : (
                <CheckCircleIcon className="h-4 w-4 shrink-0 text-white" />
              )}
              <Label size="small" color="white" textTransform="uppercase">
                {transaction.stages?.state === 'REFUNDED'
                  ? intl.formatMessage({ id: 'oneclick.refunded', defaultMessage: 'Refunded' })
                  : transaction.stages?.state === 'FAILED'
                    ? intl.formatMessage({ id: 'oneclick.failed', defaultMessage: 'Failed' })
                    : intl.formatMessage({ id: 'oneclick.completed', defaultMessage: 'Completed' })}
              </Label>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <div
                className={clsx(
                  'flex truncate text-xs',
                  statusInfo.urgent ? 'font-medium text-yellow-600 dark:text-yellow-400' : 'text-text2 dark:text-text2d'
                )}>
                <PaperAirplaneIcon className="mr-1 h-4 w-4" />
                {statusInfo.text}
              </div>
              {statusInfo.detail && (
                <div className="truncate text-xs text-text2 opacity-50 dark:text-text2d">{statusInfo.detail}</div>
              )}
            </div>
          )}
          <span className="ml-2 shrink-0 text-base font-bold text-text2 dark:text-text2d">{Math.round(progress)}%</span>
        </div>

        {!transaction.isComplete && <ProgressBar className="mt-1" heightPx={4} percent={progress} />}
      </div>

      {isExpanded && (
        <div className="border-t border-gray1 p-2 text-xs dark:border-gray1d">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-text2 dark:text-text2d">
                {intl.formatMessage({ id: 'oneclick.field.amount', defaultMessage: 'Amount:' })}
              </span>
              <span className="ml-1 text-text1 dark:text-text1d">{transaction.amount}</span>
            </div>
            <div>
              <span className="text-text2 dark:text-text2d">
                {intl.formatMessage({ id: 'oneclick.field.time', defaultMessage: 'Time:' })}
              </span>
              <span className="ml-1 text-text1 dark:text-text1d">{formatSwapTime(elapsedTime / 1000)}</span>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-text2 dark:text-text2d">
              {intl.formatMessage({ id: 'oneclick.field.depositAddress', defaultMessage: 'Deposit:' })}
            </span>
            <CopyLabel
              textToCopy={transaction.depositAddress}
              label={truncateMiddle(transaction.depositAddress, { start: 6, end: 4 })}
              className="ml-1 text-xs text-text1 dark:text-text1d"
              iconClassName="!w-4 !h-4"
            />
          </div>
          {transaction.stages?.originTxHash && (
            <div className="flex justify-between">
              <span className="text-text2 dark:text-text2d">
                {intl.formatMessage({ id: 'oneclick.field.originTx', defaultMessage: 'Origin Tx:' })}
              </span>
              <CopyLabel
                textToCopy={transaction.stages.originTxHash}
                label={truncateMiddle(transaction.stages.originTxHash, { start: 6, end: 4 })}
                className="ml-1 text-xs text-text1 dark:text-text1d"
                iconClassName="!w-4 !h-4"
              />
            </div>
          )}
          {transaction.stages?.destinationTxHash && (
            <div className="flex justify-between">
              <span className="text-text2 dark:text-text2d">
                {intl.formatMessage({ id: 'oneclick.field.destinationTx', defaultMessage: 'Destination Tx:' })}
              </span>
              <CopyLabel
                textToCopy={transaction.stages.destinationTxHash}
                label={truncateMiddle(transaction.stages.destinationTxHash, { start: 6, end: 4 })}
                className="ml-1 text-xs text-text1 dark:text-text1d"
                iconClassName="!w-4 !h-4"
              />
            </div>
          )}
          {transaction.stages?.amountOut && (
            <div className="flex justify-between">
              <span className="text-text2 dark:text-text2d">
                {intl.formatMessage({ id: 'oneclick.field.received', defaultMessage: 'Received:' })}
              </span>
              <span className="ml-1 text-xs text-text1 dark:text-text1d">{transaction.stages.amountOut}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
