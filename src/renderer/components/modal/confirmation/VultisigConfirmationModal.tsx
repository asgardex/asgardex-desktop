import { useCallback, useEffect, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { Chain } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { getChainAsset } from '../../../helpers/chainHelper'
import { createScopedLogger } from '../../../helpers/logger'

const logger = createScopedLogger('VultisigConfirm')
import { ApiError } from '../../../services/wallet/types'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { BaseButton } from '../../uielements/button'
import { InputPassword } from '../../uielements/input'
import { Label } from '../../uielements/label'
import { QRCode } from '../../uielements/qrCode/QRCode'

type VaultType = 'fast' | 'secure'
type Phase = 'password' | 'waiting-qr' | 'qr-ready' | 'device-joined' | 'signing'

type Props = {
  visible: boolean
  network: Network
  chain: Chain
  vaultType: VaultType
  isEncrypted: boolean
  onSuccess: FP.Lazy<void>
  onClose: FP.Lazy<void>
  onCancel?: FP.Lazy<void>
  validatePassword$: (password: string) => Promise<boolean>
  txState: RD.RemoteData<ApiError, TxHash>
  getActiveVaultId: () => string | undefined
}

export const VultisigConfirmationModal = ({
  visible,
  onClose,
  onCancel,
  onSuccess,
  chain,
  network,
  vaultType,
  isEncrypted,
  validatePassword$,
  txState,
  getActiveVaultId
}: Props) => {
  const intl = useIntl()
  const asset = getChainAsset(chain)

  const [phase, setPhase] = useState<Phase>('password')
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [qrPayload, setQrPayload] = useState<string | null>(null)
  const [devicesJoined, setDevicesJoined] = useState(0)
  const [devicesRequired, setDevicesRequired] = useState(2)
  const [isValidating, setIsValidating] = useState(false)

  // Track whether we've started the signing flow in THIS modal session.
  // Prevents reacting to stale txState carried over from a previous transaction.
  //
  // IMPORTANT: This MUST be a ref, not React state.
  // When txState transitions pending→success in a single Observable emission,
  // React batches the state updates. If signingStarted were useState, the
  // success-watching effect would see the OLD value (false) in the same render
  // where txState became success — causing the modal to stay stuck on "signing"
  // even though the tx already completed. A ref updates synchronously so the
  // single combined effect below can gate on it immediately.
  const signingStartedRef = useRef(false)

  // Ref to hold latest onClose without triggering effect re-runs.
  // onClose is an inline arrow in the parent, creating a new reference each render.
  // Without this ref, the txState-watching effect would re-run on every parent render
  // and call onClose() repeatedly after success.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Guard: ensure we only call onClose once per signing session
  const closedRef = useRef(false)

  // Store cleanup functions for event listeners
  const cleanupFns = useRef<(() => void)[]>([])

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setPassword('')
      setPasswordError(null)
      setQrPayload(null)
      setDevicesJoined(0)
      setIsValidating(false)
      setIsCancelling(false)
      signingStartedRef.current = false
      closedRef.current = false

      if (!isEncrypted) {
        // No password needed — skip straight to signing
        // Secure: modal stays open for QR/device flow
        // Fast: parent closes modal immediately via onSuccess callback
        setPhase(vaultType === 'secure' ? 'waiting-qr' : 'signing')
        onSuccess()
      } else {
        setPhase('password')
      }
    }
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  // Set up signing event listeners for SecureVault
  // These listeners receive IPC events from main process during MPC signing ceremony
  // The signBytes$ Observable also sets up listeners, but having them here ensures
  // the modal UI updates even if the Observable subscription changes
  //
  // IMPORTANT: Only depend on visible and vaultType for stable effect
  // This ensures the effect doesn't re-run unnecessarily when the component re-renders
  useEffect(() => {
    if (!visible || vaultType !== 'secure') return

    logger.info('Setting up SecureVault signing event listeners')

    const cleanupQR = window.apiMpc.onSignQRReady((payload) => {
      logger.info('Sign QR ready event received', { payloadLength: payload?.length })
      setQrPayload(payload)
      setPhase('qr-ready')
    })

    const cleanupDevice = window.apiMpc.onSignDeviceJoined(
      (data: { deviceId: string; totalJoined: number; required: number }) => {
        logger.info('Sign device joined event received', data)
        setDevicesJoined(data.totalJoined)
        setDevicesRequired(data.required)
        if (data.totalJoined >= data.required) {
          setPhase('signing')
        } else {
          setPhase('device-joined')
        }
      }
    )

    const cleanupProgress = window.apiMpc.onSignProgress((data) => {
      logger.info('Sign progress event received', data)
    })

    // Store cleanup functions in ref for later cleanup
    cleanupFns.current = [cleanupQR, cleanupDevice, cleanupProgress]

    return () => {
      logger.info('Cleaning up SecureVault signing event listeners (effect cleanup)')
      // Cleanup directly from ref instead of using callback
      cleanupFns.current.forEach((fn) => fn())
      cleanupFns.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, vaultType])

  // Single effect to track txState transitions for SecureVault
  // Uses a ref for signingStarted so pending→success in the same render cycle is handled immediately
  useEffect(() => {
    if (vaultType !== 'secure' || phase === 'password' || closedRef.current) return

    if (RD.isPending(txState)) {
      if (!signingStartedRef.current) {
        logger.info('txState became pending, marking signing as started')
        signingStartedRef.current = true
      }
    } else if (signingStartedRef.current) {
      if (RD.isSuccess(txState)) {
        logger.info('Transaction succeeded, closing modal')
        closedRef.current = true
        onCloseRef.current()
      } else if (RD.isFailure(txState)) {
        const error = txState.error
        logger.error('Transaction failed, closing modal', {
          errorId: error?.errorId,
          msg: error?.msg
        })
        closedRef.current = true
        onCloseRef.current()
      }
    }
  }, [vaultType, phase, txState])

  const handlePasswordSubmit = useCallback(async () => {
    if (!password) {
      setPasswordError(intl.formatMessage({ id: 'wallet.password.empty' }))
      return
    }

    setIsValidating(true)
    setPasswordError(null)

    try {
      const valid = await validatePassword$(password)
      if (valid) {
        if (vaultType === 'secure') {
          setPhase('waiting-qr')
          onSuccess() // Triggers submitTx(), modal stays open for QR flow
        } else {
          // FastVault - just call onSuccess, parent will close modal
          onSuccess()
        }
      } else {
        setPasswordError(intl.formatMessage({ id: 'wallet.password.confirmation.error' }))
      }
    } catch (err) {
      setPasswordError(intl.formatMessage({ id: 'wallet.password.confirmation.error' }))
    } finally {
      setIsValidating(false)
    }
  }, [password, vaultType, validatePassword$, onSuccess, intl])

  const [isCancelling, setIsCancelling] = useState(false)

  const handleCancel = useCallback(async () => {
    if (phase === 'password') {
      // Password phase - just close
      onCancel?.()
      onClose()
      return
    }

    // During signing flow - abort the MPC session and close
    const vaultId = getActiveVaultId()
    if (vaultId) {
      setIsCancelling(true)
      logger.info('Cancelling signing session', { phase, vaultId })
      try {
        await window.apiMpc.cancelSigning(vaultId)
        logger.info('Signing cancelled successfully')
      } catch (err) {
        logger.error('Cancel signing failed', err)
      } finally {
        setIsCancelling(false)
      }
    }
    onCancel?.()
    onClose()
  }, [onClose, onCancel, phase, getActiveVaultId])

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
    setPasswordError(null)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isValidating) {
        handlePasswordSubmit()
      }
    },
    [handlePasswordSubmit, isValidating]
  )

  // Don't render if not visible
  if (!visible) return null

  // Render content based on phase
  const renderContent = () => {
    if (phase === 'password') {
      return (
        <div className="flex flex-col items-center gap-4">
          <AssetIcon asset={asset} network={network} size="big" />
          <Label align="center" size="big" className="uppercase">
            {intl.formatMessage({ id: 'wallet.vultisig.confirm.title' })}
          </Label>
          <Label align="center" color="gray">
            {intl.formatMessage({ id: 'wallet.vultisig.confirm.enterPassword' })}
          </Label>
          <InputPassword
            className="w-full"
            size="large"
            value={password}
            onChange={handlePasswordChange}
            onKeyDown={handleKeyDown}
            autoFocus
            disabled={isValidating}
          />
          {passwordError && (
            <Label color="error" textTransform="uppercase">
              {passwordError}
            </Label>
          )}
        </div>
      )
    }

    if (phase === 'waiting-qr') {
      return (
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-turquoise border-t-transparent" />
          <Label align="center" size="big">
            {intl.formatMessage({ id: 'wallet.vultisig.confirm.waiting' })}
          </Label>
        </div>
      )
    }

    if (phase === 'qr-ready' || phase === 'device-joined') {
      return (
        <div className="flex flex-col items-center gap-4">
          <AssetIcon asset={asset} network={network} size="big" />
          <Label align="center" size="big" className="uppercase">
            {intl.formatMessage({ id: 'wallet.vultisig.confirm.scanQr' })}
          </Label>
          {qrPayload && (
            <div className="rounded-xl border-2 border-solid border-turquoise bg-white p-5 shadow-md">
              <QRCode text={qrPayload} qrError={intl.formatMessage({ id: 'wallet.vultisig.confirm.qrError' })} />
            </div>
          )}
          <Label align="center" color="gray" size="normal">
            {intl.formatMessage(
              { id: 'wallet.vultisig.confirm.devicesJoined' },
              { joined: devicesJoined, required: devicesRequired }
            )}
          </Label>
        </div>
      )
    }

    // phase === 'signing'
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-turquoise border-t-transparent" />
        <Label align="center" size="big">
          {intl.formatMessage({ id: 'wallet.vultisig.confirm.signing' })}
        </Label>
      </div>
    )
  }

  return (
    // Use static to prevent HeadlessUI from auto-closing on backdrop click during signing flow
    // The handleCancel callback controls when closing is allowed
    <Dialog static as="div" className="relative z-10" open={visible} onClose={handleCancel}>
      <DialogBackdrop className="fixed inset-0 bg-bg0/40 dark:bg-bg0d/40" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          className={clsx(
            'mx-auto flex flex-col items-center p-6',
            'w-full max-w-[400px]',
            'bg-bg0 dark:bg-bg0d',
            'rounded-lg border border-solid border-gray0 dark:border-gray0d'
          )}>
          {renderContent()}

          <div className="mt-6 flex w-full items-center justify-end gap-2">
            <BaseButton
              className={clsx(
                'rounded-md !px-4 !py-2',
                'border border-solid border-gray1/20 dark:border-gray1d/20',
                'text-text0 dark:text-text0d',
                'hover:bg-gray1/20 hover:dark:bg-gray1d/20'
              )}
              onClick={handleCancel}
              disabled={isValidating || isCancelling}>
              {isCancelling ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {intl.formatMessage({ id: 'common.cancel' })}
                </div>
              ) : (
                intl.formatMessage({ id: 'common.cancel' })
              )}
            </BaseButton>
            {phase === 'password' && (
              <BaseButton
                className="rounded-lg bg-turquoise !px-4 !py-2 text-white hover:bg-turquoise/80"
                onClick={handlePasswordSubmit}
                disabled={isValidating || !password}>
                {isValidating ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  intl.formatMessage({ id: 'common.confirm' })
                )}
              </BaseButton>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
