import { useCallback, useEffect, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { Network, TxHash } from '@xchainjs/xchain-client'
import { Chain } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { getChainAsset } from '../../../helpers/chainHelper'
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
  onSuccess: FP.Lazy<void>
  onClose: FP.Lazy<void>
  validatePassword$: (password: string) => Promise<boolean>
  txState: RD.RemoteData<ApiError, TxHash>
  getActiveVaultId: () => string | undefined
}

export const VultisigConfirmationModal = ({
  visible,
  onClose,
  onSuccess,
  chain,
  network,
  vaultType,
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

  // Track whether we've started the signing flow in THIS modal session
  // This prevents reacting to stale txState from previous transactions
  const [signingStarted, setSigningStarted] = useState(false)

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
      setPhase('password')
      setPassword('')
      setPasswordError(null)
      setQrPayload(null)
      setDevicesJoined(0)
      setIsValidating(false)
      setIsCancelling(false)
      setSigningStarted(false)
      closedRef.current = false
    }
  }, [visible])

  // Set up signing event listeners for SecureVault
  // These listeners receive IPC events from main process during MPC signing ceremony
  // The signBytes$ Observable also sets up listeners, but having them here ensures
  // the modal UI updates even if the Observable subscription changes
  //
  // IMPORTANT: Only depend on visible and vaultType for stable effect
  // This ensures the effect doesn't re-run unnecessarily when the component re-renders
  useEffect(() => {
    if (!visible || vaultType !== 'secure') return

    window.apiLog?.info?.('[VultisigConfirm]', 'Setting up SecureVault signing event listeners')

    const cleanupQR = window.apiMpc.onSignQRReady((payload) => {
      window.apiLog?.info?.('[VultisigConfirm]', 'Sign QR ready event received', { payloadLength: payload?.length })
      setQrPayload(payload)
      setPhase('qr-ready')
    })

    const cleanupDevice = window.apiMpc.onSignDeviceJoined(
      (data: { deviceId: string; totalJoined: number; required: number }) => {
        window.apiLog?.info?.('[VultisigConfirm]', 'Sign device joined event received', data)
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
      window.apiLog?.info?.('[VultisigConfirm]', 'Sign progress event received', data)
    })

    // Store cleanup functions in ref for later cleanup
    cleanupFns.current = [cleanupQR, cleanupDevice, cleanupProgress]

    return () => {
      window.apiLog?.info?.('[VultisigConfirm]', 'Cleaning up SecureVault signing event listeners (effect cleanup)')
      // Cleanup directly from ref instead of using callback
      cleanupFns.current.forEach((fn) => fn())
      cleanupFns.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, vaultType])

  // Track when txState becomes pending - this means the NEW transaction has started
  // Only after seeing pending should we react to success/failure
  useEffect(() => {
    if (vaultType === 'secure' && phase !== 'password' && RD.isPending(txState)) {
      window.apiLog?.info?.('[VultisigConfirm]', 'txState became pending, marking signing as started')
      setSigningStarted(true)
    }
  }, [vaultType, phase, txState])

  // Watch txState to close modal on success/failure (SecureVault only)
  // Uses refs for onClose and closedRef to:
  //  - Avoid re-running when parent re-renders (onClose is inline, new ref each render)
  //  - Ensure onClose is called exactly once per signing session
  useEffect(() => {
    if (vaultType === 'secure' && signingStarted && !closedRef.current) {
      if (RD.isSuccess(txState)) {
        window.apiLog?.info?.('[VultisigConfirm]', 'Transaction succeeded, closing modal')
        closedRef.current = true
        onCloseRef.current()
      } else if (RD.isFailure(txState)) {
        const error = txState.error
        window.apiLog?.error?.('[VultisigConfirm]', 'Transaction failed, closing modal', {
          errorId: error?.errorId,
          msg: error?.msg
        })
        closedRef.current = true
        onCloseRef.current()
      }
    }
  }, [vaultType, signingStarted, txState])

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
      onClose()
      return
    }

    // During signing flow - abort the MPC session and close
    const vaultId = getActiveVaultId()
    if (vaultId) {
      setIsCancelling(true)
      window.apiLog?.info?.('[VultisigConfirm]', 'Cancelling signing session', { phase, vaultId })
      try {
        await window.apiMpc.cancelSigning(vaultId)
        window.apiLog?.info?.('[VultisigConfirm]', 'Signing cancelled successfully')
      } catch (err) {
        window.apiLog?.error?.('[VultisigConfirm]', 'Cancel signing failed', err)
      } finally {
        setIsCancelling(false)
      }
    }
    onClose()
  }, [onClose, phase, getActiveVaultId])

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
          <Label align="center" size="big">
            {intl.formatMessage({ id: 'wallet.vultisig.confirm.scanQr' })}
          </Label>
          {qrPayload && (
            <div className="rounded-lg bg-white p-4">
              <QRCode text={qrPayload} qrError={intl.formatMessage({ id: 'wallet.vultisig.confirm.qrError' })} />
            </div>
          )}
          <Label align="center">
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
