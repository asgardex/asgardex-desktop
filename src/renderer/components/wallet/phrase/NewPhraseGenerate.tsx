import React, { useState, useCallback, useMemo } from 'react'

import { generatePhrase } from '@xchainjs/xchain-crypto'
import Form, { Rule } from 'antd/lib/form'
import { array as A, function as FP, nonEmptyArray as NEA, string as S } from 'fp-ts'
import { useObservableCallback, useSubscription } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as RxOp from 'rxjs/operators'

import { defaultWalletName } from '../../../../shared/utils/wallet'
import { MAX_WALLET_NAME_CHARS } from '../../../services/wallet/const'
import { FlatButton, RefreshButton } from '../../uielements/button'
import { InputPassword, Input } from '../../uielements/input'
import { CopyLabel } from '../../uielements/label'
import type { WordType } from './NewPhraseConfirm.types'
import { PhraseInfo } from './Phrase.types'

type Props = {
  walletId: number
  walletNames: string[]
  onSubmit: (info: PhraseInfo) => void
}

type FormValues = {
  password: string
  name: string
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

  const phraseWords: WordType[] = useMemo(
    () =>
      FP.pipe(
        phrase,
        S.split(' '),
        NEA.fromReadonlyNonEmptyArray,
        A.mapWithIndex((index, word) => ({ text: word, _id: `${word}-${index.toString()}` }))
      ),
    [phrase]
  )

  const [form] = Form.useForm<FormValues>()

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

  const passwordRules: Rule[] = useMemo(
    () => [
      { required: true, message: intl.formatMessage({ id: 'wallet.validations.shouldNotBeEmpty' }) },
      ({ getFieldValue }) => ({
        validator(_, value) {
          if (!value || getFieldValue('password') === value) {
            return Promise.resolve()
          }
          return Promise.reject(intl.formatMessage({ id: 'wallet.password.mismatch' }))
        }
      })
    ],
    [intl]
  )

  const walletNameValidator = useCallback(
    async (_: unknown, value: string) => {
      if (walletNames.includes(value)) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.name.error.duplicated' }))
      }
    },
    [intl, walletNames]
  )

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
      <Form form={form} onFinish={handleFormFinish} labelCol={{ span: 24 }} className="w-full p-30px pt-15px">
        <div className="flex flex-col items-center">
          <Form.Item
            name="password"
            className="w-full !max-w-[380px]"
            validateTrigger={['onSubmit', 'onBlur']}
            rules={passwordRules}
            label={intl.formatMessage({ id: 'common.password' })}>
            <InputPassword size="large" />
          </Form.Item>
          {/* repeat password */}
          <Form.Item
            name="repeatPassword"
            className="w-full !max-w-[380px]"
            dependencies={['password']}
            validateTrigger={['onSubmit', 'onBlur']}
            rules={passwordRules}
            label={intl.formatMessage({ id: 'wallet.password.repeat' })}>
            <InputPassword size="large" />
          </Form.Item>
          {/* name */}
          <Form.Item
            name="name"
            className="w-full !max-w-[380px]"
            rules={[{ validator: walletNameValidator }]}
            label={
              <div>
                {intl.formatMessage({ id: 'wallet.name' })}
                <span className="pl-5px text-[12px] text-gray1 dark:text-gray1d">
                  ({intl.formatMessage({ id: 'wallet.name.maxChars' }, { max: MAX_WALLET_NAME_CHARS })})
                </span>
              </div>
            }>
            <Input size="large" maxLength={MAX_WALLET_NAME_CHARS} placeholder={initialWalletName} />
          </Form.Item>
          <FlatButton
            className="mt-20px"
            size="large"
            color="primary"
            type="submit"
            loading={loading}
            disabled={loading}>
            {intl.formatMessage({ id: 'common.next' })}
          </FlatButton>
        </div>
      </Form>
    </div>
  )
}
