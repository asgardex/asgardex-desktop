import { useEffect, useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { function as FP, array as A, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { Label } from '../label'
import { formatFee } from './Fees.helper'
import { UIFeesRD } from './Fees.types'

export type Props = {
  fees: UIFeesRD
  reloadFees?: () => void
  disabled?: boolean
  className?: string
}

export const Fees = ({ fees, reloadFees, disabled = false, className }: Props) => {
  const intl = useIntl()

  const prevFeesRef = useRef<O.Option<string>>(O.none)

  const formattedFees = FP.pipe(
    fees,
    RD.map((fees) =>
      FP.pipe(
        fees,
        A.map(formatFee),
        A.reduceWithIndex(
          intl.formatMessage({ id: fees.length > 1 ? 'common.fees.estimated' : 'common.fee.estimated' }),
          (index, acc, cur) => {
            return index === 0 ? `${acc}: ${cur}` : `${acc} + ${cur}`
          }
        )
      )
    )
  )

  const oFees: O.Option<string> = useMemo(() => FP.pipe(formattedFees, RD.toOption), [formattedFees])

  // Store latest fees as `ref`
  // needed to display previous fee while reloading
  useEffect(() => {
    FP.pipe(
      oFees,
      O.map((fees) => (prevFeesRef.current = O.some(fees)))
    )
  }, [oFees])

  const feesFormattedValue = useMemo(
    () =>
      FP.pipe(
        formattedFees,
        RD.fold(
          () => '...',
          () =>
            // show previous fees while re-loading
            FP.pipe(
              prevFeesRef.current,
              O.map((fees) => fees),
              O.getOrElse(() => '...')
            ),
          (error) => `${intl.formatMessage({ id: 'common.error' })}: ${error.message}`,
          FP.identity
        )
      ),
    [formattedFees, intl]
  )

  const isError = RD.isFailure(fees)
  const isLoading = RD.isPending(fees)

  return (
    <div className={clsx('flex items-center space-x-2 text-text0 dark:text-text0d', className)}>
      {reloadFees && (
        <div
          onClick={(e) => {
            e.preventDefault()
            if (!isLoading && !disabled) reloadFees()
          }}
          className={clsx(
            'flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-turquoise dark:border-turquoise',
            'transition-colors duration-200',
            'hover:bg-gray-100 hover:dark:bg-gray-800',
            (isLoading || disabled) && 'pointer-events-none cursor-not-allowed opacity-50'
          )}>
          <ArrowPathIcon className={clsx('h-3 w-3 text-text0 dark:text-text0d', isLoading && 'animate-spin')} />
        </div>
      )}
      <Label color={isError ? 'error' : isLoading ? 'input' : 'normal'} textTransform="uppercase">
        {feesFormattedValue}
      </Label>
    </div>
  )
}
