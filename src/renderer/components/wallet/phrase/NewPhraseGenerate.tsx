import React, { useCallback, useMemo, useState } from 'react'

import { generatePhrase } from '@xchainjs/xchain-crypto'
import { useObservableCallback, useSubscription } from 'observable-hooks'
import { useForm } from 'react-hook-form'
import { useIntl } from 'react-intl'
import * as RxOp from 'rxjs/operators'

import { defaultWalletName } from '../../../../shared/utils/wallet'
import { MAX_WALLET_NAME_CHARS } from '../../../services/wallet/const'
import { FlatButton, RefreshButton } from '../../uielements/button'
import { Input, InputPassword } from '../../uielements/input'
import { CopyLabel } from '../../uielements/label'
import type { WordType } from './NewPhraseConfirm.types'
import { PhraseInfo } from './Phrase.types'

export type FormValues = {
  password: string
  repeatPassword: string
  name: string
}

export type Props = {
  walletId: number
  walletNames: string[]
  onSubmit: (info: PhraseInfo) => void
}

export const NewPhraseGenerate = ({ onSubmit, walletId, walletNames }: Props) => {
  const [loading, setLoading] = useState(false)
  const intl = useIntl()

  const [phrase, setPhrase] = useState(generatePhrase())

  const initialWalletName = useMemo(() => defaultWalletName(walletId), [walletId])

  const [clickRefreshButtonHandler, refreshButtonClicked$] = useObservableCallback<React.MouseEvent>((event$) =>
    // Delay clicks to give `generatePhrase` some time to process w/o rendering issues
    // see https://github.com/thorchain/asgardex-electron/issues/2054
    event$.pipe(RxOp.debounceTime(100))
  )

  useSubscription(refreshButtonClicked$, () => setPhrase(generatePhrase()))

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm<FormValues>({
    mode: 'onChange',
    defaultValues: {
      password: '',
      repeatPassword: '',
      name: ''
    }
  })

  const password = watch('password')

  const handleFormFinish = useCallback(
    ({ password, name }: FormValues) => {
      if (!loading) {
        try {
          setLoading(true)
          onSubmit({ phrase, password, name: name || initialWalletName })
        } catch (_err) {
          setLoading(false)
        }
      }
    },
    [initialWalletName, loading, onSubmit, phrase]
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

  const phraseWords: WordType[] = useMemo(() => {
    const words = phrase.split(' ')
    return words.map((word: string, index: number) => ({ text: word, _id: `${word}-${index.toString()}` }))
  }, [phrase])

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative flex flex-col max-w-2xl w-full">
        <div className="flex items-center justify-between mb-4">
          <CopyLabel
            className="text-turquoise"
            textToCopy={phrase}
            label={intl.formatMessage({ id: 'wallet.create.copy.phrase' })}
          />
          <RefreshButton onClick={clickRefreshButtonHandler} />
        </div>
        <div className="grid grid-cols-3 border border-solid border-gray0 dark:border-gray0d rounded-xl p-2 gap-1">
          {phraseWords.map((word, index) => (
            <span
              key={word._id}
              className="text-sm bg-turquoise/10 text-text0 dark:text-text0d font-bold px-2 py-1 rounded-full">
              {index + 1}. {word.text}
            </span>
          ))}
        </div>
      </div>
      <form className="w-full pt-4" onSubmit={handleSubmit(handleFormFinish)}>
        <div className="flex flex-col items-center">
          <div className="w-full !max-w-[380px] mb-4">
            <label className="block mb-2 text-sm font-medium text-text0 dark:text-text0d">
              {intl.formatMessage({ id: 'common.password' })}
            </label>
            <InputPassword
              size="large"
              {...register('password', {
                required: intl.formatMessage({ id: 'wallet.validations.shouldNotBeEmpty' })
              })}
              error={errors.password?.message}
            />
          </div>

          <div className="w-full !max-w-[380px] mb-4">
            <label className="block mb-2 text-sm font-medium text-text0 dark:text-text0d">
              {intl.formatMessage({ id: 'wallet.password.repeat' })}
            </label>
            <InputPassword
              size="large"
              {...register('repeatPassword', {
                required: intl.formatMessage({ id: 'wallet.validations.shouldNotBeEmpty' }),
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

          <div className="w-full !max-w-[380px] mb-4">
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
              placeholder={initialWalletName}
              {...register('name', {
                validate: walletNameValidator
              })}
              error={!!errors.name?.message}
            />
          </div>

          <FlatButton
            className="mt-4 min-w-40"
            size="large"
            color="primary"
            type="submit"
            loading={loading}
            disabled={loading}>
            {intl.formatMessage({ id: 'common.next' })}
          </FlatButton>
        </div>
      </form>
    </div>
  )
}
