import React from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { useIntl } from 'react-intl'

import { KeystoreState, TxHashRD } from '../../../services/wallet/types'
import { hasImportedKeystore, isLocked } from '../../../services/wallet/util'
import { FlatButton } from '../../uielements/button'
import { Fees, UIFeesRD } from '../../uielements/fees'

type SwapSubmitSectionProps = {
  lockedWallet: boolean
  isKeystoreWallet: boolean
  keystore: KeystoreState
  // Approved state
  isApproved: boolean
  // Swap submit
  disableSubmit: boolean
  onSubmit: () => void
  // Approve submit
  disableSubmitApprove: boolean
  awaitingConfirmation: boolean
  approveState: TxHashRD
  onApprove: () => void
  // Fee display for approve
  uiApproveFeesRD: UIFeesRD
  reloadApproveFeesHandler: () => void
  // Error labels
  sourceChainFeeErrorLabel: JSX.Element
  quoteError: JSX.Element
  aggregatorErrors: JSX.Element
  renderApproveFeeError: JSX.Element
  renderApproveError: JSX.Element
  // Import handler
  importWalletHandler: () => void
}

export const SwapSubmitSection: React.FC<SwapSubmitSectionProps> = ({
  lockedWallet,
  isKeystoreWallet,
  keystore,
  isApproved,
  disableSubmit,
  onSubmit,
  disableSubmitApprove,
  awaitingConfirmation,
  approveState,
  onApprove,
  uiApproveFeesRD,
  reloadApproveFeesHandler,
  sourceChainFeeErrorLabel,
  quoteError,
  aggregatorErrors,
  renderApproveFeeError,
  renderApproveError,
  importWalletHandler
}) => {
  const intl = useIntl()

  if (!lockedWallet) {
    return (
      <>
        {isApproved ? (
          <>
            <FlatButton
              className="my-30px min-w-[200px]"
              size="large"
              color="primary"
              onClick={onSubmit}
              disabled={disableSubmit}>
              {intl.formatMessage({ id: 'common.swap' })}
            </FlatButton>
            {sourceChainFeeErrorLabel}
            {quoteError}
            {aggregatorErrors}
          </>
        ) : (
          <>
            <FlatButton
              className="my-30px min-w-[200px]"
              size="large"
              color="warning"
              disabled={disableSubmitApprove || awaitingConfirmation}
              onClick={onApprove}
              loading={RD.isPending(approveState) || awaitingConfirmation}>
              {awaitingConfirmation
                ? intl.formatMessage({ id: 'common.approve.waiting' })
                : intl.formatMessage({ id: 'common.approve' })}
            </FlatButton>

            {renderApproveFeeError}
            {renderApproveError}

            {!RD.isInitial(uiApproveFeesRD) && <Fees fees={uiApproveFeesRD} reloadFees={reloadApproveFeesHandler} />}
          </>
        )}
      </>
    )
  }

  // Locked wallet — show import/unlock for keystore mode
  if (isKeystoreWallet) {
    return (
      <>
        <p className="center mt-30px mb-0 font-main text-[12px] text-text2 uppercase dark:text-text2d">
          {!hasImportedKeystore(keystore)
            ? intl.formatMessage({ id: 'swap.note.nowallet' })
            : isLocked(keystore) && intl.formatMessage({ id: 'swap.note.lockedWallet' })}
        </p>
        <FlatButton className="my-30px min-w-[200px]" size="large" onClick={importWalletHandler}>
          {!hasImportedKeystore(keystore)
            ? intl.formatMessage({ id: 'wallet.add.label' })
            : isLocked(keystore) && intl.formatMessage({ id: 'wallet.unlock.label' })}
        </FlatButton>
      </>
    )
  }

  return null
}
