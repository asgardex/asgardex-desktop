import { useCallback, useState } from 'react'

import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useObservableState } from 'observable-hooks'
import { useNavigate } from 'react-router-dom'

import { BackLinkButton } from '../../../components/uielements/button'
import { useWalletContext } from '../../../contexts/WalletContext'
import * as walletRoutes from '../../../routes/wallet'
import { isVultisigMode } from '../../../services/wallet/types'

type FormState = 'input' | 'creating' | 'verify' | 'success' | 'error'

export const VaultCreateView = () => {
  const navigate = useNavigate()
  const { appWalletService } = useWalletContext()

  const appWalletState = useObservableState(appWalletService.appWalletState$)
  const vultisigState = appWalletState && isVultisigMode(appWalletState) ? appWalletState : null

  const [formState, setFormState] = useState<FormState>('input')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingVaultId, setPendingVaultId] = useState<string | null>(null)
  const [addresses, setAddresses] = useState<Record<string, string>>({})

  const handleCreateVault = useCallback(async () => {
    if (!name || !email || !password) {
      setError('Please fill in all fields')
      return
    }

    setFormState('creating')
    setError(null)

    try {
      // Initialize SDK first
      await window.apiMpc.init()

      // Create fast vault
      const result = await window.apiMpc.createFastVault({ name, email, password })
      setPendingVaultId(result.vaultId)
      setFormState('verify')
    } catch (err) {
      window.apiLog.error('[FastVault]', 'Failed to create vault:', err)
      setError(String(err))
      setFormState('error')
    }
  }, [name, email, password])

  const handleVerify = useCallback(async () => {
    if (!pendingVaultId || !verificationCode) {
      setError('Please enter the verification code')
      return
    }

    setFormState('creating')
    setError(null)

    try {
      const vault = await window.apiMpc.verifyVault(pendingVaultId, verificationCode)

      // Get addresses
      const addrs = await window.apiMpc.getAddresses(vault.id)
      setAddresses(addrs)

      // Clear sensitive data from state
      setPassword('')
      setVerificationCode('')

      setFormState('success')
    } catch (err) {
      window.apiLog.error('[FastVault]', 'Failed to verify vault:', err)
      setError(String(err))
      setFormState('verify') // Stay on verify to retry
    }
  }, [pendingVaultId, verificationCode])

  const handleGoToAssets = useCallback(() => {
    // Switch to Vultisig mode and navigate to assets
    appWalletService.switchToVultisigMode(true)
    navigate(walletRoutes.assets.path())
  }, [appWalletService, navigate])

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 bg-bg1 p-8 dark:bg-bg1d">
      <div className="absolute top-4 left-4">
        <BackLinkButton path={walletRoutes.noWallet.path()} />
      </div>

      <h1 className="text-2xl font-bold text-text1 dark:text-text1d">Create Vultisig Vault</h1>

      {/* Input Form */}
      {formState === 'input' && (
        <div className="flex w-full max-w-md flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray2 dark:text-gray2d">Vault Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Vault"
              className="rounded-lg border border-gray2/20 bg-bg2 p-3 text-text1 outline-none focus:border-turquoise dark:border-gray2d/20 dark:bg-bg2d dark:text-text1d"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray2 dark:text-gray2d">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="rounded-lg border border-gray2/20 bg-bg2 p-3 text-text1 outline-none focus:border-turquoise dark:border-gray2d/20 dark:bg-bg2d dark:text-text1d"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray2 dark:text-gray2d">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="rounded-lg border border-gray2/20 bg-bg2 p-3 text-text1 outline-none focus:border-turquoise dark:border-gray2d/20 dark:bg-bg2d dark:text-text1d"
            />
            <span className="text-xs text-gray2 dark:text-gray2d">
              This password will encrypt your vault. Remember it - you&apos;ll need it to sign transactions.
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
            disabled={!name || !email || !password}
            className={clsx(
              'mt-4 rounded-lg px-6 py-3 font-medium transition-colors',
              'bg-turquoise text-black hover:bg-turquoise/80',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}>
            Create Fast Vault
          </button>
        </div>
      )}

      {/* Creating State */}
      {formState === 'creating' && (
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-turquoise border-t-transparent" />
          <p className="text-gray2 dark:text-gray2d">{vultisigState?.creationProgress || 'Creating vault...'}</p>
        </div>
      )}

      {/* Verification Form */}
      {formState === 'verify' && (
        <div className="flex w-full max-w-md flex-col gap-4">
          <div className="rounded-lg bg-turquoise/10 p-4 text-center">
            <p className="text-turquoise">Check your email for a verification code</p>
            <p className="mt-1 text-sm text-gray2 dark:text-gray2d">{email}</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray2 dark:text-gray2d">Verification Code</label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter code from email"
              className="rounded-lg border border-gray2/20 bg-bg2 p-3 text-center text-xl tracking-widest text-text1 outline-none focus:border-turquoise dark:border-gray2d/20 dark:bg-bg2d dark:text-text1d"
            />
          </div>

          {error && (
            <div className="bg-error/10 text-error flex items-center gap-2 rounded-lg p-3">
              <ExclamationCircleIcon className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={!verificationCode}
            className={clsx(
              'mt-4 rounded-lg px-6 py-3 font-medium transition-colors',
              'bg-turquoise text-black hover:bg-turquoise/80',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}>
            Verify & Complete
          </button>
        </div>
      )}

      {/* Success State */}
      {formState === 'success' && (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <CheckCircleIcon className="h-16 w-16 text-turquoise" />
          <h2 className="text-xl font-bold text-text1 dark:text-text1d">Vault Created Successfully!</h2>

          <div className="w-full rounded-lg bg-bg2 p-4 dark:bg-bg2d">
            <h3 className="mb-3 text-sm font-medium text-gray2 dark:text-gray2d">Your Addresses</h3>
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
            onClick={() => setFormState('input')}
            className="mt-4 rounded-lg bg-turquoise px-6 py-3 font-medium text-black transition-colors hover:bg-turquoise/80">
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
