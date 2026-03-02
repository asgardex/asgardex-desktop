import { useCallback, useEffect, useRef, useState } from 'react'

import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { BackLinkButton } from '../../../components/uielements/button'
import { Input } from '../../../components/uielements/input/Input'
import { InputPassword } from '../../../components/uielements/input/InputPassword'
import { useWalletContext } from '../../../contexts/WalletContext'
import { createScopedLogger } from '../../../helpers/logger'

const logger = createScopedLogger('FastVault')
import * as walletRoutes from '../../../routes/wallet'
import { isVultisigMode } from '../../../services/wallet/types'

type FormState = 'input' | 'creating' | 'verify' | 'success' | 'error'

export const VaultCreateView = () => {
  const navigate = useNavigate()
  const intl = useIntl()
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

  // Track mounted state to guard async setState calls
  const mountedRef = useRef(true)
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleCreateVault = useCallback(async () => {
    if (!name || !email || !password) {
      setError(intl.formatMessage({ id: 'wallet.vultisig.create.fillAllFields' }))
      return
    }

    setFormState('creating')
    setError(null)

    try {
      const vaultId = await appWalletService.vaultManager.createFastVault({ name, email, password })
      if (!mountedRef.current) return
      setPendingVaultId(vaultId)
      setFormState('verify')
    } catch (err) {
      logger.error('Failed to create vault:', err)
      if (!mountedRef.current) return
      setError(String(err))
      setFormState('error')
    }
  }, [name, email, password, appWalletService, intl])

  const handleVerify = useCallback(async () => {
    if (!pendingVaultId || !verificationCode) {
      setError(intl.formatMessage({ id: 'wallet.vultisig.create.verify.enterCode' }))
      return
    }

    setFormState('creating')
    setError(null)

    try {
      // vaultManager.verifyVault handles loadVaults + selectVault(id, false) internally
      await appWalletService.vaultManager.verifyVault(pendingVaultId, verificationCode)
      if (!mountedRef.current) return

      // Get addresses from vaultManager state (set by verifyVault → selectVault)
      const state = appWalletService.vaultManager.vultisigState()
      setAddresses(state.addresses)

      // Clear sensitive data from state
      setPassword('')
      setVerificationCode('')

      setFormState('success')
    } catch (err) {
      logger.error('Failed to verify vault:', err)
      if (!mountedRef.current) return
      setError(String(err))
      setFormState('verify') // Stay on verify to retry
    }
  }, [pendingVaultId, verificationCode, appWalletService, intl])

  const handleGoToAssets = useCallback(() => {
    // vaultManager.verifyVault already set the active vault via selectVault(id, false)
    // Just switch to Vultisig mode and navigate
    appWalletService.switchToVultisigMode(true)
    navigate(walletRoutes.assets.path())
  }, [appWalletService, navigate])

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-6 bg-bg1 p-8 dark:bg-bg1d">
      <div className="absolute top-4 left-4">
        <BackLinkButton path={walletRoutes.noWallet.path()} />
      </div>

      <h1 className="text-2xl font-bold text-text1 dark:text-text1d">
        {intl.formatMessage({ id: 'wallet.vultisig.create.title' })}
      </h1>

      {/* Input Form */}
      {formState === 'input' && (
        <div className="flex w-full max-w-md flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'wallet.vultisig.create.vaultName' })}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={intl.formatMessage({ id: 'wallet.vultisig.create.vaultName.placeholder' })}
              size="large"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'wallet.vultisig.create.email' })}
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={intl.formatMessage({ id: 'wallet.vultisig.create.email.placeholder' })}
              size="large"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'common.password' })}
            </label>
            <InputPassword
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={intl.formatMessage({ id: 'wallet.vultisig.create.password.placeholder' })}
              size="large"
            />
            <span className="text-xs text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'wallet.vultisig.create.password.hint' })}
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
            {intl.formatMessage({ id: 'wallet.vultisig.create.submit' })}
          </button>
        </div>
      )}

      {/* Creating State */}
      {formState === 'creating' && (
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-turquoise border-t-transparent" />
          <p className="text-gray2 dark:text-gray2d">
            {vultisigState?.creationProgress || intl.formatMessage({ id: 'wallet.vultisig.create.creating' })}
          </p>
        </div>
      )}

      {/* Verification Form */}
      {formState === 'verify' && (
        <div className="flex w-full max-w-md flex-col gap-4">
          <div className="rounded-lg bg-turquoise/10 p-4 text-center">
            <p className="text-turquoise">{intl.formatMessage({ id: 'wallet.vultisig.create.verify.checkEmail' })}</p>
            <p className="mt-1 text-sm text-gray2 dark:text-gray2d">{email}</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'wallet.vultisig.create.verify.code' })}
            </label>
            <Input
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder={intl.formatMessage({ id: 'wallet.vultisig.create.verify.code.placeholder' })}
              size="large"
              className="text-center text-xl tracking-widest"
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
            {intl.formatMessage({ id: 'wallet.vultisig.create.verify.submit' })}
          </button>
        </div>
      )}

      {/* Success State */}
      {formState === 'success' && (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <CheckCircleIcon className="h-16 w-16 text-turquoise" />
          <h2 className="text-xl font-bold text-text1 dark:text-text1d">
            {intl.formatMessage({ id: 'wallet.vultisig.create.success' })}
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
            onClick={() => setFormState('input')}
            className="mt-4 rounded-lg bg-turquoise px-6 py-3 font-medium text-black transition-colors hover:bg-turquoise/80">
            {intl.formatMessage({ id: 'wallet.vultisig.create.tryAgain' })}
          </button>
        </div>
      )}
    </div>
  )
}
