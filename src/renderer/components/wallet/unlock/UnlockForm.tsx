import React, { useCallback, useState, useEffect, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/lib/Option'
import { useForm } from 'react-hook-form'
import { useIntl } from 'react-intl'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

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
import { BackLinkButton } from '../../uielements/button'
import { BorderButton, FlatButton } from '../../uielements/button'
import { InputPasswordTW } from '../../uielements/input'
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

export const UnlockForm: React.FC<Props> = (props): JSX.Element => {
  const { keystore, unlock, removeKeystore, changeKeystore$, wallets } = props

  const [showRemoveModal, setShowRemoveModal] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
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
      FP.pipe(
        getUrlSearchParam(location.search, walletRoutes.REDIRECT_PARAMETER_NAME),
        O.alt(() => O.some((location.state as ReferrerState)?.referrer || walletRoutes.assets.template)),
        O.map((path) => navigate(path))
      )
    }
  }, [keystore, location, navigate, params, validPassword])

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
    navigate(walletRoutes.imports.base.path())
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
      <div className="relative mb-30px flex justify-center">
        <BackLinkButton className="absolute left-0 top-0" />
      </div>
      <form className="flex flex-1 flex-col" onSubmit={handleSubmit(submitForm)}>
        <div
          className="flex h-full
        flex-col items-center justify-between bg-bg1 pb-[35px]
        pl-30px pr-30px pt-[45px] dark:bg-bg1d sm:pb-[70px] sm:pl-[60px] sm:pr-[60px] sm:pt-[90px]">
          <div className="w-full max-w-[320px] space-y-3">
            <div className="flex flex-col">
              <h1 className="mb-12px inline-block w-full font-mainSemiBold text-18 uppercase text-text1 dark:text-text1d">
                {intl.formatMessage({ id: 'wallet.unlock.label' })}
              </h1>
              <h2 className="mb-30px w-full text-11 text-gray2 dark:text-gray2d">
                {intl.formatMessage({ id: 'wallet.unlock.password' })}
              </h2>
            </div>

            <WalletSelector
              wallets={wallets}
              onChange={changeWalletHandler}
              disabled={RD.isPending(changeWalletState)}
              className="mb-2 min-w-[200px] rounded-lg border border-solid border-gray1 dark:border-gray0d"
              buttonClassName="rounded-lg !shadow-none !dark:shadow-none !hover:shadow-none !hover:dark:shadow-none"
            />
            <InputPasswordTW
              id="password"
              className="mx-auto mb-20px flex h-10 w-full items-center justify-between rounded-lg border border-solid !border-gray1 pl-2 dark:!border-gray0d"
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
                {/* TODO: update locale */}
                <h2 className="mb-2 w-full text-11 text-gray2 dark:text-gray2d">Don&apos;t you have a wallet yet?</h2>
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
                  {intl.formatMessage({ id: 'wallet.action.import' })}
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
