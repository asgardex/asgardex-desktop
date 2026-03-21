import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { ApiError } from '../../../../services/wallet/types'

type StepStatus = 'done' | 'active' | 'pending' | 'error'

type Step = {
  label: string
  status: StepStatus
}

type Props = {
  txRD: RD.RemoteData<ApiError, boolean>
  timerValue: number
  startTime?: number
  steps?: string[]
}

const StepIcon = ({ status }: { status: StepStatus }) => {
  switch (status) {
    case 'done':
      return (
        <div className="animate-bounce-in flex h-7 w-7 items-center justify-center rounded-full bg-success/15">
          <CheckIcon className="h-4 w-4 text-success" strokeWidth={2.5} />
        </div>
      )
    case 'active':
      return (
        <div className="relative flex h-7 w-7 items-center justify-center">
          <div className="absolute h-7 w-7 animate-ping rounded-full bg-turquoise/20" />
          <div className="h-3 w-3 rounded-full bg-turquoise" />
        </div>
      )
    case 'error':
      return (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red/15">
          <ExclamationTriangleIcon className="h-4 w-4 text-red" />
        </div>
      )
    case 'pending':
    default:
      return <div className="h-3 w-3 rounded-full bg-gray0 dark:bg-gray0d" />
  }
}

const StepConnector = ({ done }: { done: boolean }) => (
  <div
    className={clsx(
      'mx-auto h-5 w-0.5 transition-colors duration-500',
      done ? 'bg-success/40' : 'bg-gray0 dark:bg-gray0d'
    )}
  />
)

const DEFAULT_STEPS = ['Broadcasting', 'Confirming', 'Complete']

export const TxStatusIndicator = ({ txRD, steps: stepLabels }: Props): JSX.Element => {
  const intl = useIntl()
  const labels = stepLabels && stepLabels.length > 0 ? stepLabels : DEFAULT_STEPS

  const resolvedSteps: Step[] = useMemo(
    () =>
      FP.pipe(
        txRD,
        RD.fold(
          // Initial — all pending
          () => labels.map((label) => ({ label, status: 'pending' as StepStatus })),
          // Pending — first step(s) done, one active, rest pending
          () => {
            // For a 3-step flow: step 1 done, step 2 active, step 3 pending
            return labels.map((label, i) => {
              if (i === 0) return { label, status: 'done' as StepStatus }
              if (i === 1) return { label, status: 'active' as StepStatus }
              return { label, status: 'pending' as StepStatus }
            })
          },
          // Failure — mark last reached step as error
          (error) => {
            return labels.map((label, i) => {
              if (i === 0) return { label, status: 'done' as StepStatus }
              if (i === 1)
                return {
                  label: error?.msg || intl.formatMessage({ id: 'common.error' }),
                  status: 'error' as StepStatus
                }
              return { label, status: 'pending' as StepStatus }
            })
          },
          // Success — all done
          () => labels.map((label) => ({ label, status: 'done' as StepStatus }))
        )
      ),
    [txRD, labels, intl]
  )

  return (
    <div className="flex w-full flex-col items-start px-10 py-4">
      {resolvedSteps.map((step, i) => (
        <div key={i} className="flex flex-col">
          {/* Step row */}
          <div className="flex items-center gap-3">
            <div className="flex w-7 items-center justify-center">
              <StepIcon status={step.status} />
            </div>
            <span
              className={clsx(
                'font-main text-sm transition-colors duration-300',
                step.status === 'done' && 'text-success',
                step.status === 'active' && 'text-text0 dark:text-text0d',
                step.status === 'pending' && 'text-text2 dark:text-text2d',
                step.status === 'error' && 'text-red'
              )}>
              {step.label}
            </span>
          </div>
          {/* Connector line (not after last step) */}
          {i < resolvedSteps.length - 1 && (
            <div className="flex">
              <div className="flex w-7 justify-center">
                <StepConnector done={step.status === 'done'} />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
