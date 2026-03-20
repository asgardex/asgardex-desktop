import * as RD from '@devexperts/remote-data-ts'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { ApiError } from '../../../../services/wallet/types'
import { TxTimer } from '../../../uielements/txTimer'

type Props = {
  txRD: RD.RemoteData<ApiError, boolean>
  timerValue: number
  startTime?: number
}

export const TxStatusIndicator = ({ txRD, timerValue, startTime }: Props): JSX.Element => {
  const intl = useIntl()

  return (
    <div className="flex w-full flex-col items-center justify-center gap-3 py-4">
      {FP.pipe(
        txRD,
        RD.fold(
          // Initial
          () => <TxTimer status={true} />,
          // Pending
          () => <TxTimer status={true} maxValue={100} value={timerValue} startTime={startTime} />,
          // Failure
          (error) => (
            <div className="animate-fade-in flex w-full flex-col items-center gap-3">
              <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-red/10">
                <div className="animate-bounce-in flex h-[62px] w-[62px] items-center justify-center rounded-full bg-red/20">
                  <ExclamationTriangleIcon className="h-7 w-7 text-red" />
                </div>
              </div>
              <p className="max-w-full px-4 text-center font-main text-sm leading-relaxed break-words text-text2 dark:text-text2d">
                {error?.msg || intl.formatMessage({ id: 'common.error' })}
              </p>
            </div>
          ),
          // Success
          () => (
            <div className="animate-bounce-in">
              <TxTimer status={false} />
            </div>
          )
        )
      )}
    </div>
  )
}
