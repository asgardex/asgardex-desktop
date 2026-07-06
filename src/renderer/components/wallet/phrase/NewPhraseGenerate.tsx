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

  // Recovery phrase length in words. 12 (128-bit) stays the default; 24 (256-bit)
  // is offered for users who want a higher-entropy phrase.
  const [size, setSize] = useState<12 | 24>(12)
  const [phrase, setPhrase] = useState(() => generatePhrase(size))

  const initialWalletName = useMemo(() => defaultWalletName(walletId), [walletId])

  const [clickRefreshButtonHandler, refreshButtonClicked$] = useObservableCallback<React.MouseEvent>((event$) =>
    // Delay clicks to give `generatePhrase` some time to process w/o rendering issues
    // see https://github.com/thorchain/asgardex-electron/issues/2054
    event$.pipe(RxOp.debounceTime(100))
  )

  useSubscription(refreshButtonClicked$, () => setPhrase(generatePhrase(size)))

  const changeSize = useCallback((newSize: 12 | 24) => {
    setSize(newSize)
    setPhrase(generatePhrase(newSize))
  }, [])

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
      <div className="relative flex w-full max-w-2xl flex-col">
        <div className="mb-4 flex items-center justify-between">
          <CopyLabel
            className="text-turquoise"
            textToCopy={phrase}
            label={intl.formatMessage({ id: 'wallet.create.copy.phrase' })}
          />
          <div className="flex items-center gap-3">
            <div
              className="flex overflow-hidden rounded-full border border-solid border-gray0 dark:border-gray0d"
              role="group"
              aria-label={intl.formatMessage({ id: 'wallet.create.phrase.length' })}>
              {([12, 24] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => changeSize(option)}
                  aria-pressed={size === option}
                  className={`px-3 py-1 text-sm font-bold transition-colors ${
                    size === option
                      ? 'bg-turquoise text-white'
                      : 'bg-transparent text-text2 hover:text-text0 dark:text-text2d dark:hover:text-text0d'
                  }`}>
                  {intl.formatMessage({ id: 'wallet.create.phrase.words' }, { count: option })}
                </button>
              ))}
            </div>
            <RefreshButton onClick={clickRefreshButtonHandler} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-solid border-gray0 p-2 dark:border-gray0d">
          {phraseWords.map((word, index) => (
            <span
              key={word._id}
              className="rounded-full bg-turquoise/10 px-2 py-1 text-sm font-bold text-text0 dark:text-text0d">
              {index + 1}. {word.text}
            </span>
          ))}
        </div>
      </div>
      <form className="w-full pt-4" onSubmit={handleSubmit(handleFormFinish)}>
        <div className="flex flex-col items-center">
          <div className="mb-4 w-full !max-w-[380px]">
            <label className="mb-2 block text-sm font-medium text-text0 dark:text-text0d">
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

          <div className="mb-4 w-full !max-w-[380px]">
            <label className="mb-2 block text-sm font-medium text-text0 dark:text-text0d">
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

          <div className="mb-4 w-full !max-w-[380px]">
            <label className="mb-2 block text-sm font-medium text-text0 dark:text-text0d">
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
