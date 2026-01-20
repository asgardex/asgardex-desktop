import React, { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { ApiError } from '../../../services/wallet/types'
import { ErrorView } from '../../shared/error'
import { Button, ButtonProps } from '../../uielements/button'
import { Modal } from '../../uielements/modal'
import { TxTimer } from '../../uielements/txTimer'

type Props = {
  txRD: RD.RemoteData<ApiError, boolean>
  timerValue?: number
  title: string
  onClose: FP.Lazy<void>
  onFinish: FP.Lazy<void>
  maxSec?: number
  startTime?: number
  extra?: React.ReactNode
  extraResult?: React.ReactNode
}

export const TxModal = (props: Props): JSX.Element => {
  const { title, txRD, startTime, onClose, onFinish, extra = <></>, extraResult, timerValue = NaN } = props

  const intl = useIntl()

  const renderTimer = useMemo(
    () => (
      <div className="flex w-full items-center justify-center">
        {FP.pipe(
          txRD,
          RD.fold(
            () => <TxTimer status={true} />,
            () => <TxTimer status={true} maxValue={100} value={timerValue} startTime={startTime} />,
            (error) => (
              // Show full error message without truncation
              <ErrorView
                className="max-w-full overflow-auto whitespace-pre-wrap break-all p-2 text-sm leading-normal"
                subTitle={error?.msg || intl.formatMessage({ id: 'common.error' })}
              />
            ),
            () => <TxTimer status={false} />
          )
        )}
      </div>
    ),
    [intl, startTime, txRD, timerValue]
  )

  const renderExtra = useMemo(() => <div className="flex w-full items-center justify-center">{extra}</div>, [extra])
  const renderExtraResult = useMemo(
    () => (extraResult ? <div className="flex items-center justify-center pt-6">{extraResult}</div> : <></>),
    [extraResult]
  )

  const renderResult = useMemo(() => {
    const defaultButtonProps: ButtonProps = {
      color: 'primary',
      disabled: false,
      onClick: onClose,
      sizevalue: 'xnormal',
      round: 'true',
      children: <>{intl.formatMessage({ id: 'common.finish' })}</>
    }

    const buttonProps: ButtonProps = FP.pipe(
      txRD,
      RD.fold<ApiError, boolean, ButtonProps>(
        () => ({ ...defaultButtonProps, disabled: true }),
        () => ({ ...defaultButtonProps, disabled: true }),
        () => ({ ...defaultButtonProps, children: intl.formatMessage({ id: 'common.finish' }) }),
        () => ({ ...defaultButtonProps, onClick: onFinish })
      )
    )

    return (
      <div className="flex flex-col items-center justify-center">
        <Button {...buttonProps} className="mt-6 h-10 w-[300px]" />
        {renderExtraResult}
      </div>
    )
  }, [intl, onClose, onFinish, renderExtraResult, txRD])

  return (
    <Modal panelClassName="max-w-[420px]!" visible title={title} onCancel={onClose}>
      <div className="flex w-full flex-col items-center justify-center border-b border-gray0 pb-8 dark:border-gray0d">
        {renderTimer}
        {renderExtra}
      </div>
      {renderResult}
    </Modal>
  )
}
