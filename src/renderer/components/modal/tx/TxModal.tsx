import React, { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { ApiError } from '../../../services/wallet/types'
import { ButtonProps as UIButtonProps } from '../../uielements/button'
import { Modal } from '../../uielements/modal'
import { TxTimer } from '../../uielements/txTimer'
import * as Styled from './TxModal.styles'

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
      <div className="w-full flex items-center justify-center">
        {FP.pipe(
          txRD,
          RD.fold(
            () => <TxTimer status={true} />,
            () => <TxTimer status={true} maxValue={100} value={timerValue} startTime={startTime} />,
            (error) => (
              // Show full error message without truncation
              <Styled.ErrorView
                className="bg-bg1 dark:bg-bg1d"
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

  const renderExtra = useMemo(() => <div className="w-full flex items-center justify-center">{extra}</div>, [extra])
  const renderExtraResult = useMemo(
    () => (extraResult ? <div className="flex items-center justify-center pt-6">{extraResult}</div> : <></>),
    [extraResult]
  )

  const renderResult = useMemo(() => {
    const defaultButtonProps: UIButtonProps = {
      color: 'primary',
      disabled: false,
      onClick: onClose,
      sizevalue: 'xnormal',
      round: 'true',
      children: <>{intl.formatMessage({ id: 'common.finish' })}</>
    }

    const buttonProps: UIButtonProps = FP.pipe(
      txRD,
      RD.fold<ApiError, boolean, UIButtonProps>(
        () => ({ ...defaultButtonProps, disabled: true }),
        () => ({ ...defaultButtonProps, disabled: true }),
        () => ({ ...defaultButtonProps, children: intl.formatMessage({ id: 'common.finish' }) }),
        () => ({ ...defaultButtonProps, onClick: onFinish })
      )
    )

    return (
      <div className="flex flex-col items-center justify-center">
        <Styled.ResultButton {...buttonProps} />
        {renderExtraResult}
      </div>
    )
  }, [intl, onClose, onFinish, renderExtraResult, txRD])

  return (
    <Modal panelClassName="!max-w-[420px]" visible title={title} onCancel={onClose}>
      <div className="flex flex-col items-center justify-center w-full pb-8 border-b border-gray0 dark:border-gray0d">
        {renderTimer}
        {renderExtra}
      </div>
      {renderResult}
    </Modal>
  )
}
