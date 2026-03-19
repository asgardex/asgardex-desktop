import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { ApiError } from '../../../../services/wallet/types'
import { ErrorView } from '../../../shared/error'
import { TxTimer } from '../../../uielements/txTimer'

type Props = {
  txRD: RD.RemoteData<ApiError, boolean>
  timerValue: number
  startTime?: number
}

export const TxStatusIndicator = ({ txRD, timerValue, startTime }: Props): JSX.Element => {
  const intl = useIntl()

  return useMemo(
    () => (
      <div className="flex w-full items-center justify-center transition-all duration-300 ease-in-out">
        {FP.pipe(
          txRD,
          RD.fold(
            () => <TxTimer status={true} />,
            () => <TxTimer status={true} maxValue={100} value={timerValue} startTime={startTime} />,
            (error) => (
              <ErrorView
                className="animate-fade-in max-w-full overflow-auto p-2 text-sm leading-normal break-all whitespace-pre-wrap"
                subTitle={error?.msg || intl.formatMessage({ id: 'common.error' })}
              />
            ),
            () => (
              <div className="animate-bounce-in">
                <TxTimer status={false} />
              </div>
            )
          )
        )}
      </div>
    ),
    [intl, startTime, txRD, timerValue]
  )
}
