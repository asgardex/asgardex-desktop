import { useState, useEffect, ReactNode } from 'react'

import { CheckCircleIcon, ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { PaperAirplaneIcon } from '@heroicons/react/24/solid'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { formatSwapTime } from '../../../helpers/timeHelper'
import { ChainflipTrackedTransaction } from '../../../services/chainflip/transactionTracking'
import { CopyLabel } from '../label'
import { ProgressBar } from '../progressBar'

export type ChainflipTransactionItemProps = {
  protocol?: ReactNode
  transaction: ChainflipTrackedTransaction
  onRemove: (id: string) => void
  className?: string
}

export const ChainflipTransactionItem = ({
  protocol,
  transaction,
  onRemove,
  className
}: ChainflipTransactionItemProps) => {
  const intl = useIntl()
  const [isExpanded, setIsExpanded] = useState(false)
  const [isNewlyCompleted, setIsNewlyCompleted] = useState(false)

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
        detail: 'Waiting for blockchain data...',
        urgent: false
      }
    }

    const { stages } = transaction

    // Chainflip-specific status handling
    switch (stages.state) {
      case 'WAITING':
        return {
          text: 'Waiting for deposit',
          detail: null,
          urgent: false
        }
      case 'RECEIVING':
        return {
          text: 'Receiving deposit',
          detail: 'Processing your deposit...',
          urgent: true
        }
      case 'SWAPPING':
        return {
          text: 'Swapping',
          detail: 'Executing swap on Chainflip...',
          urgent: true
        }
      case 'SENDING':
        return {
          text: 'Sending',
          detail: 'Preparing egress transaction...',
          urgent: true
        }
      case 'SENT':
        return {
          text: 'Sent',
          detail: 'Transaction sent to destination',
          urgent: false
        }
      case 'COMPLETED':
        return {
          text: 'Complete',
          detail: 'Swap completed successfully',
          urgent: false
        }
      case 'FAILED':
        return {
          text: 'Failed',
          detail: 'Swap failed',
          urgent: false
        }
      default:
        return {
          text: 'Processing',
          detail: 'Transaction in progress...',
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
        'bg-bg0 dark:bg-bg0d rounded-lg border border-gray1 dark:border-gray1d p-3',
        'transition-all duration-300 ease-in-out',
        {
          'ring-2 ring-turquoise ring-opacity-50 border-turquoise': isNewlyCompleted,
          'shadow-lg': isExpanded
        },
        className
      )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {protocol && <div className="flex-shrink-0">{protocol}</div>}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1">
              <span className="text-xs font-medium text-text1 dark:text-text1d truncate">
                {transaction.fromAsset} → {transaction.toAsset}
              </span>
              {transaction.isComplete && <CheckCircleIcon className="w-3 h-3 text-turquoise flex-shrink-0" />}
              {statusInfo.urgent && !transaction.isComplete && (
                <PaperAirplaneIcon className="w-3 h-3 text-turquoise flex-shrink-0 animate-pulse" />
              )}
            </div>
            <div className="text-xs text-text2 dark:text-text2d mt-0.5 truncate">
              {statusInfo.text}
              {statusInfo.detail && ` - ${statusInfo.detail}`}
            </div>
            <div className="mt-1">
              <ProgressBar percent={progress} className="h-1" />
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
          <span className="text-base font-bold text-text2 dark:text-text2d mr-2">{Math.round(progress)}%</span>
          <button
            onClick={toggleExpanded}
            className="p-1 rounded-md hover:bg-gray1 dark:hover:bg-gray1d transition-colors">
            {isExpanded ? (
              <ChevronUpIcon className="w-3 h-3 text-text2 dark:text-text2d" />
            ) : (
              <ChevronDownIcon className="w-3 h-3 text-text2 dark:text-text2d" />
            )}
          </button>
          <button
            onClick={handleRemove}
            className="p-1 rounded-md hover:bg-error1 dark:hover:bg-error1d transition-colors group">
            <XMarkIcon className="w-3 h-3 text-text2 dark:text-text2d group-hover:text-error0 dark:group-hover:text-error0d" />
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-gray1 dark:border-gray1d space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-text2 dark:text-text2d">Amount:</span>
              <span className="ml-1 text-text1 dark:text-text1d">{transaction.amount}</span>
            </div>
            <div>
              <span className="text-text2 dark:text-text2d">Time:</span>
              <span className="ml-1 text-text1 dark:text-text1d">{formatSwapTime(elapsedTime / 1000)}</span>
            </div>
          </div>
          <div>
            <span className="text-text2 dark:text-text2d">Channel ID:</span>
            <CopyLabel
              textToCopy={transaction.depositChannelId}
              label={transaction.depositChannelId}
              className="ml-1 text-text1 dark:text-text1d text-xs"
            />
          </div>
          {transaction.swapId && (
            <div>
              <span className="text-text2 dark:text-text2d">Swap ID:</span>
              <CopyLabel
                textToCopy={transaction.swapId}
                label={transaction.swapId}
                className="ml-1 text-text1 dark:text-text1d text-xs"
              />
            </div>
          )}
          {transaction.stages?.depositTxHash && (
            <div>
              <span className="text-text2 dark:text-text2d">Deposit Tx:</span>
              <CopyLabel
                textToCopy={transaction.stages.depositTxHash}
                label={transaction.stages.depositTxHash}
                className="ml-1 text-text1 dark:text-text1d text-xs"
              />
            </div>
          )}
          {transaction.stages?.egressTxHash && (
            <div>
              <span className="text-text2 dark:text-text2d">Egress Tx:</span>
              <CopyLabel
                textToCopy={transaction.stages.egressTxHash}
                label={transaction.stages.egressTxHash}
                className="ml-1 text-text1 dark:text-text1d text-xs"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
