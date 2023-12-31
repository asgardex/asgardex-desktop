import React, { useCallback, useState, useEffect, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import * as crypto from '@xchainjs/xchain-crypto'
import { Form } from 'antd'
import { Rule } from 'antd/lib/form'
import { Store } from 'antd/lib/form/interface'
import Paragraph from 'antd/lib/typography/Paragraph'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import { defaultWalletName } from '../../../../shared/utils/wallet'
import { KeystoreClientStates } from '../../../hooks/useKeystoreClientStates'
import { MAX_WALLET_NAME_CHARS } from '../../../services/wallet/const'
import { AddKeystoreParams } from '../../../services/wallet/types'
import { Spin } from '../../shared/loading'
import { FlatButton } from '../../uielements/button'
import { InputPassword, InputTextArea, Input } from '../../uielements/input'
import { Label } from '../../uielements/label'

/* css import is needed to override antd */
import '../../uielements/input/overrides.css'

type Props = {
  walletId: number
  walletNames: string[]
  addKeystore: (params: AddKeystoreParams) => Promise<void>
  clientStates: KeystoreClientStates
}

export const ImportPhrase: React.FC<Props> = (props): JSX.Element => {
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
    <>
      <Form form={form} onFinish={submitForm} labelCol={{ span: 24 }} className="w-full p-30px pt-15px">
        <Spin spinning={importing} tip={intl.formatMessage({ id: 'common.loading' })}>
          <div className="flex flex-col items-center">
            {/* title */}
            <Label className="mb-20px w-full" size="big" align="center" textTransform="uppercase">
              {intl.formatMessage({ id: 'wallet.imports.phrase.title' })}
            </Label>

            {/* phrase */}
            <Form.Item
              name="phrase"
              className="w-full !max-w-[800px] "
              rules={[{ required: true, validator: phraseValidator }]}
              validateTrigger={['onSubmit', 'onChange']}>
              <InputTextArea
                color="primary"
                typevalue="normal"
                placeholder={intl.formatMessage({ id: 'wallet.imports.enterphrase' }).toUpperCase()}
                rows={5}
                className="!text-lg"
              />
            </Form.Item>
            {renderImportError}
            {/* password */}
            <Form.Item
              name="password"
              className="w-full !max-w-[380px]"
              validateTrigger={['onSubmit', 'onBlur']}
              rules={passwordRules}
              label={intl.formatMessage({ id: 'common.password' })}>
              <InputPassword className="!text-lg" size="large" />
            </Form.Item>

            {/* repeat password */}
            <Form.Item
              name="repeatPassword"
              className="w-full !max-w-[380px]"
              dependencies={['password']}
              validateTrigger={['onSubmit', 'onBlur']}
              rules={passwordRules}
              label={intl.formatMessage({ id: 'wallet.password.repeat' })}>
              <InputPassword className="!text-lg" size="large" />
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
              <Input
                className="!text-lg"
                size="large"
                maxLength={MAX_WALLET_NAME_CHARS}
                placeholder={defaultWalletName(walletId)}
              />
            </Form.Item>

            <FlatButton
              className="mt-50px min-w-[150px]"
              size="large"
              color="primary"
              type="submit"
              disabled={!validPhrase || importing}>
              {intl.formatMessage({ id: 'wallet.action.import' })}
            </FlatButton>
          </div>
        </Spin>
      </Form>
    </>
  )
}
