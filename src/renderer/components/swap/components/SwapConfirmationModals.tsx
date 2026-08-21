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
  // When true, refuse to open confirm modals or submit (stale quote / expired channel window).
  quoteExpired: boolean
  // Submit actions
  submitSwapTx: () => void
  submitCFTx: () => void
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
  quoteExpired,
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
  resetSwapState
}: SwapConfirmationModalsProps): SwapConfirmationModalsResult => {
  const intl = useIntl()

  const [showPasswordModal, setShowPasswordModal] = useState(ModalState.None)
  const [showLedgerModal, setShowLedgerModal] = useState(ModalState.None)
  const [showVultisigModal, setShowVultisigModal] = useState(ModalState.None)

  // Keep latest params/actions in refs so confirm success handlers stay stable and
  // cannot double-fire solely because a quote refresh recreated callback identities.
  const oSwapParamsRef = useRef(oSwapParams)
  const oCFSwapParamsRef = useRef(oCFSwapParams)
  const oOneClickSwapParamsRef = useRef(oOneClickSwapParams)
  const quoteExpiredRef = useRef(quoteExpired)
  const submitSwapTxRef = useRef(submitSwapTx)
  const submitCFTxRef = useRef(submitCFTx)
  const submitOneClickTxRef = useRef(submitOneClickTx)
  const submitApproveTxRef = useRef(submitApproveTx)
  const passwordSubmitOnceRef = useRef(false)
  const ledgerSubmitOnceRef = useRef(false)
  const vultisigSubmitOnceRef = useRef(false)

  useEffect(() => {
    oSwapParamsRef.current = oSwapParams
    oCFSwapParamsRef.current = oCFSwapParams
    oOneClickSwapParamsRef.current = oOneClickSwapParams
    quoteExpiredRef.current = quoteExpired
    submitSwapTxRef.current = submitSwapTx
    submitCFTxRef.current = submitCFTx
    submitOneClickTxRef.current = submitOneClickTx
    submitApproveTxRef.current = submitApproveTx
  }, [
    oSwapParams,
    oCFSwapParams,
    oOneClickSwapParams,
    quoteExpired,
    submitSwapTx,
    submitCFTx,
    submitOneClickTx,
    submitApproveTx
  ])

  useEffect(() => {
    if (showPasswordModal === ModalState.None) passwordSubmitOnceRef.current = false
  }, [showPasswordModal])

  useEffect(() => {
    if (showLedgerModal === ModalState.None) ledgerSubmitOnceRef.current = false
  }, [showLedgerModal])

  useEffect(() => {
    if (showVultisigModal === ModalState.None) vultisigSubmitOnceRef.current = false
  }, [showVultisigModal])

  const dispatchSwapSubmit = useCallback((mode: ModalState, onceRef: React.MutableRefObject<boolean>) => {
    if (onceRef.current) return
    if (mode === ModalState.Swap) {
      if (quoteExpiredRef.current) {
        logger.warn('Blocked swap submit: quote expired')
        return
      }
      onceRef.current = true
      if (O.isSome(oSwapParamsRef.current)) submitSwapTxRef.current()
      else if (O.isSome(oCFSwapParamsRef.current)) submitCFTxRef.current()
      else if (O.isSome(oOneClickSwapParamsRef.current)) submitOneClickTxRef.current()
      return
    }
    if (mode === ModalState.Approve) {
      onceRef.current = true
      submitApproveTxRef.current()
    }
  }, [])

  // Dispatch to the correct modal based on wallet type
  const onSubmit = useCallback(() => {
    if (quoteExpired) {
      logger.warn('Blocked opening swap confirm: quote expired')
      return
    }
    if (useSourceAssetLedger) {
      setShowLedgerModal(ModalState.Swap)
    } else if (useSourceAssetVultisig) {
      setShowVultisigModal(ModalState.Swap)
    } else {
      setShowPasswordModal(ModalState.Swap)
    }
  }, [quoteExpired, useSourceAssetLedger, useSourceAssetVultisig])

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
  const onPasswordSuccess = useCallback(() => {
    dispatchSwapSubmit(showPasswordModal, passwordSubmitOnceRef)
    setShowPasswordModal(ModalState.None)
  }, [dispatchSwapSubmit, showPasswordModal])

  const onPasswordClose = useCallback(() => setShowPasswordModal(ModalState.None), [])

  const renderPasswordConfirmationModal = useMemo(() => {
    const render = showPasswordModal === ModalState.Swap || showPasswordModal === ModalState.Approve
    return (
      render && (
        <WalletPasswordConfirmationModal
          onSuccess={onPasswordSuccess}
          onClose={onPasswordClose}
          validatePassword$={validatePassword$}
        />
      )
    )
  }, [onPasswordClose, onPasswordSuccess, showPasswordModal, validatePassword$])

  // ─── Ledger Modal ─────────────────────────────────────────────────────────
  const onLedgerSuccess = useCallback(() => {
    dispatchSwapSubmit(showLedgerModal, ledgerSubmitOnceRef)
    setShowLedgerModal(ModalState.None)
  }, [dispatchSwapSubmit, showLedgerModal])

  const onLedgerClose = useCallback(() => setShowLedgerModal(ModalState.None), [])

  const renderLedgerConfirmationModal = useMemo(() => {
    const visible = showLedgerModal === ModalState.Swap || showLedgerModal === ModalState.Approve
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
        onSuccess={onLedgerSuccess}
        onClose={onLedgerClose}
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
    onLedgerSuccess,
    onLedgerClose,
    useSourceAssetLedger
  ])

  // ─── Vultisig Modal ───────────────────────────────────────────────────────
  const onVultisigSuccess = useCallback(() => {
    logger.info('onVultisigSuccess', { vaultType })
    if (vaultType === 'fast') setShowVultisigModal(ModalState.None)
    dispatchSwapSubmit(showVultisigModal, vultisigSubmitOnceRef)
  }, [dispatchSwapSubmit, showVultisigModal, vaultType])

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
      onClose={() => setShowVultisigModal(ModalState.None)}
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
