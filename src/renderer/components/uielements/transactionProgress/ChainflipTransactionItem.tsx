import { useState, useEffect, ReactNode, useMemo } from 'react'

import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid'
import { assetFromString } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { truncateMiddle } from '../../../helpers/stringHelper'
import { formatSwapTime } from '../../../helpers/timeHelper'
import { ChainflipTrackedTransaction } from '../../../services/chainflip/transactionTracking'
import { CopyLabel, Label } from '../label'
import { ProgressBar } from '../progressBar'

export type ChainflipTransactionItemProps = {
  protocol?: ReactNode
  isMini?: boolean
  transaction: ChainflipTrackedTransaction
  onRemove: (id: string) => void
  className?: string
}

export const ChainflipTransactionItem = ({
  protocol,
  isMini = false,
  transaction,
  onRemove,
  className
}: ChainflipTransactionItemProps) => {
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

  // Detect when transaction becomes complete for animation
  useEffect(() => {
    if (transaction.isComplete && transaction.completedAt) {
      const timeSinceCompletion = Date.now() - transaction.completedAt
      // Show animation if completed within last 2 seconds
      if (timeSinceCompletion < 2000) {
        setIsNewlyCompleted(true)
        const timer = setTimeout(() => setIsNewlyCompleted(false), 2000)
        return () => clearTimeout(timer)
      }
    }
  }, [transaction.isComplete, transaction.completedAt])

  const handleRemove = () => {
    onRemove(transaction.id)
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  const getRichStatusText = () => {
    if (transaction.isComplete) {
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
          id: 'chainflip.status.pending.detail',
          defaultMessage: 'Waiting for blockchain data...'
        }),
        urgent: false
      }
    }

    const { stages } = transaction

    // Chainflip-specific status handling
    switch (stages.state) {
      case 'WAITING':
        return {
          text: intl.formatMessage({ id: 'chainflip.status.waiting', defaultMessage: 'Waiting for deposit' }),
          detail: null,
          urgent: false
        }
      case 'RECEIVING':
        return {
          text: intl.formatMessage({ id: 'chainflip.status.receiving', defaultMessage: 'Receiving deposit' }),
          detail: intl.formatMessage({
            id: 'chainflip.status.receiving.detail',
            defaultMessage: 'Processing your deposit...'
          }),
          urgent: true
        }
      case 'SWAPPING':
        return {
          text: intl.formatMessage({ id: 'chainflip.status.swapping', defaultMessage: 'Swapping' }),
          detail: intl.formatMessage({
            id: 'chainflip.status.swapping.detail',
            defaultMessage: 'Executing swap on Chainflip...'
          }),
          urgent: true
        }
      case 'SENDING':
        return {
          text: intl.formatMessage({ id: 'chainflip.status.sending', defaultMessage: 'Sending' }),
          detail: intl.formatMessage({
            id: 'chainflip.status.sending.detail',
            defaultMessage: 'Preparing egress transaction...'
          }),
          urgent: true
        }
      case 'SENT':
        return {
          text: intl.formatMessage({ id: 'chainflip.status.sent', defaultMessage: 'Sent' }),
          detail: intl.formatMessage({
            id: 'chainflip.status.sent.detail',
            defaultMessage: 'Transaction sent to destination'
          }),
          urgent: false
        }
      case 'COMPLETED':
        return {
          text: intl.formatMessage({ id: 'chainflip.status.complete', defaultMessage: 'Complete' }),
          detail: intl.formatMessage({
            id: 'chainflip.status.complete.detail',
            defaultMessage: 'Swap completed successfully'
          }),
          urgent: false
        }
      case 'FAILED':
        return {
          text: intl.formatMessage({ id: 'chainflip.status.failed', defaultMessage: 'Failed' }),
          detail: intl.formatMessage({ id: 'chainflip.status.failed.detail', defaultMessage: 'Swap failed' }),
          urgent: false
        }
      default:
        return {
          text: intl.formatMessage({ id: 'chainflip.status.processing', defaultMessage: 'Processing' }),
          detail: intl.formatMessage({
            id: 'chainflip.status.processing.detail',
            defaultMessage: 'Transaction in progress...'
          }),
          urgent: false
        }
    }
  }

  const getProgressPercentage = () => {
    if (transaction.isComplete) return 100
    if (!transaction.stages) return 0

    const { stages } = transaction
    switch (stages.state) {
      case 'WAITING':
        return 10
      case 'RECEIVING':
        return 25
      case 'SWAPPING':
        return 50
      case 'SENDING':
        return 75
      case 'SENT':
        return 90
      case 'COMPLETED':
        return 100
      case 'FAILED':
        return 100
      default:
        return 0
    }
  }

  const statusInfo = getRichStatusText()
  const progress = getProgressPercentage()
  const elapsedTime = Date.now() - transaction.startTime

  return (
    <div
      className={clsx(
        'bg-gray0/30 dark:bg-gray0d/30 rounded-lg border transition-all duration-500',
        'border-gray0 dark:border-gray0d',
        isNewlyCompleted && 'animate-pulse',
        className
      )}>
      <div className="p-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center space-x-1 min-w-0">
            {protocol && protocol}
            <span className="text-sm font-medium text-text1 dark:text-text1d truncate">
              {fromAsset} → {toAsset}
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={toggleExpanded}
              className="p-1 text-text2 dark:text-text2d hover:text-text1 dark:hover:text-text1d transition-colors">
              {isExpanded ? (
                <ChevronUpIcon className="w-3 h-3 text-text2 dark:text-text2d" />
              ) : (
                <ChevronDownIcon className="w-3 h-3 text-text2 dark:text-text2d" />
              )}
            </button>
            <button
              onClick={handleRemove}
              className="p-1 text-text2 dark:text-text2d hover:text-error0 dark:hover:text-error0d transition-colors">
              <XMarkIcon className="w-3 h-3 text-text2 dark:text-text2d group-hover:text-error0 dark:group-hover:text-error0d" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          {transaction.isComplete ? (
            <div className="flex items-center space-x-1 bg-turquoise/80 dark:bg-turquoise/80 px-2 py-1 rounded-lg">
              <CheckCircleIcon className="w-4 h-4 text-white shrink-0" />
              <Label size="small" color="white" textTransform="uppercase">
                {intl.formatMessage({ id: 'chainflip.completed', defaultMessage: 'Completed' })}
              </Label>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <div
                className={clsx(
                  'flex text-xs truncate',
                  getRichStatusText().urgent
                    ? 'text-yellow-600 dark:text-yellow-400 font-medium'
                    : 'text-text2 dark:text-text2d'
                )}>
                <PaperAirplaneIcon className="w-4 h-4 mr-1" />
                {statusInfo.text}
              </div>
              {statusInfo.detail && (
                <div className="text-xs text-text2 dark:text-text2d truncate opacity-50">{statusInfo.detail}</div>
              )}
            </div>
          )}
          <span className="text-base font-bold text-text2 dark:text-text2d ml-2 shrink-0">{Math.round(progress)}%</span>
        </div>

        {!transaction.isComplete && <ProgressBar className="mt-1" heightPx={4} percent={progress} />}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray1 dark:border-gray1d p-2 text-xs">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-text2 dark:text-text2d">
                {intl.formatMessage({ id: 'chainflip.field.amount', defaultMessage: 'Amount:' })}
              </span>
              <span className="ml-1 text-text1 dark:text-text1d">{transaction.amount}</span>
            </div>
            <div>
              <span className="text-text2 dark:text-text2d">
                {intl.formatMessage({ id: 'chainflip.field.time', defaultMessage: 'Time:' })}
              </span>
              <span className="ml-1 text-text1 dark:text-text1d">{formatSwapTime(elapsedTime / 1000)}</span>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-text2 dark:text-text2d">
              {intl.formatMessage({ id: 'chainflip.field.channelId', defaultMessage: 'Channel ID:' })}
            </span>
            <CopyLabel
              textToCopy={transaction.depositChannelId}
              label={transaction.depositChannelId}
              className="ml-1 text-text1 dark:text-text1d text-xs"
              iconClassName="!w-4 !h-4"
            />
          </div>
          {transaction.swapId && (
            <div className="flex justify-between">
              <span className="text-text2 dark:text-text2d">
                {intl.formatMessage({ id: 'chainflip.field.swapId', defaultMessage: 'Swap ID:' })}
              </span>
              <CopyLabel
                textToCopy={transaction.swapId}
                label={transaction.swapId}
                className="ml-1 text-text1 dark:text-text1d text-xs"
                iconClassName="!w-4 !h-4"
              />
            </div>
          )}
          {transaction.stages?.depositTxHash && (
            <div className="flex justify-between">
              <span className="text-text2 dark:text-text2d">
                {intl.formatMessage({ id: 'chainflip.field.depositTx', defaultMessage: 'Deposit Tx:' })}
              </span>
              <CopyLabel
                textToCopy={transaction.stages.depositTxHash}
                label={truncateMiddle(transaction.stages.depositTxHash, { start: 6, end: 4 })}
                className="ml-1 text-text1 dark:text-text1d text-xs"
                iconClassName="!w-4 !h-4"
              />
            </div>
          )}
          {transaction.stages?.egressTxHash && (
            <div className="flex justify-between">
              <span className="text-text2 dark:text-text2d">
                {intl.formatMessage({ id: 'chainflip.field.egressTx', defaultMessage: 'Egress Tx:' })}
              </span>
              <CopyLabel
                textToCopy={transaction.stages.egressTxHash}
                label={truncateMiddle(transaction.stages.egressTxHash)}
                className="ml-1 text-text1 dark:text-text1d text-xs"
                iconClassName="!w-4 !h-4"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
