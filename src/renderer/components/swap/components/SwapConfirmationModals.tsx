import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { chainToString } from '../../../../shared/utils/chain'
import { WalletType } from '../../../../shared/wallet/types'
import { isEvmChainToken } from '../../../helpers/evmHelper'
import { logger } from '../../../helpers/logger'
import { SwapTxParams, SwapTxState, SendTxParams } from '../../../services/chain/types'
import { VaultType, ValidatePasswordHandler, TxHashRD } from '../../../services/wallet/types'
import {
  LedgerConfirmationModal,
  VultisigConfirmationModal,
  WalletPasswordConfirmationModal
} from '../../modal/confirmation'
import { ModalState } from '../Swap.types'

type SwapConfirmationModalsProps = {
  // Wallet mode flags
  useSourceAssetLedger: boolean
  useSourceAssetVultisig: boolean
  // Source info for Ledger modal
  sourceAsset: AnyAsset
  sourceChain: Chain
  sourceWalletType: WalletType
  network: Network
  // Swap/CF/OneClick params (for determining which submit to call). At most one is Some
  // for any given selected quote because each builder gates on protocol upstream.
  oSwapParams: O.Option<SwapTxParams>
  oCFSwapParams: O.Option<SendTxParams>
  oOneClickSwapParams: O.Option<SendTxParams>
  // Submit actions
  submitSwapTx: () => void
  /** May open a Chainflip deposit channel before broadcasting (aggregator 3.0+). */
  submitCFTx: () => void | Promise<void>
  submitOneClickTx: () => void
  submitApproveTx: () => void
  // Password validation
  validatePassword$: ValidatePasswordHandler
  validatePasswordForVultisig: (password: string) => Promise<boolean>
  // Vultisig-specific
  vaultType: VaultType
  isVaultEncrypted: boolean
  approveState: TxHashRD
  swapState: SwapTxState
  getActiveVaultId: () => string | undefined
  resetSwapState?: () => void
  /** Shown on the confirm step when a chart limit order is the thing being signed. */
  swapDescription?: string
  /** User closed the confirm step without accepting it. */
  onSwapDismiss?: () => void
}

type SwapConfirmationModalsResult = {
  showPasswordModal: ModalState
  showLedgerModal: ModalState
  showVultisigModal: ModalState
  onSubmit: () => void
  onApprove: () => void
  renderModals: React.ReactNode
}

/**
 * Manages the 3 wallet confirmation modals (Password, Ledger, Vultisig)
 * and exposes `onSubmit`/`onApprove` which dispatch to the correct modal.
 */
export const useSwapConfirmationModals = ({
  useSourceAssetLedger,
  useSourceAssetVultisig,
  sourceAsset,
  sourceChain,
  sourceWalletType: _sourceWalletType,
  network,
  oSwapParams,
  oCFSwapParams,
  oOneClickSwapParams,
  submitSwapTx,
  submitCFTx,
  submitOneClickTx,
  submitApproveTx,
  validatePassword$,
  validatePasswordForVultisig,
  vaultType,
  isVaultEncrypted,
  approveState,
  swapState,
  getActiveVaultId,
  resetSwapState,
  swapDescription,
  onSwapDismiss
}: SwapConfirmationModalsProps): SwapConfirmationModalsResult => {
  const intl = useIntl()

  const [showPasswordModal, setShowPasswordModal] = useState(ModalState.None)
  const [showLedgerModal, setShowLedgerModal] = useState(ModalState.None)
  const [showVultisigModal, setShowVultisigModal] = useState(ModalState.None)
  // Ledger's OK button calls onSuccess and then onClose. A limit cancel must not
  // treat that accepted close as a dismiss, or the order would arm again after signing.
  const confirmAcceptedRef = useRef(false)

  const dismissSwap = useCallback(() => {
    if (confirmAcceptedRef.current) {
      confirmAcceptedRef.current = false
      return
    }
    onSwapDismiss?.()
  }, [onSwapDismiss])

  // Dispatch to the correct modal based on wallet type
  const onSubmit = useCallback(() => {
    confirmAcceptedRef.current = false
    if (useSourceAssetLedger) {
      setShowLedgerModal(ModalState.Swap)
    } else if (useSourceAssetVultisig) {
      setShowVultisigModal(ModalState.Swap)
    } else {
      setShowPasswordModal(ModalState.Swap)
    }
  }, [useSourceAssetLedger, useSourceAssetVultisig])

  const onApprove = useCallback(() => {
    confirmAcceptedRef.current = false
    if (useSourceAssetLedger) {
      setShowLedgerModal(ModalState.Approve)
    } else if (useSourceAssetVultisig) {
      setShowVultisigModal(ModalState.Approve)
    } else {
      setShowPasswordModal(ModalState.Approve)
    }
  }, [useSourceAssetLedger, useSourceAssetVultisig])

  // ─── Password Modal ──────────────────────────────────────────────────────
  const renderPasswordConfirmationModal = useMemo(() => {
    const onSuccess = () => {
      // Close immediately so Chainflip channel-open / broadcast wait lives in SwapTxModal,
      // not in a blank gap after password confirm.
      confirmAcceptedRef.current = true
      const mode = showPasswordModal
      setShowPasswordModal(ModalState.None)
      void (async () => {
        try {
          if (mode === ModalState.Swap && O.isSome(oSwapParams)) {
            submitSwapTx()
          } else if (mode === ModalState.Swap && O.isSome(oCFSwapParams)) {
            await submitCFTx()
          } else if (mode === ModalState.Swap && O.isSome(oOneClickSwapParams)) {
            submitOneClickTx()
          } else if (mode === ModalState.Approve) {
            submitApproveTx()
          }
        } catch (error) {
          logger.error('Swap confirm failed after password', error)
        }
      })()
    }
    const onClose = () => {
      setShowPasswordModal(ModalState.None)
      dismissSwap()
    }
    const render = showPasswordModal === ModalState.Swap || showPasswordModal === ModalState.Approve
    return (
      render && (
        <WalletPasswordConfirmationModal
          onSuccess={onSuccess}
          onClose={onClose}
          validatePassword$={validatePassword$}
          description={showPasswordModal === ModalState.Swap ? swapDescription : undefined}
        />
      )
    )
  }, [
    oCFSwapParams,
    oOneClickSwapParams,
    oSwapParams,
    showPasswordModal,
    submitApproveTx,
    submitCFTx,
    submitOneClickTx,
    dismissSwap,
    submitSwapTx,
    swapDescription,
    validatePassword$
  ])

  // ─── Ledger Modal ─────────────────────────────────────────────────────────
  const renderLedgerConfirmationModal = useMemo(() => {
    const visible = showLedgerModal === ModalState.Swap || showLedgerModal === ModalState.Approve
    const onClose = () => {
      setShowLedgerModal(ModalState.None)
      dismissSwap()
    }
    const onSuccess = () => {
      confirmAcceptedRef.current = true
      const mode = showLedgerModal
      setShowLedgerModal(ModalState.None)
      void (async () => {
        try {
          if (mode === ModalState.Swap && O.isSome(oSwapParams)) {
            submitSwapTx()
          } else if (mode === ModalState.Swap && O.isSome(oCFSwapParams)) {
            await submitCFTx()
          } else if (mode === ModalState.Swap && O.isSome(oOneClickSwapParams)) {
            submitOneClickTx()
          } else if (mode === ModalState.Approve) {
            submitApproveTx()
          }
        } catch (error) {
          logger.error('Swap confirm failed after Ledger', error)
        }
      })()
    }
    const chainAsString = chainToString(sourceChain)
    const txtNeedsConnected = intl.formatMessage({ id: 'ledger.needsconnected' }, { chain: chainAsString })
    const description1 = isEvmChainToken(sourceAsset)
      ? `${txtNeedsConnected} ${intl.formatMessage({ id: 'ledger.blindsign' }, { chain: chainAsString })}`
      : txtNeedsConnected
    const signText = intl.formatMessage({ id: 'ledger.sign' })
    const description2 =
      showLedgerModal === ModalState.Swap && swapDescription ? `${signText} ${swapDescription}` : signText

    return (
      <LedgerConfirmationModal
        key="leder-conf-modal"
        network={network}
        onSuccess={onSuccess}
        onClose={onClose}
        visible={visible}
        chain={sourceChain}
        description1={description1}
        description2={description2}
        addresses={FP.pipe(
          oSwapParams,
          O.chain(({ poolAddress, sender }) => {
            const recipient = poolAddress.address
            if (useSourceAssetLedger) return O.some({ recipient, sender })
            return O.none
          })
        )}
      />
    )
  }, [
    showLedgerModal,
    sourceChain,
    intl,
    sourceAsset,
    network,
    oSwapParams,
    oCFSwapParams,
    oOneClickSwapParams,
    submitSwapTx,
    submitCFTx,
    submitOneClickTx,
    dismissSwap,
    submitApproveTx,
    swapDescription,
    useSourceAssetLedger
  ])

  // ─── Vultisig Modal ───────────────────────────────────────────────────────
  const onVultisigSuccess = useCallback(() => {
    logger.info('onVultisigSuccess', { vaultType })
    confirmAcceptedRef.current = true
    const mode = showVultisigModal
    // FastVault: close confirm modal immediately; SecureVault stays open for QR / device signing.
    // Either way, Chainflip channel-open pending state is published by submitCFTx into swapState.
    if (vaultType === 'fast') setShowVultisigModal(ModalState.None)
    void (async () => {
      try {
        if (mode === ModalState.Swap) {
          if (O.isSome(oSwapParams)) submitSwapTx()
          else if (O.isSome(oCFSwapParams)) await submitCFTx()
          else if (O.isSome(oOneClickSwapParams)) submitOneClickTx()
        } else if (mode === ModalState.Approve) {
          submitApproveTx()
        }
      } catch (error) {
        logger.error('Swap confirm failed after Vultisig', error)
      }
    })()
  }, [
    vaultType,
    showVultisigModal,
    oSwapParams,
    oCFSwapParams,
    oOneClickSwapParams,
    submitSwapTx,
    submitCFTx,
    submitOneClickTx,
    submitApproveTx
  ])

  // Track Vultisig signing session
  const vultisigSessionRef = useRef(false)
  useEffect(() => {
    if (showVultisigModal !== ModalState.None && useSourceAssetVultisig && !vultisigSessionRef.current) {
      vultisigSessionRef.current = true
      logger.info('Vultisig signing session started (sync)')
    } else if (showVultisigModal === ModalState.None && vultisigSessionRef.current) {
      logger.info('Vultisig signing session ended')
      vultisigSessionRef.current = false
    }
  }, [showVultisigModal, useSourceAssetVultisig])

  const shouldRenderVultisigModal = vultisigSessionRef.current || useSourceAssetVultisig
  const renderVultisigConfirmationModal = shouldRenderVultisigModal ? (
    <VultisigConfirmationModal
      key="vultisig-swap-confirmation-modal"
      visible={showVultisigModal !== ModalState.None}
      network={network}
      chain={sourceChain}
      vaultType={vaultType}
      isEncrypted={isVaultEncrypted}
      onSuccess={onVultisigSuccess}
      onClose={() => {
        setShowVultisigModal(ModalState.None)
        dismissSwap()
      }}
      description={showVultisigModal === ModalState.Swap ? swapDescription : undefined}
      onCancel={() => resetSwapState?.()}
      validatePassword$={validatePasswordForVultisig}
      txState={showVultisigModal === ModalState.Approve ? approveState : swapState.swapTx}
      getActiveVaultId={getActiveVaultId}
    />
  ) : null

  const renderModals = (
    <>
      {renderPasswordConfirmationModal}
      {renderLedgerConfirmationModal}
      {renderVultisigConfirmationModal}
    </>
  )

  return {
    showPasswordModal,
    showLedgerModal,
    showVultisigModal,
    onSubmit,
    onApprove,
    renderModals
  }
}
