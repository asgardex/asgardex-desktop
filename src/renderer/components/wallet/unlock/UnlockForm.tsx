import { useCallback, useState, useEffect, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { CpuChipIcon } from '@heroicons/react/24/outline'
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
  RemoveKeystoreWalletHandler
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
}

export const UnlockForm = ({ keystore, unlock, removeKeystore, changeKeystore$, wallets }: Props) => {
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
      await unlock(password).catch((error) => {
        setUnlockError(O.some(error))
        setValidPassword(false)
      })
      setUnlocking(false)
      setValidPassword(true)
    },
    [unlock]
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
        () => <></>,
        (_: Error) => (
          <p className="mt-2 font-main text-sm uppercase text-error0">
            {intl.formatMessage({ id: 'wallet.unlock.error' })}
          </p>
        )
      )(unlockError),
    [unlockError, intl]
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

  const renderChangeWalletError = useMemo(
    () =>
      FP.pipe(
        changeWalletState,
        RD.fold(
          () => <></>,
          () => <></>,
          (error) => (
            <p className="px-5px font-main text-14 uppercase text-error0 dark:text-error0d">
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
            'bg-bg0 dark:bg-bg0d rounded-lg',
            'px-30px pt-[45px] pb-[35px] sm:pb-[70px] sm:px-[60px] sm:pt-[90px]'
          )}>
          <div className="w-full max-w-[320px] space-y-3">
            <div className="flex flex-col">
              <h1 className="mb-12px inline-block w-full font-mainSemiBold text-18 uppercase text-text1 dark:text-text1d">
                {intl.formatMessage({ id: 'wallet.unlock.label' })}
              </h1>
              <h2 className="mb-30px w-full text-11 text-text2 dark:text-text2d">
                {intl.formatMessage({ id: 'wallet.unlock.password' })}
              </h2>
            </div>

            <WalletSelector
              wallets={wallets}
              onChange={changeWalletHandler}
              disabled={RD.isPending(changeWalletState)}
              className="mb-2 min-w-[200px] rounded-lg"
              buttonClassName="!shadow-none !dark:shadow-none !hover:shadow-none !hover:dark:shadow-none"
            />
            <InputPassword
              id="password"
              className="mx-auto mb-20px flex h-10 w-full items-center justify-between rounded-lg border border-solid !border-gray0 dark:!border-gray0d"
              inputClassName="!ring-0 w-full"
              {...register('password', { required: true })}
              placeholder={intl.formatMessage({ id: 'common.password' }).toUpperCase()}
              size="normal"
              autoFocus={true}
              error={errors.password ? intl.formatMessage({ id: 'wallet.password.empty' }) : ''}
              disabled={unlocking}
            />
            <FlatButton
              type="submit"
              className="w-full min-w-[200px] sm:mb-0"
              size="normal"
              color="primary"
              disabled={unlocking}
              loading={unlocking}>
              {intl.formatMessage({ id: 'wallet.action.unlock' })}
            </FlatButton>
            <BorderButton
              className="w-full min-w-[200px] sm:mb-0"
              size="normal"
              color="error"
              onClick={showRemoveConfirm}
              disabled={unlocking}>
              {intl.formatMessage({ id: 'wallet.remove.label' })}
            </BorderButton>
            <div className="flex w-full flex-col items-center border-t border-solid border-gray1 dark:border-gray0d">
              <div className="flex w-full flex-col justify-between space-y-3 pt-4">
                <BorderButton
                  className="w-full min-w-[200px] flex items-center justify-center gap-2"
                  size="normal"
                  color="primary"
                  onClick={useLedgerOnlyHandler}
                  disabled={unlocking}>
                  <CpuChipIcon width={16} height={16} />
                  Use Only Ledger
                </BorderButton>
                {/* TODO: update locale */}
                <h2 className="mb-2 w-full text-11 text-text2 dark:text-text2d">Don&apos;t you have a wallet yet?</h2>
                <BorderButton
                  className="mr-20px w-full min-w-[200px] sm:mb-0"
                  size="normal"
                  color="primary"
                  onClick={createWalletHandler}
                  disabled={unlocking}>
                  {intl.formatMessage({ id: 'wallet.action.create' })}
                </BorderButton>
                <BorderButton
                  className="mr-20px w-full min-w-[200px] sm:mb-0"
                  size="normal"
                  color="primary"
                  onClick={importWalletHandler}
                  disabled={unlocking}>
                  {intl.formatMessage({ id: 'wallet.action.import' })} {intl.formatMessage({ id: 'common.keystore' })}
                </BorderButton>
                <BorderButton
                  className="mr-20px w-full min-w-[200px] sm:mb-0"
                  size="normal"
                  color="primary"
                  onClick={importPhraseHandler}
                  disabled={unlocking}>
                  {intl.formatMessage({ id: 'wallet.action.import' })} {intl.formatMessage({ id: 'common.phrase' })}
                </BorderButton>
              </div>

              {renderChangeWalletError}
            </div>
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
