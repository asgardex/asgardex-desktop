import React, { useCallback, useMemo } from 'react'

import { CheckCircleTwoTone, UploadOutlined } from '@ant-design/icons'
import * as RD from '@devexperts/remote-data-ts'
import { Keystore } from '@xchainjs/xchain-crypto'
import { Form } from 'antd'
import { Store } from 'antd/lib/form/interface'
import * as FP from 'fp-ts/lib/function'
import { useIntl } from 'react-intl'

/* css import is needed to override antd */
import '../../uielements/input/overrides.css'

import { defaultWalletName } from '../../../../shared/utils/wallet'
import { KeystoreClientStates } from '../../../hooks/useKeystoreClientStates'
import { useSubscriptionState } from '../../../hooks/useSubscriptionState'
import { MAX_WALLET_NAME_CHARS } from '../../../services/wallet/const'
import { ImportingKeystoreStateRD, ImportKeystoreParams, LoadKeystoreLD } from '../../../services/wallet/types'
import { InnerForm } from '../../shared/form/Form.styles'
import { Spin } from '../../shared/loading'
import { BorderButton, FlatButton } from '../../uielements/button'
import { InputPassword, Input } from '../../uielements/input'
import { Label } from '../../uielements/label'

export type Props = {
  walletId: number
  walletNames: string[]
  clientStates: KeystoreClientStates
  importKeystore: (params: ImportKeystoreParams) => Promise<void>
  loadKeystore$: () => LoadKeystoreLD
  importingKeystoreState: ImportingKeystoreStateRD
}

export const ImportKeystore: React.FC<Props> = (props): JSX.Element => {
  const { importKeystore, importingKeystoreState, loadKeystore$, clientStates, walletId, walletNames } = props

  const [form] = Form.useForm()

  const intl = useIntl()

  const { state: loadKeystoreState, subscribe: subscribeLoadKeystoreState } = useSubscriptionState<
    RD.RemoteData<Error, Keystore>
  >(RD.initial)

  const submitForm = useCallback(
    async ({ password, name }: Store) => {
      // TODO (@veado) Validate `loadKeystoreState` - if it's initial - show info to load keystore
      FP.pipe(
        loadKeystoreState,
        RD.map(async (keystore) => {
          await importKeystore({ keystore, password, id: walletId, name: name || defaultWalletName(walletId) })
        })
      )
    },
    [importKeystore, loadKeystoreState, walletId]
  )

  const uploadKeystore = () => {
    subscribeLoadKeystoreState(loadKeystore$())
  }

  const renderError = (msg: string) => (
    <Label className="mb-20px" color="error" textTransform="uppercase" align="center">
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
    async (_: unknown, value: string) => {
      if (walletNames.includes(value)) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.name.error.duplicated' }))
      }
    },
    [intl, walletNames]
  )

  return (
    <>
      <InnerForm className="w-full p-30px pt-15px" labelCol={{ span: 24 }} form={form} onFinish={submitForm}>
        {renderClientError}
        <Spin
          spinning={RD.isPending(importingKeystoreState) || RD.isPending(loadKeystoreState)}
          tip={intl.formatMessage({ id: 'common.loading' })}>
          <div className="flex flex-col items-center">
            {/* title */}
            <Label className="mb-20px w-full" size="big" align="center" textTransform="uppercase">
              {intl.formatMessage({ id: 'wallet.imports.keystore.title' })}
            </Label>
            {/* import button */}
            <BorderButton className="mb-30px cursor-pointer !rounded-none" size="normal" onClick={uploadKeystore}>
              {RD.isSuccess(loadKeystoreState) ? <CheckCircleTwoTone twoToneColor="#50e3c2" /> : <UploadOutlined />}
              <span className="ml-10px">{intl.formatMessage({ id: 'wallet.imports.keystore.select' })}</span>
            </BorderButton>
            {renderLoadError}
            {renderImportError}
            {/* password */}
            <Form.Item
              className="w-full !max-w-[380px]"
              name="password"
              label={intl.formatMessage({ id: 'common.keystorePassword' })}
              validateTrigger={['onSubmit', 'onBlur']}
              rules={[{ required: true, message: intl.formatMessage({ id: 'wallet.password.empty' }) }]}>
              <InputPassword className="!text-lg" size="large" />
            </Form.Item>
            {/* name */}
            <Form.Item
              className="w-full !max-w-[380px]"
              name="name"
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
            {/* submit button */}
            <FlatButton
              className="mt-50px min-w-[150px]"
              size="large"
              color="primary"
              type="submit"
              disabled={!RD.isSuccess(loadKeystoreState) || RD.isPending(importingKeystoreState)}>
              {intl.formatMessage({ id: 'wallet.action.import' })}
            </FlatButton>
          </div>
        </Spin>
      </InnerForm>
    </>
  )
}
