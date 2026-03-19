import React, { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { ApiError } from '../../../services/wallet/types'
import { ErrorView } from '../../shared/error'
import { Button, ButtonProps } from '../../uielements/button'
import { Modal } from '../../uielements/modal'
import { TxTimer } from '../../uielements/txTimer'
import { getTxTitle } from './TxModal.helpers'
import { TxModalProps } from './TxModal.types'
import { TxActions, TxAssetDisplay, TxStatusIndicator, TxStepProgress } from './sections'

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
    getExplorerTxUrl,
    openExplorerTxUrl,
    network,
    trackable = false,
    onClose,
    onFinish,
    extraContent
  } = props

  const intl = useIntl()

  const title = titleProp ?? getTxTitle(txConfig, intl)

  // Derive step description for asset display
  const stepDescription = useMemo(() => {
    switch (txConfig.type) {
      case 'deposit':
      case 'symDeposit':
        return FP.pipe(
          txRD,
          RD.fold(
            () => '',
            () =>
              `${intl.formatMessage(
                { id: 'common.step' },
                { current: txConfig.steps.current, total: txConfig.steps.total }
              )}: ${txConfig.stepDescriptions[txConfig.steps.current - 1] || ''}`,
            () => '',
            () => `${intl.formatMessage({ id: 'common.done' })}!`
          )
        )
      default:
        return undefined
    }
  }, [txConfig, txRD, intl])

  // Determine protocol and channelId for actions
  const protocol = useMemo(() => (txConfig.type === 'swap' ? (txConfig.protocol ?? O.none) : O.none), [txConfig])
  const channelId = useMemo(() => (txConfig.type === 'swap' ? (txConfig.channelId ?? O.none) : O.none), [txConfig])

  // Show step progress for multi-step flows
  const hasSteps = txConfig.type === 'deposit' || txConfig.type === 'symDeposit'

  return (
    <Modal panelClassName="!max-w-[460px]" visible title={title} onCancel={onClose}>
      <div className="flex w-full flex-col items-center justify-center border-b border-gray0 pb-8 dark:border-gray0d">
        {/* Status indicator (timer / error / success) */}
        <TxStatusIndicator txRD={txRD} timerValue={timerValue} startTime={startTime} />

        {/* Step progress bar for multi-step flows */}
        {hasSteps && (
          <TxStepProgress
            current={txConfig.steps.current}
            total={txConfig.steps.total}
            descriptions={txConfig.stepDescriptions}
          />
        )}

        {/* Asset display */}
        <TxAssetDisplay txConfig={txConfig} network={network} stepDescription={stepDescription} />

        {/* Escape hatch for custom content */}
        {extraContent && <div className="flex w-full items-center justify-center pt-4">{extraContent}</div>}
      </div>

      {/* Actions: finish button + view/track transaction */}
      <TxActions
        txRD={txRD}
        txHash={txHash}
        getExplorerTxUrl={getExplorerTxUrl}
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
