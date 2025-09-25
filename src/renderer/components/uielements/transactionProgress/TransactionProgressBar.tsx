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
      <div className="w-full bg-gray1 dark:bg-gray1d rounded-full h-2 mb-4">
        <div
          className="bg-turquoise h-2 rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {/* Stage indicators */}
      <div className="flex justify-between items-center">
        {transactionStages.map((stage, index) => (
          <div key={stage.id} className="flex flex-col items-center min-w-0 flex-1">
            {/* Stage circle */}
            <div
              className={clsx(
                'w-8 h-8 rounded-full border-2 flex items-center justify-center mb-2 transition-all duration-200',
                {
                  'bg-turquoise border-turquoise text-white': stage.completed,
                  'bg-yellow-500 border-yellow-500 text-white animate-pulse': stage.current,
                  'bg-gray1 dark:bg-gray1d border-gray1 dark:border-gray1d text-text2 dark:text-text2d':
                    !stage.completed && !stage.current,
                  'opacity-60': stage.optional && !stage.completed && !stage.current
                }
              )}>
              {stage.completed ? (
                <CheckIcon className="w-4 h-4" />
              ) : stage.current ? (
                <ClockIcon className="w-4 h-4" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-current" />
              )}
            </div>

            {/* Stage label */}
            <span
              className={clsx('text-xs text-center font-medium leading-tight', {
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
                  'absolute h-0.5 mt-4 transition-all duration-300',
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
      <div className="text-center mt-2">
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
