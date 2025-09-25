import { useCallback, useState, useEffect, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Textarea } from '@headlessui/react'
import * as crypto from '@xchainjs/xchain-crypto'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useForm } from 'react-hook-form'
import { useIntl } from 'react-intl'

import { defaultWalletName } from '../../../../shared/utils/wallet'
import { KeystoreClientStates } from '../../../hooks/useKeystoreClientStates'
import { MAX_WALLET_NAME_CHARS } from '../../../services/wallet/const'
import { AddKeystoreParams } from '../../../services/wallet/types'
import { FlatButton } from '../../uielements/button'
import { InputPassword, Input } from '../../uielements/input'
import { Spin } from '../../uielements/spin'

type FormValues = {
  phrase: string
  password: string
  repeatPassword: string
  name: string
}

type Props = {
  walletId: number
  walletNames: string[]
  addKeystore: (params: AddKeystoreParams) => Promise<void>
  clientStates: KeystoreClientStates
}

export const ImportPhrase = (props: Props): JSX.Element => {
  const { addKeystore, clientStates, walletId, walletNames } = props

  const intl = useIntl()

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch
  } = useForm<FormValues>({
    mode: 'onChange',
    defaultValues: {
      phrase: '',
      password: '',
      repeatPassword: '',
      name: ''
    }
  })

  const password = watch('password')

  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<O.Option<Error>>(O.none)

  useEffect(() => {
    FP.pipe(
      clientStates,
      RD.fold(
        () => {
          // reset states
          setImportError(O.none)
          setImporting(false)
        },
        () => {
          setImporting(true)
        },
        (error) => {
          setImportError(O.some(Error(`Could not create client: ${error?.message ?? error.toString()}`)))
        },
        (_) => {}
      )
    )
  }, [clientStates])

  const submitForm = useCallback(
    async ({ phrase: newPhrase, password, name }: FormValues) => {
      setImportError(O.none)
      setImporting(true)
      await addKeystore({ phrase: newPhrase, name: name || defaultWalletName(walletId), id: walletId, password }).catch(
        (error) => {
          setImporting(false)
          setImportError(O.some(error))
        }
      )
    },
    [addKeystore, walletId]
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

  const renderImportError = useMemo(
    () =>
      FP.pipe(
        importError,
        O.fold(
          () => <></>,
          (error: Error) => (
            <div className="text-error0 dark:text-error0d">
              {intl.formatMessage({ id: 'wallet.phrase.error.import' })}: {error.toString()}
            </div>
          )
        )
      ),
    [importError, intl]
  )

  return (
    <Spin spinning={importing} tip={intl.formatMessage({ id: 'common.loading' })}>
      <form className="w-full p-8 pt-4" onSubmit={handleSubmit(submitForm)}>
        <div className="flex flex-col items-center">
          {/* phrase */}
          <div className="w-full mb-4">
            <label className="block mb-2 text-sm font-medium text-text0 dark:text-text0d">
              {intl.formatMessage({ id: 'wallet.imports.enterphrase' })}
            </label>
            <Textarea
              className={clsx(
                'w-full p-2 text-14 bg-bg0 dark:bg-bg0d rounded-lg',
                'border border-solid',
                'placeholder:text-gray-300 dark:placeholder:text-gray-400',
                'text-text0 dark:text-text0d',
                'font-main focus:outline-none',
                errors.phrase ? 'border-error0 dark:border-error0d' : 'border-gray0 dark:border-gray0d'
              )}
              placeholder={intl.formatMessage({ id: 'wallet.imports.enterphrase' })}
              rows={5}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="text"
              {...register('phrase', {
                required: intl.formatMessage({ id: 'wallet.phrase.error.valueRequired' }),
                validate: (value) => {
                  if (!value) return intl.formatMessage({ id: 'wallet.phrase.error.valueRequired' })
                  const valid = crypto.validatePhrase(value)
                  return valid || intl.formatMessage({ id: 'wallet.phrase.error.invalid' })
                }
              })}
            />
            {errors.phrase && <p className="mt-2 font-main text-sm uppercase text-error0">{errors.phrase.message}</p>}
          </div>

          {renderImportError}

          {/* password */}
          <div className="w-full mb-4">
            <label className="block mb-2 text-sm font-medium text-text0 dark:text-text0d">
              {intl.formatMessage({ id: 'common.password' })}
            </label>
            <InputPassword
              size="large"
              {...register('password', {
                required: intl.formatMessage({ id: 'wallet.password.empty' })
              })}
              error={errors.password?.message}
            />
          </div>

          {/* repeat password */}
          <div className="w-full mb-4">
            <label className="block mb-2 text-sm font-medium text-text0 dark:text-text0d">
              {intl.formatMessage({ id: 'wallet.password.repeat' })}
            </label>
            <InputPassword
              size="large"
              {...register('repeatPassword', {
                required: intl.formatMessage({ id: 'wallet.password.empty' }),
                validate: (value) => {
                  // eslint-disable-next-line security/detect-possible-timing-attacks
                  if (value !== password) {
                    return intl.formatMessage({ id: 'wallet.password.mismatch' })
                  }
                  return true
                }
              })}
              error={errors.repeatPassword?.message}
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

          <FlatButton
            className="mt-4 min-w-[150px]"
            size="large"
            color="primary"
            type="submit"
            disabled={!isValid || importing}>
            {intl.formatMessage({ id: 'wallet.action.import' })}
          </FlatButton>
        </div>
      </form>
    </Spin>
  )
}
