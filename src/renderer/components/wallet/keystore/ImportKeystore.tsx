import { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { CheckCircleIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { Keystore } from '@xchainjs/xchain-crypto'
import { function as FP } from 'fp-ts'
import { useForm } from 'react-hook-form'
import { useIntl } from 'react-intl'

/* css import is needed to override antd */
import '../../uielements/input/overrides.css'

import { defaultWalletName } from '../../../../shared/utils/wallet'
import { KeystoreClientStates } from '../../../hooks/useKeystoreClientStates'
import { useSubscriptionState } from '../../../hooks/useSubscriptionState'
import { MAX_WALLET_NAME_CHARS } from '../../../services/wallet/const'
import { ImportingKeystoreStateRD, ImportKeystoreParams, LoadKeystoreLD } from '../../../services/wallet/types'
import { BorderButton, FlatButton } from '../../uielements/button'
import { InputPassword, Input } from '../../uielements/input'
import { Label } from '../../uielements/label'

type FormValues = {
  password: string
  name: string
}

export type Props = {
  walletId: number
  walletNames: string[]
  clientStates: KeystoreClientStates
  importKeystore: (params: ImportKeystoreParams) => Promise<void>
  loadKeystore$: () => LoadKeystoreLD
  importingKeystoreState: ImportingKeystoreStateRD
}

export const ImportKeystore = (props: Props): JSX.Element => {
  const { importKeystore, importingKeystoreState, loadKeystore$, clientStates, walletId, walletNames } = props

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    defaultValues: {
      password: '',
      name: ''
    }
  })

  const intl = useIntl()

  const { state: loadKeystoreState, subscribe: subscribeLoadKeystoreState } = useSubscriptionState<
    RD.RemoteData<Error, Keystore>
  >(RD.initial)

  const submitForm = useCallback(
    async ({ password, name }: FormValues) => {
      if (RD.isSuccess(loadKeystoreState)) {
        try {
          await importKeystore({
            keystore: loadKeystoreState.value,
            password,
            id: walletId,
            name: name || defaultWalletName(walletId)
          })
        } catch {
          console.error('Error importing keystore')
        }
      }
    },
    [importKeystore, loadKeystoreState, walletId]
  )

  const uploadKeystore = () => {
    subscribeLoadKeystoreState(loadKeystore$())
  }

  const renderError = (msg: string) => (
    <Label className="font-main mb-20px" color="error" size="normal" textTransform="uppercase">
      {msg}
    </Label>
  )

  const renderImportError = useMemo(
    () =>
      FP.pipe(
        importingKeystoreState,
        RD.fold(
          () => <></>,
          () => <></>,
          (_) => renderError(intl.formatMessage({ id: 'wallet.imports.error.keystore.password' })),
          () => <></>
        )
      ),
    [importingKeystoreState, intl]
  )

  const renderLoadError = useMemo(
    () =>
      FP.pipe(
        loadKeystoreState,
        RD.fold(
          () => <></>,
          () => <></>,
          (_) => renderError(intl.formatMessage({ id: 'wallet.imports.error.keystore.load' })),
          () => <></>
        )
      ),
    [loadKeystoreState, intl]
  )

  const renderClientError = useMemo(
    () =>
      FP.pipe(
        clientStates,
        RD.fold(
          () => <></>,
          () => <></>,
          (error) => renderError(`Could not create client: ${error?.message ?? error.toString()}`),
          () => <></>
        )
      ),
    [clientStates]
  )

  const walletNameValidator = useCallback(
    (value: string) => {
      if (walletNames.includes(value)) {
        return intl.formatMessage({ id: 'wallet.name.error.duplicated' })
      }
      return true
    },
    [intl, walletNames]
  )

  return (
    <form className="w-full p-8 pt-4" onSubmit={handleSubmit(submitForm)}>
      {renderClientError}
      <div className="flex flex-col items-center">
        {/* import button */}
        <BorderButton
          className="mb-2 cursor-pointer !rounded-lg w-full"
          type="button"
          size="large"
          onClick={uploadKeystore}>
          {RD.isSuccess(loadKeystoreState) ? (
            <CheckCircleIcon className="w-4 h-4 text-turquoise" />
          ) : (
            <ArrowUpTrayIcon className="w-4 h-4" />
          )}
          <span className="ml-2">{intl.formatMessage({ id: 'wallet.imports.keystore.select' })}</span>
        </BorderButton>
        {renderLoadError}
        {renderImportError}
        {/* password */}
        <div className="w-full mb-4">
          <label className="block mb-2 text-sm font-medium text-text0 dark:text-text0d">
            {intl.formatMessage({ id: 'common.keystorePassword' })}
          </label>
          <InputPassword
            size="large"
            {...register('password', {
              required: intl.formatMessage({ id: 'wallet.password.empty' })
            })}
            error={errors.password?.message}
          />
        </div>
        {/* name */}
        <div className="w-full mb-4">
          <label className="block mb-2 text-sm font-medium text-text0 dark:text-text0d">
            <div>
              {intl.formatMessage({ id: 'wallet.name' })}
              <span className="pl-5px text-[12px] text-gray1 dark:text-gray1d">
                ({intl.formatMessage({ id: 'wallet.name.maxChars' }, { max: MAX_WALLET_NAME_CHARS })})
              </span>
            </div>
          </label>
          <Input
            size="large"
            maxLength={MAX_WALLET_NAME_CHARS}
            placeholder={defaultWalletName(walletId)}
            {...register('name', {
              validate: walletNameValidator
            })}
            error={!!errors.name?.message}
          />
        </div>
        {/* submit button */}
        <FlatButton
          className="mt-4 min-w-40"
          size="large"
          color="primary"
          type="submit"
          disabled={!RD.isSuccess(loadKeystoreState) || RD.isPending(importingKeystoreState)}>
          {intl.formatMessage({ id: 'wallet.action.import' })}
        </FlatButton>
      </div>
    </form>
  )
}
