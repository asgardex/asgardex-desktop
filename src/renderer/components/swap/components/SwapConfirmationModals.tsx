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
  // Swap/CF params (for determining which submit to call)
  oSwapParams: O.Option<SwapTxParams>
  oCFSwapParams: O.Option<SendTxParams>
  // Submit actions
  submitSwapTx: () => void
  submitCFTx: () => void
  submitApproveTx: () => void
  // Password validation
  validatePassword$: ValidatePasswordHandler
  validatePasswordForVultisig: (password: string) => Promise<boolean>
  // Vultisig-specific
  vaultType: VaultType
  approveState: TxHashRD
  swapState: SwapTxState
  getActiveVaultId: () => string | undefined
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
  submitSwapTx,
  submitCFTx,
  submitApproveTx,
  validatePassword$,
  validatePasswordForVultisig,
  vaultType,
  approveState,
  swapState,
  getActiveVaultId
}: SwapConfirmationModalsProps): SwapConfirmationModalsResult => {
  const intl = useIntl()

  const [showPasswordModal, setShowPasswordModal] = useState(ModalState.None)
  const [showLedgerModal, setShowLedgerModal] = useState(ModalState.None)
  const [showVultisigModal, setShowVultisigModal] = useState(ModalState.None)

  // Dispatch to the correct modal based on wallet type
  const onSubmit = useCallback(() => {
    if (useSourceAssetLedger) {
      setShowLedgerModal(ModalState.Swap)
    } else if (useSourceAssetVultisig) {
      setShowVultisigModal(ModalState.Swap)
    } else {
      setShowPasswordModal(ModalState.Swap)
    }
  }, [useSourceAssetLedger, useSourceAssetVultisig])

  const onApprove = useCallback(() => {
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
      if (showPasswordModal === ModalState.Swap && O.isSome(oSwapParams)) {
        submitSwapTx()
      } else if (showPasswordModal === ModalState.Swap && O.isSome(oCFSwapParams)) {
        submitCFTx()
      } else if (showPasswordModal === ModalState.Approve) {
        submitApproveTx()
      }
      setShowPasswordModal(ModalState.None)
    }
    const onClose = () => setShowPasswordModal(ModalState.None)
    const render = showPasswordModal === ModalState.Swap || showPasswordModal === ModalState.Approve
    return (
      render && (
        <WalletPasswordConfirmationModal
          onSuccess={onSuccess}
          onClose={onClose}
          validatePassword$={validatePassword$}
        />
      )
    )
  }, [oCFSwapParams, oSwapParams, showPasswordModal, submitApproveTx, submitCFTx, submitSwapTx, validatePassword$])

  // ─── Ledger Modal ─────────────────────────────────────────────────────────
  const renderLedgerConfirmationModal = useMemo(() => {
    const visible = showLedgerModal === ModalState.Swap || showLedgerModal === ModalState.Approve
    const onClose = () => setShowLedgerModal(ModalState.None)
    const onSuccess = () => {
      if (showLedgerModal === ModalState.Swap && O.isSome(oSwapParams)) {
        submitSwapTx()
      } else if (showLedgerModal === ModalState.Swap && O.isSome(oCFSwapParams)) {
        submitCFTx()
      } else if (showLedgerModal === ModalState.Approve) {
        submitApproveTx()
      }
      setShowLedgerModal(ModalState.None)
    }
    const chainAsString = chainToString(sourceChain)
    const txtNeedsConnected = intl.formatMessage({ id: 'ledger.needsconnected' }, { chain: chainAsString })
    const description1 = isEvmChainToken(sourceAsset)
      ? `${txtNeedsConnected} ${intl.formatMessage({ id: 'ledger.blindsign' }, { chain: chainAsString })}`
      : txtNeedsConnected
    const description2 = intl.formatMessage({ id: 'ledger.sign' })

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
    submitSwapTx,
    submitCFTx,
    submitApproveTx,
    useSourceAssetLedger
  ])

  // ─── Vultisig Modal ───────────────────────────────────────────────────────
  const onVultisigSuccess = useCallback(() => {
    logger.info('onVultisigSuccess', { vaultType })
    if (vaultType === 'fast') setShowVultisigModal(ModalState.None)
    if (showVultisigModal === ModalState.Swap) {
      if (O.isSome(oSwapParams)) submitSwapTx()
      else if (O.isSome(oCFSwapParams)) submitCFTx()
    } else if (showVultisigModal === ModalState.Approve) {
      submitApproveTx()
    }
  }, [vaultType, showVultisigModal, oSwapParams, oCFSwapParams, submitSwapTx, submitCFTx, submitApproveTx])

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
      onSuccess={onVultisigSuccess}
      onClose={() => setShowVultisigModal(ModalState.None)}
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
