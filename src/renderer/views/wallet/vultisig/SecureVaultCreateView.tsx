import { useCallback, useEffect, useRef, useState } from 'react'

import { CheckCircleIcon, ExclamationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { BackLinkButton } from '../../../components/uielements/button'
import { Input } from '../../../components/uielements/input/Input'
import { InputPassword } from '../../../components/uielements/input/InputPassword'
import { QRCode } from '../../../components/uielements/qrCode/QRCode'
import { useWalletContext } from '../../../contexts/WalletContext'
import { createScopedLogger } from '../../../helpers/logger'

const logger = createScopedLogger('SecureVault')
import * as walletRoutes from '../../../routes/wallet'
import type { VultisigVaultInfo } from '../../../services/wallet/types'

type FormState = 'input' | 'waiting-qr' | 'qr-ready' | 'device-joined' | 'creating' | 'success' | 'error'

export const SecureVaultCreateView = () => {
  const navigate = useNavigate()
  const intl = useIntl()
  const { appWalletService } = useWalletContext()

  const [formState, setFormState] = useState<FormState>('input')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [qrPayload, setQrPayload] = useState<string | null>(null)
  const [devicesJoined, setDevicesJoined] = useState(0)
  const [devicesRequired, setDevicesRequired] = useState(2)
  const [progressMessage, setProgressMessage] = useState<string>('')
  const [addresses, setAddresses] = useState<Record<string, string>>({})
  const [vaultInfo, setVaultInfo] = useState<VultisigVaultInfo | null>(null)
  const [isCleaningUp, setIsCleaningUp] = useState(false)

  // Track if we have an active session that needs cleanup
  const hasActiveSession = useRef(false)

  // Store event listener cleanup functions
  const eventCleanupFns = useRef<(() => void)[]>([])

  // Cleanup event listeners
  const cleanupEventListeners = useCallback(() => {
    eventCleanupFns.current.forEach((fn) => fn())
    eventCleanupFns.current = []
  }, [])

  // Cleanup function to cancel keygen and dispose SDK
  // NOTE: Does NOT clean up event listeners — they are registered once on mount
  // and must survive cancel/retry cycles. Only unmount and terminal success clean them up.
  const cleanupSession = useCallback(async () => {
    if (!hasActiveSession.current) return

    setIsCleaningUp(true)
    logger.info('Cancelling and cleaning up session...')

    try {
      // First cancel any ongoing keygen operation
      await window.apiMpc.cancelKeygen()
      logger.info('Keygen cancelled')
    } catch (err) {
      logger.warn('Error cancelling keygen:', err)
    }

    try {
      // Then dispose the SDK
      await window.apiMpc.dispose()
      logger.info('SDK disposed')
    } catch (err) {
      logger.warn('Error disposing SDK:', err)
    }

    hasActiveSession.current = false
    setIsCleaningUp(false)
  }, [])

  // Reset all form state
  const resetState = useCallback(() => {
    setFormState('input')
    setError(null)
    setQrPayload(null)
    setDevicesJoined(0)
    setDevicesRequired(2)
    setProgressMessage('')
    setAddresses({})
    setVaultInfo(null)
  }, [])

  // Set up event listeners
  useEffect(() => {
    const cleanupQR = window.apiMpc.onQRCodeReady((payload) => {
      logger.info('QR code ready')
      setQrPayload(payload)
      setFormState('qr-ready')
    })

    const cleanupDeviceJoined = window.apiMpc.onDeviceJoined((data) => {
      logger.info('Device joined:', data)
      setDevicesJoined(data.totalJoined)
      setDevicesRequired(data.required)
      if (data.totalJoined >= data.required) {
        setFormState('creating')
      } else {
        setFormState('device-joined')
      }
    })

    const cleanupProgress = window.apiMpc.onCreationProgress((data) => {
      logger.info('Progress:', data)
      setProgressMessage(data.message || data.step)
    })

    // Store cleanup functions for terminal state cleanup
    eventCleanupFns.current = [cleanupQR, cleanupDeviceJoined, cleanupProgress]

    return () => {
      cleanupQR()
      cleanupDeviceJoined()
      cleanupProgress()
      eventCleanupFns.current = []
    }
  }, [])

  // Clean up event listeners on success (no longer needed).
  // On error, listeners are kept alive so retry works without re-mounting.
  useEffect(() => {
    if (formState === 'success') {
      cleanupEventListeners()
    }
  }, [formState, cleanupEventListeners])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hasActiveSession.current) {
        logger.info('Component unmounting, cleaning up...')
        // Cancel any ongoing keygen first, then dispose
        window.apiMpc
          .cancelKeygen()
          .catch((err) => logger.warn('Error cancelling on unmount:', err))
          .finally(() => {
            window.apiMpc.dispose().catch((err) => {
              logger.warn('Error disposing on unmount:', err)
            })
          })
      }
    }
  }, [])

  const handleCreateVault = useCallback(async () => {
    if (!name) {
      setError(intl.formatMessage({ id: 'wallet.vultisig.secureCreate.enterName' }))
      return
    }

    setFormState('waiting-qr')
    setError(null)

    try {
      // Initialize SDK first
      await window.apiMpc.init()
      hasActiveSession.current = true

      // Create secure vault - this will trigger onQRCodeReady callback
      // and eventually return when vault is created
      const vault = await window.apiMpc.createSecureVault({
        name,
        password: password || undefined,
        devices: 2,
        threshold: 2
      })

      hasActiveSession.current = false // Session completed successfully

      // Get addresses
      const addrs = await window.apiMpc.getAddresses(vault.id)
      setAddresses(addrs)

      // Store vault info for navigation
      setVaultInfo({
        id: vault.id,
        name: vault.name,
        type: vault.type as 'fast' | 'secure',
        isEncrypted: vault.isEncrypted,
        chains: vault.chains
      })

      // Clear sensitive data from state
      setPassword('')

      setFormState('success')
    } catch (err) {
      logger.error('Failed to create secure vault:', err)
      setError(String(err))
      setFormState('error')
      // Keep hasActiveSession true so cleanup can run on retry
    }
  }, [name, password, intl])

  const handleGoToAssets = useCallback(() => {
    if (!vaultInfo) {
      logger.error('No vault info available')
      return
    }

    // Set the vault data in the service before switching modes
    appWalletService.vaultManager.setActiveVault(vaultInfo, addresses)

    // Switch to standalone vultisig mode (this will use the state we just set)
    appWalletService.switchToVultisigMode(true)

    navigate(walletRoutes.assets.path())
  }, [appWalletService, navigate, vaultInfo, addresses])

  const handleCancel = useCallback(async () => {
    logger.info('User cancelled')
    await cleanupSession()
    resetState()
  }, [cleanupSession, resetState])

  const handleRetry = useCallback(async () => {
    logger.info('Retrying...')
    await cleanupSession()
    resetState()
  }, [cleanupSession, resetState])

  const cancelButton = (
    <button
      onClick={handleCancel}
      disabled={isCleaningUp}
      className="hover:border-error hover:text-error mt-2 flex items-center gap-2 rounded-lg border border-gray2/30 px-4 py-2 text-sm text-gray2 transition-colors dark:text-gray2d">
      <XMarkIcon className="h-4 w-4" />
      {isCleaningUp
        ? intl.formatMessage({ id: 'wallet.vultisig.secureCreate.cancelling' })
        : intl.formatMessage({ id: 'common.cancel' })}
    </button>
  )

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 bg-bg1 p-8 dark:bg-bg1d">
      <div className="absolute top-4 left-4">
        <BackLinkButton path={walletRoutes.noWallet.path()} />
      </div>

      <h1 className="text-2xl font-bold text-text1 dark:text-text1d">
        {intl.formatMessage({ id: 'wallet.vultisig.secureCreate.title' })}
      </h1>

      {/* Input Form */}
      {formState === 'input' && (
        <div className="flex w-full max-w-md flex-col gap-4">
          <p className="text-center text-sm text-gray2 dark:text-gray2d">
            {intl.formatMessage({ id: 'wallet.vultisig.secureCreate.description' })}
          </p>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'wallet.vultisig.create.vaultName' })}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={intl.formatMessage({ id: 'wallet.vultisig.secureCreate.vaultName.placeholder' })}
              size="large"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'wallet.vultisig.secureCreate.password.optional' })}
            </label>
            <InputPassword
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={intl.formatMessage({ id: 'wallet.vultisig.secureCreate.password.placeholder' })}
              size="large"
            />
            <span className="text-xs text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'wallet.vultisig.secureCreate.password.hint' })}
            </span>
          </div>

          {error && (
            <div className="bg-error/10 text-error flex items-center gap-2 rounded-lg p-3">
              <ExclamationCircleIcon className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleCreateVault}
            disabled={!name}
            className={clsx(
              'mt-4 rounded-lg px-6 py-3 font-medium transition-colors',
              'bg-turquoise text-black hover:bg-turquoise/80',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}>
            {intl.formatMessage({ id: 'wallet.vultisig.secureCreate.submit' })}
          </button>
        </div>
      )}

      {/* Waiting for QR */}
      {formState === 'waiting-qr' && (
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-turquoise border-t-transparent" />
          <p className="text-gray2 dark:text-gray2d">
            {intl.formatMessage({ id: 'wallet.vultisig.secureCreate.waitingQr' })}
          </p>
          {cancelButton}
        </div>
      )}

      {/* QR Code Ready */}
      {formState === 'qr-ready' && qrPayload && (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <div className="rounded-lg bg-turquoise/10 p-4 text-center">
            <p className="text-turquoise">{intl.formatMessage({ id: 'wallet.vultisig.secureCreate.scanQr' })}</p>
            <p className="mt-1 text-sm text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'wallet.vultisig.secureCreate.scanQr.description' })}
            </p>
          </div>

          <div className="rounded-lg bg-white p-4">
            <QRCode text={qrPayload} qrError={intl.formatMessage({ id: 'wallet.vultisig.confirm.qrError' })} />
          </div>

          <p className="text-sm text-gray2 dark:text-gray2d">
            {intl.formatMessage(
              { id: 'wallet.vultisig.secureCreate.waitingDevice' },
              { joined: devicesJoined + 1, required: devicesRequired }
            )}
          </p>

          {cancelButton}
        </div>
      )}

      {/* Device Joined - still waiting for more */}
      {formState === 'device-joined' && qrPayload && (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <div className="rounded-lg bg-turquoise/10 p-4 text-center">
            <p className="text-turquoise">
              {intl.formatMessage({ id: 'wallet.vultisig.secureCreate.deviceConnected' })}
            </p>
            <p className="mt-1 text-sm text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'wallet.vultisig.secureCreate.waitingMore' })}
            </p>
          </div>

          <div className="rounded-lg bg-white p-4">
            <QRCode text={qrPayload} qrError={intl.formatMessage({ id: 'wallet.vultisig.confirm.qrError' })} />
          </div>

          <p className="text-sm text-gray2 dark:text-gray2d">
            {intl.formatMessage(
              { id: 'wallet.vultisig.confirm.devicesJoined' },
              { joined: devicesJoined, required: devicesRequired }
            )}
          </p>

          {cancelButton}
        </div>
      )}

      {/* Creating State */}
      {formState === 'creating' && (
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-turquoise border-t-transparent" />
          <p className="text-lg font-medium text-text1 dark:text-text1d">
            {intl.formatMessage(
              { id: 'wallet.vultisig.secureCreate.allJoined' },
              { joined: devicesJoined, required: devicesRequired }
            )}
          </p>
          <p className="text-gray2 dark:text-gray2d">
            {progressMessage || intl.formatMessage({ id: 'wallet.vultisig.secureCreate.runningKeygen' })}
          </p>
          <p className="text-xs text-gray2 dark:text-gray2d">
            {intl.formatMessage({ id: 'wallet.vultisig.secureCreate.keepActive' })}
          </p>

          {cancelButton}
        </div>
      )}

      {/* Success State */}
      {formState === 'success' && (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <CheckCircleIcon className="h-16 w-16 text-turquoise" />
          <h2 className="text-xl font-bold text-text1 dark:text-text1d">
            {intl.formatMessage({ id: 'wallet.vultisig.secureCreate.success' })}
          </h2>

          <div className="w-full rounded-lg bg-bg2 p-4 dark:bg-bg2d">
            <h3 className="mb-3 text-sm font-medium text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'wallet.vultisig.create.success.addresses' })}
            </h3>
            <div className="flex flex-col gap-2">
              {Object.entries(addresses)
                .slice(0, 5)
                .map(([chain, address]) => (
                  <div key={chain} className="flex flex-col">
                    <span className="text-xs font-medium text-turquoise">{chain}</span>
                    <span className="text-xs break-all text-text1 dark:text-text1d">{address}</span>
                  </div>
                ))}
              {Object.keys(addresses).length > 5 && (
                <span className="text-xs text-gray2 dark:text-gray2d">
                  {intl.formatMessage(
                    { id: 'wallet.vultisig.create.success.moreChains' },
                    { count: Object.keys(addresses).length - 5 }
                  )}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleGoToAssets}
            className="mt-4 w-full rounded-lg bg-turquoise px-6 py-3 font-medium text-black transition-colors hover:bg-turquoise/80">
            {intl.formatMessage({ id: 'wallet.vultisig.create.goToWallet' })}
          </button>
        </div>
      )}

      {/* Error State */}
      {formState === 'error' && (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <ExclamationCircleIcon className="text-error h-16 w-16" />
          <h2 className="text-xl font-bold text-text1 dark:text-text1d">
            {intl.formatMessage({ id: 'wallet.vultisig.create.failed' })}
          </h2>
          <p className="text-center text-gray2 dark:text-gray2d">{error}</p>

          <button
            onClick={handleRetry}
            disabled={isCleaningUp}
            className={clsx(
              'mt-4 rounded-lg px-6 py-3 font-medium transition-colors',
              'bg-turquoise text-black hover:bg-turquoise/80',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}>
            {isCleaningUp
              ? intl.formatMessage({ id: 'wallet.vultisig.secureCreate.cancelling' })
              : intl.formatMessage({ id: 'wallet.vultisig.create.tryAgain' })}
          </button>
        </div>
      )}
    </div>
  )
}
