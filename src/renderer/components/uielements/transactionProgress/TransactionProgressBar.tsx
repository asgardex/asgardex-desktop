import React from 'react'

import { CheckIcon, ClockIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { TxStages } from '../../../services/thorchain/types'

type TransactionStage = {
  id: string
  label: string
  completed: boolean
  current: boolean
  optional?: boolean
}

export type TransactionProgressBarProps = {
  stages: TxStages | null
  className?: string
}

export const TransactionProgressBar: React.FC<TransactionProgressBarProps> = ({ stages, className }) => {
  const intl = useIntl()

  const getTransactionStages = (txStages: TxStages | null): TransactionStage[] => {
    if (!txStages) {
      return [
        {
          id: 'observed',
          label: intl.formatMessage({ id: 'transaction.stage.observed' }),
          completed: false,
          current: true
        },
        {
          id: 'confirmed',
          label: intl.formatMessage({ id: 'transaction.stage.confirmed' }),
          completed: false,
          current: false
        },
        {
          id: 'finalised',
          label: intl.formatMessage({ id: 'transaction.stage.finalised' }),
          completed: false,
          current: false
        },
        {
          id: 'swapped',
          label: intl.formatMessage({ id: 'transaction.stage.swapped' }),
          completed: false,
          current: false
        },
        {
          id: 'outbound',
          label: intl.formatMessage({ id: 'transaction.stage.outbound' }),
          completed: false,
          current: false,
          optional: true
        },
        {
          id: 'complete',
          label: intl.formatMessage({ id: 'transaction.status.complete' }),
          completed: false,
          current: false
        }
      ]
    }

    const stages: TransactionStage[] = [
      {
        id: 'observed',
        label: intl.formatMessage({ id: 'transaction.stage.observed' }),
        completed: txStages.inboundObserved.completed,
        current: !txStages.inboundObserved.completed
      },
      {
        id: 'confirmed',
        label: intl.formatMessage({ id: 'transaction.stage.confirmed' }),
        completed: txStages.inboundConfirmationCounted.completed,
        current: txStages.inboundObserved.completed && !txStages.inboundConfirmationCounted.completed
      },
      {
        id: 'finalised',
        label: intl.formatMessage({ id: 'transaction.stage.finalised' }),
        completed: txStages.inboundFinalised.completed,
        current: txStages.inboundConfirmationCounted.completed && !txStages.inboundFinalised.completed
      },
      {
        id: 'swapped',
        label: intl.formatMessage({ id: 'transaction.stage.swapped' }),
        completed: txStages.swapFinalised,
        current: txStages.inboundFinalised.completed && !txStages.swapFinalised
      },
      {
        id: 'outbound',
        label: intl.formatMessage({ id: 'transaction.stage.outbound' }),
        completed: txStages.outboundSigned.completed ?? false,
        current: txStages.swapFinalised && !(txStages.outboundSigned.completed ?? false),
        optional: true
      },
      {
        id: 'complete',
        label: intl.formatMessage({ id: 'transaction.status.complete' }),
        completed:
          txStages.swapFinalised && txStages.inboundFinalised.completed && (txStages.outboundSigned.completed ?? false),
        current: false
      }
    ]

    // Set current stage
    const firstIncompleteIndex = stages.findIndex((stage) => !stage.completed)
    if (firstIncompleteIndex !== -1) {
      stages.forEach((stage, index) => {
        stage.current = index === firstIncompleteIndex
      })
    }

    return stages
  }

  const transactionStages = getTransactionStages(stages)
  const completedStages = transactionStages.filter((stage) => stage.completed).length
  const totalStages = transactionStages.length
  const progressPercentage = (completedStages / totalStages) * 100

  return (
    <div className={clsx('w-full', className)}>
      {/* Progress bar */}
      <div className="mb-4 h-2 w-full rounded-full bg-gray1 dark:bg-gray1d">
        <div
          className="h-2 rounded-full bg-turquoise transition-all duration-300 ease-in-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Stage indicators */}
      <div className="flex items-center justify-between">
        {transactionStages.map((stage, index) => (
          <div key={stage.id} className="flex min-w-0 flex-1 flex-col items-center">
            {/* Stage circle */}
            <div
              className={clsx(
                'mb-2 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-200',
                {
                  'border-turquoise bg-turquoise text-white': stage.completed,
                  'animate-pulse border-yellow-500 bg-yellow-500 text-white': stage.current,
                  'border-gray1 bg-gray1 text-text2 dark:border-gray1d dark:bg-gray1d dark:text-text2d':
                    !stage.completed && !stage.current,
                  'opacity-60': stage.optional && !stage.completed && !stage.current
                }
              )}>
              {stage.completed ? (
                <CheckIcon className="h-4 w-4" />
              ) : stage.current ? (
                <ClockIcon className="h-4 w-4" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-current" />
              )}
            </div>

            {/* Stage label */}
            <span
              className={clsx('text-center text-xs leading-tight font-medium', {
                'text-turquoise': stage.completed,
                'text-text1 dark:text-text1d': stage.current,
                'text-text2 dark:text-text2d': !stage.completed && !stage.current,
                'opacity-60': stage.optional && !stage.completed && !stage.current
              })}>
              {stage.label}
            </span>

            {/* Connector line (except for last item) */}
            {index < transactionStages.length - 1 && (
              <div
                className={clsx(
                  'absolute mt-4 h-0.5 transition-all duration-300',
                  stage.completed ? 'bg-turquoise' : 'bg-gray1 dark:bg-gray1d'
                )}
                style={{
                  left: `${((index + 1) / transactionStages.length) * 100}%`,
                  width: `${100 / transactionStages.length}%`,
                  transform: 'translateX(-50%)'
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Progress text */}
      <div className="mt-2 text-center">
        <span className="text-sm text-text2 dark:text-text2d">
          {intl.formatMessage(
            { id: 'transaction.progress.summary' },
            { completed: completedStages, total: totalStages }
          )}
        </span>
      </div>
    </div>
  )
}
