import { useCallback, useEffect, useRef, useState } from 'react'

import { CheckCircleIcon, ExclamationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'

import { BackLinkButton } from '../../../components/uielements/button'
import { QRCode } from '../../../components/uielements/qrCode/QRCode'
import { useWalletContext } from '../../../contexts/WalletContext'
import * as walletRoutes from '../../../routes/wallet'
import type { VultisigVaultInfo } from '../../../services/wallet/types'

type FormState = 'input' | 'waiting-qr' | 'qr-ready' | 'device-joined' | 'creating' | 'success' | 'error'

export const SecureVaultCreateView = () => {
  const navigate = useNavigate()
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
  const cleanupSession = useCallback(async () => {
    if (!hasActiveSession.current) return

    setIsCleaningUp(true)
    window.apiLog.info('[SecureVault]', 'Cancelling and cleaning up session...')

    // Clean up event listeners first
    cleanupEventListeners()

    try {
      // First cancel any ongoing keygen operation
      await window.apiMpc.cancelKeygen()
      window.apiLog.info('[SecureVault]', 'Keygen cancelled')
    } catch (err) {
      window.apiLog.warn('[SecureVault]', 'Error cancelling keygen:', err)
    }

    try {
      // Then dispose the SDK
      await window.apiMpc.dispose()
      window.apiLog.info('[SecureVault]', 'SDK disposed')
    } catch (err) {
      window.apiLog.warn('[SecureVault]', 'Error disposing SDK:', err)
    }

    hasActiveSession.current = false
    setIsCleaningUp(false)
  }, [cleanupEventListeners])

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
      window.apiLog.info('[SecureVault]', 'QR code ready')
      setQrPayload(payload)
      setFormState('qr-ready')
    })

    const cleanupDeviceJoined = window.apiMpc.onDeviceJoined((data) => {
      window.apiLog.info('[SecureVault]', 'Device joined:', data)
      setDevicesJoined(data.totalJoined)
      setDevicesRequired(data.required)
      if (data.totalJoined >= data.required) {
        setFormState('creating')
      } else {
        setFormState('device-joined')
      }
    })

    const cleanupProgress = window.apiMpc.onCreationProgress((data) => {
      window.apiLog.info('[SecureVault]', 'Progress:', data)
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

  // Clean up event listeners when entering terminal states (success/error)
  useEffect(() => {
    if (formState === 'success' || formState === 'error') {
      cleanupEventListeners()
    }
  }, [formState, cleanupEventListeners])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hasActiveSession.current) {
        window.apiLog.info('[SecureVault]', 'Component unmounting, cleaning up...')
        // Cancel any ongoing keygen first, then dispose
        window.apiMpc
          .cancelKeygen()
          .catch((err) => window.apiLog.warn('[SecureVault]', 'Error cancelling on unmount:', err))
          .finally(() => {
            window.apiMpc.dispose().catch((err) => {
              window.apiLog.warn('[SecureVault]', 'Error disposing on unmount:', err)
            })
          })
      }
    }
  }, [])

  const handleCreateVault = useCallback(async () => {
    if (!name) {
      setError('Please enter a vault name')
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
      window.apiLog.error('[SecureVault]', 'Failed to create secure vault:', err)
      setError(String(err))
      setFormState('error')
      // Keep hasActiveSession true so cleanup can run on retry
    }
  }, [name, password])

  const handleGoToAssets = useCallback(() => {
    if (!vaultInfo) {
      window.apiLog.error('[SecureVault]', 'No vault info available')
      return
    }

    // Set the vault data in the service before switching modes
    appWalletService.vaultManager.setActiveVault(vaultInfo, addresses)

    // Switch to standalone vultisig mode (this will use the state we just set)
    appWalletService.switchToVultisigMode(true)

    navigate(walletRoutes.assets.path())
  }, [appWalletService, navigate, vaultInfo, addresses])

  const handleCancel = useCallback(async () => {
    window.apiLog.info('[SecureVault]', 'User cancelled')
    await cleanupSession()
    resetState()
  }, [cleanupSession, resetState])

  const handleRetry = useCallback(async () => {
    window.apiLog.info('[SecureVault]', 'Retrying...')
    await cleanupSession()
    resetState()
  }, [cleanupSession, resetState])

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 bg-bg1 p-8 dark:bg-bg1d">
      <div className="absolute left-4 top-4">
        <BackLinkButton path={walletRoutes.noWallet.path()} />
      </div>

      <h1 className="text-2xl font-bold text-text1 dark:text-text1d">Create Secure Vault (2-of-2)</h1>

      {/* Input Form */}
      {formState === 'input' && (
        <div className="flex w-full max-w-md flex-col gap-4">
          <p className="text-center text-sm text-gray2 dark:text-gray2d">
            Create a 2-of-2 vault with your Vultisig mobile app. You&apos;ll need to scan a QR code.
          </p>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray2 dark:text-gray2d">Vault Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Secure Vault"
              className="rounded-lg border border-gray2/20 bg-bg2 p-3 text-text1 outline-none focus:border-turquoise dark:border-gray2d/20 dark:bg-bg2d dark:text-text1d"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray2 dark:text-gray2d">Password (Optional)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Optional encryption password"
              className="rounded-lg border border-gray2/20 bg-bg2 p-3 text-text1 outline-none focus:border-turquoise dark:border-gray2d/20 dark:bg-bg2d dark:text-text1d"
            />
            <span className="text-xs text-gray2 dark:text-gray2d">
              If set, this password will be required for signing transactions.
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
            Create Secure Vault
          </button>
        </div>
      )}

      {/* Waiting for QR */}
      {formState === 'waiting-qr' && (
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-turquoise border-t-transparent" />
          <p className="text-gray2 dark:text-gray2d">Initializing secure vault session...</p>
          <button
            onClick={handleCancel}
            disabled={isCleaningUp}
            className="hover:text-error mt-2 flex items-center gap-2 text-sm text-gray2 dark:text-gray2d">
            <XMarkIcon className="h-4 w-4" />
            {isCleaningUp ? 'Cancelling...' : 'Cancel'}
          </button>
        </div>
      )}

      {/* QR Code Ready */}
      {formState === 'qr-ready' && qrPayload && (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <div className="rounded-lg bg-turquoise/10 p-4 text-center">
            <p className="text-turquoise">Scan with Vultisig App</p>
            <p className="mt-1 text-sm text-gray2 dark:text-gray2d">
              Open Vultisig on your phone and scan this QR code to join the vault
            </p>
          </div>

          <div className="rounded-lg bg-white p-4">
            <QRCode text={qrPayload} qrError="Failed to generate QR code" />
          </div>

          <p className="text-sm text-gray2 dark:text-gray2d">
            Waiting for device... ({devicesJoined + 1}/{devicesRequired} devices)
          </p>

          <button
            onClick={handleCancel}
            disabled={isCleaningUp}
            className="hover:border-error hover:text-error mt-2 flex items-center gap-2 rounded-lg border border-gray2/30 px-4 py-2 text-sm text-gray2 transition-colors dark:text-gray2d">
            <XMarkIcon className="h-4 w-4" />
            {isCleaningUp ? 'Cancelling...' : 'Cancel'}
          </button>
        </div>
      )}

      {/* Device Joined - still waiting for more */}
      {formState === 'device-joined' && qrPayload && (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <div className="rounded-lg bg-turquoise/10 p-4 text-center">
            <p className="text-turquoise">Device Connected!</p>
            <p className="mt-1 text-sm text-gray2 dark:text-gray2d">Waiting for more devices to join...</p>
          </div>

          <div className="rounded-lg bg-white p-4">
            <QRCode text={qrPayload} qrError="Failed to generate QR code" />
          </div>

          <p className="text-sm text-gray2 dark:text-gray2d">
            {devicesJoined}/{devicesRequired} devices joined
          </p>

          <button
            onClick={handleCancel}
            disabled={isCleaningUp}
            className="hover:border-error hover:text-error mt-2 flex items-center gap-2 rounded-lg border border-gray2/30 px-4 py-2 text-sm text-gray2 transition-colors dark:text-gray2d">
            <XMarkIcon className="h-4 w-4" />
            {isCleaningUp ? 'Cancelling...' : 'Cancel'}
          </button>
        </div>
      )}

      {/* Creating State */}
      {formState === 'creating' && (
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-turquoise border-t-transparent" />
          <p className="text-lg font-medium text-text1 dark:text-text1d">
            All devices joined! ({devicesJoined}/{devicesRequired})
          </p>
          <p className="text-gray2 dark:text-gray2d">{progressMessage || 'Running MPC keygen...'}</p>
          <p className="text-xs text-gray2 dark:text-gray2d">
            This may take a moment. Please keep both devices active.
          </p>

          <button
            onClick={handleCancel}
            disabled={isCleaningUp}
            className="hover:border-error hover:text-error mt-4 flex items-center gap-2 rounded-lg border border-gray2/30 px-4 py-2 text-sm text-gray2 transition-colors dark:text-gray2d">
            <XMarkIcon className="h-4 w-4" />
            {isCleaningUp ? 'Cancelling...' : 'Cancel'}
          </button>
        </div>
      )}

      {/* Success State */}
      {formState === 'success' && (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <CheckCircleIcon className="h-16 w-16 text-turquoise" />
          <h2 className="text-xl font-bold text-text1 dark:text-text1d">Secure Vault Created!</h2>

          <div className="w-full rounded-lg bg-bg2 p-4 dark:bg-bg2d">
            <h3 className="mb-3 text-sm font-medium text-gray2 dark:text-gray2d">Your Addresses</h3>
            <div className="flex flex-col gap-2">
              {Object.entries(addresses)
                .slice(0, 5)
                .map(([chain, address]) => (
                  <div key={chain} className="flex flex-col">
                    <span className="text-xs font-medium text-turquoise">{chain}</span>
                    <span className="break-all text-xs text-text1 dark:text-text1d">{address}</span>
                  </div>
                ))}
              {Object.keys(addresses).length > 5 && (
                <span className="text-xs text-gray2 dark:text-gray2d">
                  +{Object.keys(addresses).length - 5} more chains
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleGoToAssets}
            className="mt-4 w-full rounded-lg bg-turquoise px-6 py-3 font-medium text-black transition-colors hover:bg-turquoise/80">
            Go to Wallet
          </button>
        </div>
      )}

      {/* Error State */}
      {formState === 'error' && (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <ExclamationCircleIcon className="text-error h-16 w-16" />
          <h2 className="text-xl font-bold text-text1 dark:text-text1d">Failed to Create Vault</h2>
          <p className="text-center text-gray2 dark:text-gray2d">{error}</p>

          <button
            onClick={handleRetry}
            disabled={isCleaningUp}
            className={clsx(
              'mt-4 rounded-lg px-6 py-3 font-medium transition-colors',
              'bg-turquoise text-black hover:bg-turquoise/80',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}>
            {isCleaningUp ? 'Cleaning up...' : 'Try Again'}
          </button>
        </div>
      )}
    </div>
  )
}
