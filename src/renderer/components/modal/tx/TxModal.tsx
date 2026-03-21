import React, { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { ApiError } from '../../../services/wallet/types'
import { ErrorView } from '../../shared/error'
import { Button, ButtonProps } from '../../uielements/button'
import { Modal } from '../../uielements/modal'
import { TxTimer } from '../../uielements/txTimer'
import { TxActions, TxAssetDisplay, TxStatusIndicator } from './sections'
import { getTxTitle } from './TxModal.helpers'
import { TxModalProps } from './TxModal.types'

// ── Legacy props (backward-compatible) ──────────────────────────────
type LegacyProps = {
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

/**
 * Legacy TxModal — kept for backward compatibility during migration.
 * Consumers that haven't been migrated yet still use this interface.
 */
export const TxModal = (props: LegacyProps): JSX.Element => {
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
              <ErrorView
                className="max-w-full overflow-auto p-2 text-sm leading-normal break-all whitespace-pre-wrap"
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
    <Modal panelClassName="!max-w-[420px]" visible title={title} onCancel={onClose}>
      <div className="flex w-full flex-col items-center justify-center border-b border-gray0 pb-8 dark:border-gray0d">
        {renderTimer}
        {renderExtra}
      </div>
      {renderResult}
    </Modal>
  )
}

// ── New unified TxModal ─────────────────────────────────────────────

/**
 * Unified TxModal — owns the rendering of transaction content.
 * Replaces per-consumer boilerplate for timer, asset display, and actions.
 */
export const UnifiedTxModal = (props: TxModalProps): JSX.Element => {
  const {
    txRD,
    timerValue = NaN,
    startTime,
    txConfig,
    title: titleProp,
    txHash,
    openExplorerTxUrl,
    network,
    trackable = false,
    onClose,
    onFinish,
    extraContent
  } = props

  const intl = useIntl()

  const title = titleProp ?? getTxTitle(txConfig, intl)

  // Derive step labels for the stepper
  const stepLabels = useMemo(() => {
    const hasSteps = txConfig.type === 'deposit' || txConfig.type === 'symDeposit'
    if (hasSteps) return txConfig.stepDescriptions
    // Default 3-step labels for all other flows
    return [
      intl.formatMessage({ id: 'common.tx.sending' }),
      intl.formatMessage({ id: 'common.tx.checkResult' }),
      intl.formatMessage({ id: 'common.done' })
    ]
  }, [txConfig, intl])

  // Determine protocol and channelId for actions
  const protocol = useMemo(() => (txConfig.type === 'swap' ? (txConfig.protocol ?? O.none) : O.none), [txConfig])
  const channelId = useMemo(() => (txConfig.type === 'swap' ? (txConfig.channelId ?? O.none) : O.none), [txConfig])

  return (
    <Modal panelClassName="!max-w-[460px]" containerClassName="lg:pl-[240px]" visible title={title} onCancel={onClose}>
      {/* Vertical stepper */}
      <TxStatusIndicator txRD={txRD} timerValue={timerValue} startTime={startTime} steps={stepLabels} />

      {/* Asset display */}
      <TxAssetDisplay txConfig={txConfig} network={network} />

      {/* Escape hatch for custom content */}
      {extraContent && <div className="flex w-full items-center justify-center px-6 pt-3">{extraContent}</div>}

      {/* Actions */}
      <TxActions
        txRD={txRD}
        txHash={txHash}
        openExplorerTxUrl={openExplorerTxUrl}
        network={network}
        trackable={trackable}
        protocol={protocol}
        channelId={channelId}
        onClose={onClose}
        onFinish={onFinish}
      />
    </Modal>
  )
}
