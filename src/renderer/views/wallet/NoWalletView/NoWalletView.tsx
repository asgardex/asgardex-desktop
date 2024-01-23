import React, { useCallback } from 'react'

import { FileOutlined, FileProtectOutlined } from '@ant-design/icons'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { BorderButton } from '../../../components/uielements/button'
import * as walletRoutes from '../../../routes/wallet'

export const NoWalletView = () => {
  const navigate = useNavigate()
  const intl = useIntl()

  const createWalletHandler = useCallback(() => {
    navigate(walletRoutes.create.phrase.path())
  }, [navigate])

  const importWalletHandler = useCallback(() => {
    navigate(walletRoutes.imports.base.path())
  }, [navigate])

  return (
    <div className="flex h-full w-full items-center justify-center bg-bg1 dark:bg-bg1d">
      <div className="hover:gray1 mx-4 flex flex-col justify-center rounded-lg border border-transparent p-4 text-center transition duration-500 ease-in-out hover:shadow-lg dark:hover:shadow-turquoise">
        <FileOutlined className="mb-4 text-4xl dark:text-turquoise" />
        <BorderButton
          className="w-full min-w-[200px] p-20px"
          size="normal"
          color="primary"
          onClick={createWalletHandler}>
          {intl.formatMessage({ id: 'wallet.action.create' })}
        </BorderButton>
        <p className="p-4 text-gray-500">{intl.formatMessage({ id: 'wallet.create.error.phrase.empty' })}</p>
      </div>

      <div className="hover:gray1 mx-4 flex flex-col items-center justify-center rounded-lg border border-transparent p-4 text-center transition duration-500 ease-in-out hover:shadow-lg dark:hover:shadow-turquoise">
        <FileProtectOutlined className="mb-4 text-4xl dark:text-turquoise" />
        <BorderButton
          className="w-full min-w-[200px] p-20px"
          size="normal"
          color="primary"
          onClick={importWalletHandler}>
          {intl.formatMessage({ id: 'wallet.action.import' })}
        </BorderButton>
        <p className="p-4 text-gray-500">{intl.formatMessage({ id: 'wallet.imports.error.phrase.empty' })}</p>
      </div>
    </div>
  )
}
