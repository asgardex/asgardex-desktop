import { useState, useEffect, ReactNode, useMemo } from 'react'

import { ChevronDownIcon, ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { CheckCircleIcon, PaperAirplaneIcon } from '@heroicons/react/24/solid'
import { assetFromString } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { formatSwapTime } from '../../../helpers/timeHelper'
import { TrackedTransaction } from '../../../services/thorchain/transactionTracking'
import { CopyLabel, Label } from '../label'
import { ProgressBar } from '../progressBar'

export type TransactionItemProps = {
  protocol?: ReactNode
  transaction: TrackedTransaction
  onRemove: (id: string) => void
  isMini?: boolean
  className?: string
}

export const TransactionItem = ({ className, isMini, protocol, transaction, onRemove }: TransactionItemProps) => {
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
        detail: 'Waiting for blockchain data...',
        urgent: false
      }
    }

    const { stages } = transaction

    // Detailed status with timing information
    if (!stages?.inboundObserved?.completed) {
      return {
        text: intl.formatMessage({ id: 'transaction.status.observing' }),
        detail: `Waiting for network detection...`,
        urgent: false
      }
    }

    if (!stages?.inboundConfirmationCounted?.completed) {
      const remaining = stages?.inboundConfirmationCounted?.remainingConfirmationSeconds
      if (remaining && remaining > 0) {
        return {
          text: `Confirming... ${formatSwapTime(remaining)}`,
          detail: `${Math.ceil(remaining / 10)} confirmations remaining`,
          urgent: true
        }
      }
      return {
        text: intl.formatMessage({ id: 'transaction.status.confirming.simple' }),
        detail: 'Processing confirmations...',
        urgent: true
      }
    }

    if (!stages?.inboundFinalised?.completed) {
      return {
        text: intl.formatMessage({ id: 'transaction.status.finalising' }),
        detail: 'Finalizing inbound transaction...',
        urgent: false
      }
    }

    if (stages?.swapStatus?.pending) {
      return {
        text: 'Swap pending...',
        detail: 'Waiting in swap queue',
        urgent: true
      }
    }

    // Streaming swap progress - use != null to handle count === 0 correctly
    const streamingCount = stages?.swapStatus?.streaming?.count
    const streamingQuantity = stages?.swapStatus?.streaming?.quantity
    if (streamingCount != null && streamingQuantity != null && streamingQuantity > 0) {
      return {
        text: `Streaming ${streamingCount}/${streamingQuantity}`,
        detail: `Sub-swap ${streamingCount} of ${streamingQuantity}`,
        urgent: true
      }
    }

    if (!stages?.swapFinalised) {
      return {
        text: intl.formatMessage({ id: 'transaction.status.swapping' }),
        detail: 'Processing swap...',
        urgent: true
      }
    }

    // Outbound delay with countdown - only if outbound is required
    const outboundRequired = stages?.outboundSigned?.completed !== undefined
    if (outboundRequired && !(stages?.outboundSigned?.completed ?? false)) {
      const delaySeconds = stages?.outBoundDelay?.remainDelaySeconds
      const delayBlocks = stages?.outBoundDelay?.remainingDelayBlocks

      if (delaySeconds && delaySeconds > 0) {
        return {
          text: `Outbound delay ${formatSwapTime(delaySeconds)}`,
          detail: delayBlocks ? `${delayBlocks} blocks remaining` : 'Security delay active',
          urgent: true
        }
      }

      return {
        text: intl.formatMessage({ id: 'transaction.status.outbound' }),
        detail: 'Preparing outbound transaction...',
        urgent: false
      }
    }

    return {
      text: intl.formatMessage({ id: 'transaction.status.complete' }),
      detail: null,
      urgent: false
    }
  }

  const getProgressPercentage = () => {
    if (!transaction.stages) return 0

    const stages = transaction.stages
    let progress = 0

    // Stage 1: Inbound Observed (16.7%)
    if (stages?.inboundObserved?.completed) {
      progress += 16.7
    }

    // Stage 2: Confirmations (16.7% + partial progress based on remaining time)
    if (stages?.inboundConfirmationCounted?.completed) {
      progress += 16.7
    } else if (stages?.inboundObserved?.completed) {
      // Partial progress based on remaining confirmation time
      const remaining = stages?.inboundConfirmationCounted?.remainingConfirmationSeconds ?? 0
      if (remaining > 0) {
        // Assume max 60 seconds for confirmations, give partial credit
        const maxConfirmTime = 60
        const partialProgress = Math.max(0, (maxConfirmTime - remaining) / maxConfirmTime) * 16.7
        progress += partialProgress
      }
    }

    // Stage 3: Inbound Finalised (16.7%)
    if (stages?.inboundFinalised?.completed) {
      progress += 16.7
    }

    // Stage 4: Swap progress (16.7% + streaming progress)
    if (stages?.swapFinalised) {
      progress += 16.7
    } else {
      // Use != null to handle streaming count === 0 correctly
      const streamingCount = stages?.swapStatus?.streaming?.count
      const streamingQuantity = stages?.swapStatus?.streaming?.quantity
      if (streamingCount != null && streamingQuantity != null && streamingQuantity > 0) {
        // Streaming progress
        const streamingProgress = (streamingCount / streamingQuantity) * 16.7
        progress += streamingProgress
      } else if (stages?.swapStatus?.pending) {
        progress += 8.35 // Half progress when pending
      }
    }

    // Stage 5: Outbound delay (16.7% + partial progress based on remaining delay)
    // Only apply outbound progress if outbound is required (not undefined)
    const outboundRequired = stages?.outboundSigned?.completed !== undefined
    if (!outboundRequired) {
      // No outbound required, give full outbound progress
      progress += 16.7
    } else if (stages?.outboundSigned?.completed) {
      progress += 16.7
    } else if (stages?.swapFinalised) {
      const delaySeconds = stages?.outBoundDelay?.remainDelaySeconds ?? 0
      if (delaySeconds > 0) {
        // Assume max 120 seconds for outbound delay
        const maxDelayTime = 120
        const partialProgress = Math.max(0, (maxDelayTime - delaySeconds) / maxDelayTime) * 16.7
        progress += partialProgress
      } else {
        progress += 8.35 // Half progress when no delay info
      }
    }

    // Stage 6: Complete (16.5%)
    if (transaction.isComplete) {
      progress += 16.5
    }

    return Math.min(100, Math.max(0, progress))
  }

  return (
    <div
      className={clsx(
        'bg-gray0/30 dark:bg-gray0d/30 rounded-lg border transition-all duration-500',
        'border-gray0 dark:border-gray0d',
        isNewlyCompleted && 'animate-pulse',
        className
      )}>
      {/* Header */}
      <div className="p-2">
        {/* First row: asset swap and controls */}
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
              {isExpanded ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
            </button>

            {transaction.isComplete && (
              <button
                onClick={handleRemove}
                className="p-1 text-text2 dark:text-text2d hover:text-error0 dark:hover:text-error0d transition-colors">
                <XMarkIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Second row: status and progress */}
        <div className="flex items-center justify-between">
          {transaction.isComplete ? (
            <div className="flex items-center space-x-1 bg-turquoise/80 dark:bg-turquoise/80 px-2 py-1 rounded-lg">
              <CheckCircleIcon className="w-4 h-4 text-white shrink-0" />
              <Label size="small" color="white" textTransform="uppercase">
                {intl.formatMessage({ id: 'transaction.status.complete' })}
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
                {getRichStatusText().text}
              </div>
              {getRichStatusText().detail && (
                <div className="text-xs text-text2 dark:text-text2d truncate opacity-50">
                  {getRichStatusText().detail}
                </div>
              )}
            </div>
          )}
          <span className="text-base font-bold text-text2 dark:text-text2d ml-2 shrink-0">
            {Math.round(getProgressPercentage())}%
          </span>
        </div>

        {!transaction.isComplete && <ProgressBar className="mt-1" heightPx={4} percent={getProgressPercentage()} />}
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-gray1 dark:border-gray1d p-2">
          {/* Additional details */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-text2 dark:text-text2d">Started:</span>
              <span className="text-text1 dark:text-text1d">
                {new Date(transaction.startTime).toLocaleTimeString()}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-text2 dark:text-text2d">Hash:</span>
              <CopyLabel
                label={`${transaction.txHash.slice(0, 6)}...${transaction.txHash.slice(-4)}`}
                textToCopy={transaction.txHash}
                iconClassName="!w-4 !h-4"
              />
              {/* <span className="text-text1 dark:text-text1d font-mono text-xs break-all">{transaction.txHash}</span> */}
            </div>

            {transaction.completedAt ? (
              <div className="flex justify-between">
                <span className="text-text2 dark:text-text2d">Completed:</span>
                <span className="text-text1 dark:text-text1d">
                  {new Date(transaction.completedAt).toLocaleTimeString()}
                </span>
              </div>
            ) : null}

            {transaction.stages?.inboundConfirmationCounted?.remainingConfirmationSeconds ? (
              <div className="flex justify-between">
                <span className="text-text2 dark:text-text2d">Confirmations:</span>
                <span className="text-text1 dark:text-text1d">
                  {formatSwapTime(transaction.stages.inboundConfirmationCounted.remainingConfirmationSeconds)} remaining
                </span>
              </div>
            ) : null}

            {transaction.stages?.outBoundDelay?.remainDelaySeconds ? (
              <div className="flex justify-between">
                <span className="text-text2 dark:text-text2d">Outbound Delay:</span>
                <span className="text-text1 dark:text-text1d">
                  {formatSwapTime(transaction.stages.outBoundDelay.remainDelaySeconds)} remaining
                </span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
