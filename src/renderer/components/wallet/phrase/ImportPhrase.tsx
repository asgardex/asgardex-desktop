import { useCallback, useState, useEffect, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Textarea } from '@headlessui/react'
import * as crypto from '@xchainjs/xchain-crypto'
import { Form } from 'antd'
import { Rule } from 'antd/lib/form'
import { Store } from 'antd/lib/form/interface'
import Paragraph from 'antd/lib/typography/Paragraph'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { defaultWalletName } from '../../../../shared/utils/wallet'
import { KeystoreClientStates } from '../../../hooks/useKeystoreClientStates'
import { MAX_WALLET_NAME_CHARS } from '../../../services/wallet/const'
import { AddKeystoreParams } from '../../../services/wallet/types'
import { FlatButton } from '../../uielements/button'
import { InputPassword, Input } from '../../uielements/input'
import { Spin } from '../../uielements/spin'

/* css import is needed to override antd */
import '../../uielements/input/overrides.css'

type Props = {
  walletId: number
  walletNames: string[]
  addKeystore: (params: AddKeystoreParams) => Promise<void>
  clientStates: KeystoreClientStates
}

export const ImportPhrase = (props: Props): JSX.Element => {
  const { addKeystore, clientStates, walletId, walletNames } = props
  const [form] = Form.useForm()

  const intl = useIntl()

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

  const [validPhrase, setValidPhrase] = useState(false)

  const phraseValidator = useCallback(
    async (_: Rule, value: string) => {
      if (!value) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.phrase.error.valueRequired' }))
      }
      const valid = crypto.validatePhrase(value)
      setValidPhrase(valid)
      return valid ? Promise.resolve() : Promise.reject(intl.formatMessage({ id: 'wallet.phrase.error.invalid' }))
    },
    [intl]
  )

  const submitForm = useCallback(
    async ({ phrase: newPhrase, password, name }: Store) => {
      setImportError(O.none)
      setImporting(true)
      await addKeystore({ phrase: newPhrase, name: name || defaultWalletName(walletId), id: walletId, password }).catch(
        (error) => {
          setImporting(false)
          // TODO(@Veado): i18n
          setImportError(O.some(error))
        }
      )
    },
    [addKeystore, walletId]
  )

  const passwordRules: Rule[] = useMemo(
    () => [
      { required: true, message: intl.formatMessage({ id: 'wallet.password.empty' }) },
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

  const renderImportError = useMemo(
    () =>
      FP.pipe(
        importError,
        O.fold(
          () => <></>,
          (error: Error) => (
            <Paragraph>
              {intl.formatMessage({ id: 'wallet.phrase.error.import' })}: {error.toString()}
            </Paragraph>
          )
        )
      ),
    [importError, intl]
  )

  return (
    <Form form={form} onFinish={submitForm} labelCol={{ span: 24 }} className="w-full p-30px pt-15px">
      <Spin spinning={importing} tip={intl.formatMessage({ id: 'common.loading' })}>
        <div className="flex flex-col items-center">
          {/* phrase */}
          <Form.Item
            className="w-full"
            name="phrase"
            rules={[{ required: true, validator: phraseValidator }]}
            validateTrigger={['onSubmit', 'onChange']}>
            <Textarea
              className={clsx(
                'w-full p-2 text-14 bg-bg0 dark:bg-bg0d rounded-lg',
                'border border-solid border-gray0 dark:border-gray0d',
                'placeholder:text-gray-300 dark:placeholder:text-gray-400',
                'text-text0 dark:text-text0d',
                'font-main focus:outline-none'
              )}
              placeholder={intl.formatMessage({ id: 'wallet.imports.enterphrase' })}
              rows={5}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="text"
            />
          </Form.Item>
          {renderImportError}
          {/* password */}
          <Form.Item
            name="password"
            className="w-full"
            validateTrigger={['onSubmit', 'onBlur']}
            rules={passwordRules}
            label={intl.formatMessage({ id: 'common.password' })}>
            <InputPassword size="large" />
          </Form.Item>

          {/* repeat password */}
          <Form.Item
            name="repeatPassword"
            className="w-full"
            dependencies={['password']}
            validateTrigger={['onSubmit', 'onBlur']}
            rules={passwordRules}
            label={intl.formatMessage({ id: 'wallet.password.repeat' })}>
            <InputPassword size="large" />
          </Form.Item>

          {/* name */}
          <Form.Item
            name="name"
            className="w-full"
            rules={[{ validator: walletNameValidator }]}
            label={
              <div>
                {intl.formatMessage({ id: 'wallet.name' })}
                <span className="pl-5px text-[12px] text-gray1 dark:text-gray1d">
                  ({intl.formatMessage({ id: 'wallet.name.maxChars' }, { max: MAX_WALLET_NAME_CHARS })})
                </span>
              </div>
            }>
            <Input size="large" maxLength={MAX_WALLET_NAME_CHARS} placeholder={defaultWalletName(walletId)} />
          </Form.Item>

          <FlatButton
            className="mt-20px min-w-[150px]"
            size="large"
            color="primary"
            type="submit"
            disabled={!validPhrase || importing}>
            {intl.formatMessage({ id: 'wallet.action.import' })}
          </FlatButton>
        </div>
      </Spin>
    </Form>
  )
}
