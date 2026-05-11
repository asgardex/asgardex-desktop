import { useCallback, useState, useEffect, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { CpuChipIcon, ShieldCheckIcon, ArrowDownTrayIcon, BoltIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useForm } from 'react-hook-form'
import { useIntl } from 'react-intl'
import { useLocation, useNavigate } from 'react-router-dom'

import { KeystoreId } from '../../../../shared/api/types'
import { emptyString } from '../../../helpers/stringHelper'
import { getUrlSearchParam } from '../../../helpers/url.helper'
import { useSubscriptionState } from '../../../hooks/useSubscriptionState'
import * as appRoutes from '../../../routes/app'
import { ReferrerState } from '../../../routes/types'
import * as walletRoutes from '../../../routes/wallet'
import {
  ChangeKeystoreWalletHandler,
  ChangeKeystoreWalletRD,
  KeystoreState,
  KeystoreWalletsUI,
  RemoveKeystoreWalletHandler,
  VultisigVaultInfo
} from '../../../services/wallet/types'
import { isLocked, getWalletName } from '../../../services/wallet/util'
import { RemoveWalletConfirmationModal } from '../../modal/confirmation/RemoveWalletConfirmationModal'
import { BackLinkButton, BorderButton, FlatButton } from '../../uielements/button'
import { InputPassword } from '../../uielements/input'
import { WalletSelector } from '../../uielements/wallet'

type FormData = {
  password: string
}

export type Props = {
  keystore: KeystoreState
  unlock: (password: string) => Promise<void>
  removeKeystore: RemoveKeystoreWalletHandler
  changeKeystore$: ChangeKeystoreWalletHandler
  wallets: KeystoreWalletsUI
  vultisigVaults?: VultisigVaultInfo[]
  activeVultisigVaultId?: string | null
  onVultisigSelect?: (vaultId: string) => void
  // Vultisig unlock props
  isVultisigLocked?: boolean
  // True if the active Vultisig vault has a storage password. When false (and
  // isVultisigLocked), the password field is optional — submitting blank calls
  // onVultisigUnlock('') and vaultManager handles unencrypted vaults internally.
  isVultisigVaultEncrypted?: boolean
  onVultisigUnlock?: (password: string) => Promise<void>
  vultisigError?: string
  // Vultisig import handler
  onVultisigImport?: () => void
}

export const UnlockForm = ({
  keystore,
  unlock,
  removeKeystore,
  changeKeystore$,
  wallets,
  vultisigVaults = [],
  activeVultisigVaultId,
  onVultisigSelect,
  isVultisigLocked = false,
  isVultisigVaultEncrypted = true,
  onVultisigUnlock,
  vultisigError,
  onVultisigImport
}: Props) => {
  // Password is required for keystore unlock and for encrypted Vultisig vaults.
  // When the active Vultisig vault is unencrypted (and locked), allow blank
  // password — vaultManager.unlockVault handles unencrypted vaults internally.
  const passwordRequired = !(isVultisigLocked && !isVultisigVaultEncrypted)
  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const intl = useIntl()

  const {
    register,
    formState: { errors },
    handleSubmit
  } = useForm<FormData>()

  const [validPassword, setValidPassword] = useState(false)
  const [unlocking, setUnlocking] = useState(false)

  const [unlockError, setUnlockError] = useState<O.Option<Error>>(O.none)

  // Re-direct to previous view after unlocking the wallet
  useEffect(() => {
    if (!isLocked(keystore) && validPassword) {
      // Check if the current location is related to the swap screen (e.g., tradeAssets or interact with swap type)
      const isFromAssetScreen = (location.state as ReferrerState)?.referrer.includes('wallet/assets')

      if (isFromAssetScreen) {
        // Redirect to /assets for swap screen
        navigate(walletRoutes.assets.template)
      } else {
        FP.pipe(
          getUrlSearchParam(location.search, walletRoutes.REDIRECT_PARAMETER_NAME),
          O.alt(() => O.some((location.state as ReferrerState)?.referrer || walletRoutes.assets.template)),
          O.map((path) => navigate(path))
        )
      }
    }
  }, [keystore, location, navigate, validPassword])

  const submitForm = useCallback(
    async ({ password }: FormData) => {
      setUnlockError(O.none)
      setUnlocking(true)

      try {
        // Handle Vultisig vault unlock
        if (isVultisigLocked && onVultisigUnlock) {
          await onVultisigUnlock(password)
          setValidPassword(true)
        } else {
          // Handle keystore unlock
          await unlock(password)
          setValidPassword(true)
        }
      } catch (error) {
        setUnlockError(O.some(error as Error))
        setValidPassword(false)
      } finally {
        setUnlocking(false)
      }
    },
    [unlock, isVultisigLocked, onVultisigUnlock]
  )

  const showRemoveConfirm = useCallback(() => {
    setShowRemoveModal(true)
  }, [])

  const hideRemoveConfirm = useCallback(() => {
    setShowRemoveModal(false)
  }, [])

  const renderUnlockError = useMemo(
    () =>
      O.fold(
        () =>
          // Also show Vultisig error if present
          vultisigError ? <p className="mt-2 font-main text-sm text-error0 uppercase">{vultisigError}</p> : <></>,
        (_: Error) => (
          <p className="mt-2 font-main text-sm text-error0 uppercase">
            {intl.formatMessage({ id: 'wallet.unlock.error' })}
          </p>
        )
      )(unlockError),
    [unlockError, intl, vultisigError]
  )

  const removeConfirmed = useCallback(async () => {
    const noAccounts = await removeKeystore()
    if (noAccounts >= 1) {
      // unlock screen to unlock another account
      navigate(walletRoutes.locked.path())
    } else {
      // no account -> go to homepage
      navigate(appRoutes.base.template)
    }
  }, [navigate, removeKeystore])

  const walletName = useMemo(
    () =>
      FP.pipe(
        keystore,
        getWalletName,
        O.getOrElse(() => emptyString)
      ),
    [keystore]
  )

  const { state: changeWalletState, subscribe: subscribeChangeWalletState } =
    useSubscriptionState<ChangeKeystoreWalletRD>(RD.initial)

  const changeWalletHandler = useCallback(
    (id: KeystoreId) => {
      subscribeChangeWalletState(changeKeystore$(id))
      navigate(walletRoutes.locked.path())
    },
    [changeKeystore$, navigate, subscribeChangeWalletState]
  )
  const createWalletHandler = useCallback(() => {
    navigate(walletRoutes.create.phrase.path())
  }, [navigate])

  const importWalletHandler = useCallback(() => {
    navigate(walletRoutes.imports.keystore.path())
  }, [navigate])

  const importPhraseHandler = useCallback(() => {
    navigate(walletRoutes.imports.phrase.path())
  }, [navigate])

  const useLedgerOnlyHandler = useCallback(() => {
    navigate(walletRoutes.ledgerChainSelect.path())
  }, [navigate])

  const useVultisigFastHandler = useCallback(() => {
    navigate(walletRoutes.vultisigCreate.path())
  }, [navigate])

  const useVultisigSecureHandler = useCallback(() => {
    navigate(walletRoutes.vultisigSecureCreate.path())
  }, [navigate])

  const renderChangeWalletError = useMemo(
    () =>
      FP.pipe(
        changeWalletState,
        RD.fold(
          () => <></>,
          () => <></>,
          (error) => (
            <p className="px-5px font-main text-14 text-error0 uppercase dark:text-error0d">
              {intl.formatMessage({ id: 'wallet.change.error' })} {error.message || error.toString()}
            </p>
          ),

          () => <></>
        )
      ),
    [changeWalletState, intl]
  )

  return (
    <>
      <div className="mb-4">
        <BackLinkButton />
      </div>
      <form className="flex flex-1 flex-col" onSubmit={handleSubmit(submitForm)}>
        <div
          className={clsx(
            'flex h-full flex-col items-center justify-between',
            'rounded-lg bg-bg0 dark:bg-bg0d',
            'px-30px pt-[45px] pb-[35px] sm:px-[60px] sm:pt-[90px] sm:pb-[70px]'
          )}>
          <div className="w-full max-w-[320px]">
            <div className="flex flex-col">
              <h1 className="mb-12px inline-block w-full font-main-semi-bold text-18 text-text1 uppercase dark:text-text1d">
                {intl.formatMessage({ id: 'wallet.unlock.label' })}
              </h1>
              <h2 className="mb-30px w-full text-11 text-text2 dark:text-text2d">
                {intl.formatMessage({ id: 'wallet.unlock.password' })}
              </h2>
            </div>

            <div className="flex flex-col gap-2">
              <WalletSelector
                wallets={wallets}
                vultisigVaults={vultisigVaults}
                activeVultisigVaultId={activeVultisigVaultId}
                onChange={changeWalletHandler}
                onVultisigSelect={onVultisigSelect}
                disabled={RD.isPending(changeWalletState)}
                className="min-w-[200px] rounded-lg"
                buttonClassName="!shadow-none dark:!shadow-none hover:!shadow-none dark:hover:!shadow-none"
              />
              <InputPassword
                id="password"
                className="mx-auto flex h-[38px] w-full items-center justify-between"
                inputClassName="!ring-0 w-full"
                {...register('password', { required: passwordRequired })}
                placeholder={
                  passwordRequired
                    ? intl.formatMessage({ id: 'common.password' }).toUpperCase()
                    : `${intl.formatMessage({ id: 'common.password' }).toUpperCase()} (NOT REQUIRED)`
                }
                ghost
                size="normal"
                autoFocus={true}
                error={errors.password ? intl.formatMessage({ id: 'wallet.password.empty' }) : ''}
                disabled={unlocking}
              />
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <FlatButton
                type="submit"
                className="w-full min-w-[200px]"
                size="normal"
                color="primary"
                disabled={unlocking}
                loading={unlocking}>
                {intl.formatMessage({ id: 'wallet.action.unlock' })}
              </FlatButton>
              {/* Only show remove button for keystore, not Vultisig */}
              {!isVultisigLocked && (
                <BorderButton
                  className="w-full min-w-[200px]"
                  size="normal"
                  color="error"
                  onClick={showRemoveConfirm}
                  disabled={unlocking}>
                  {intl.formatMessage({ id: 'wallet.remove.label' })}
                </BorderButton>
              )}
            </div>

            <div className="my-6 border-t border-solid border-gray0 dark:border-gray0d" />

            <div className="flex flex-col gap-2">
              <BorderButton
                className="flex w-full min-w-[200px] items-center justify-center gap-2"
                size="normal"
                color="primary"
                onClick={useLedgerOnlyHandler}
                disabled={unlocking}>
                <CpuChipIcon width={16} height={16} />
                {intl.formatMessage({ id: 'wallet.unlock.useLedger' })}
              </BorderButton>
              <BorderButton
                className="flex w-full min-w-[200px] items-center justify-center gap-2"
                size="normal"
                color="primary"
                onClick={onVultisigImport}
                disabled={unlocking || !onVultisigImport}>
                <ArrowDownTrayIcon width={16} height={16} />
                {intl.formatMessage({ id: 'wallet.vultisig.import' })}
              </BorderButton>
            </div>

            <h2 className="mt-6 mb-3 w-full text-11 text-text2 dark:text-text2d">
              {intl.formatMessage({ id: 'wallet.unlock.noWallet' })}
            </h2>

            <div className="flex flex-col gap-2">
              <BorderButton
                className="w-full min-w-[200px]"
                size="normal"
                color="primary"
                onClick={createWalletHandler}
                disabled={unlocking}>
                {intl.formatMessage({ id: 'wallet.action.create' })} {intl.formatMessage({ id: 'common.keystore' })}
              </BorderButton>
              <BorderButton
                className="w-full min-w-[200px]"
                size="normal"
                color="primary"
                onClick={importWalletHandler}
                disabled={unlocking}>
                {intl.formatMessage({ id: 'wallet.action.import' })} {intl.formatMessage({ id: 'common.keystore' })}
              </BorderButton>
              <BorderButton
                className="w-full min-w-[200px]"
                size="normal"
                color="primary"
                onClick={importPhraseHandler}
                disabled={unlocking}>
                {intl.formatMessage({ id: 'wallet.action.import' })} {intl.formatMessage({ id: 'common.phrase' })}
              </BorderButton>
              <BorderButton
                className="flex w-full min-w-[200px] items-center justify-center gap-2"
                size="normal"
                color="primary"
                onClick={useVultisigFastHandler}
                disabled={unlocking}>
                <BoltIcon className="text-turquoise" width={16} height={16} />
                {intl.formatMessage({ id: 'wallet.vultisig.create.submit' })}
              </BorderButton>
              <BorderButton
                className="flex w-full min-w-[200px] items-center justify-center gap-2"
                size="normal"
                color="primary"
                onClick={useVultisigSecureHandler}
                disabled={unlocking}>
                <ShieldCheckIcon className="text-turquoise" width={16} height={16} />
                {intl.formatMessage({ id: 'wallet.vultisig.secureCreate.title' })}
              </BorderButton>
            </div>

            {renderChangeWalletError}
          </div>
          {renderUnlockError}
        </div>
      </form>
      <RemoveWalletConfirmationModal
        visible={showRemoveModal}
        onClose={hideRemoveConfirm}
        onSuccess={removeConfirmed}
        walletName={walletName}
      />
    </>
  )
}
