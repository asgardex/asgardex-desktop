import { useState } from 'react'

import { ChevronRightIcon } from '@heroicons/react/20/solid'
import { Network } from '@xchainjs/xchain-client'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { AssetsWithAddress } from '../../../types/asgardex'
import { Alert } from '../../uielements/alert'
import { AssetAddress } from '../../uielements/assets/assetAddress'
import { TextButton } from '../../uielements/button'

export type Props = {
  network: Network
  assets: AssetsWithAddress
  className?: string
}

export const AssetMissmatchWarning = (props: Props): JSX.Element => {
  const { assets: assetsWA, network, className = '' } = props

  const intl = useIntl()

  const [collapsed, setCollapsed] = useState(false)

  const subContent = (
    <>
      <TextButton
        size="normal"
        color="neutral"
        className="!font-mainBold mr-10px pl-0 whitespace-nowrap uppercase"
        onClick={() => setCollapsed((v) => !v)}>
        {intl.formatMessage({ id: 'common.informationMore' })}
        <ChevronRightIcon className={clsx('ease h-[20px] w-[20px] text-turquoise', { 'rotate-90': collapsed })} />
      </TextButton>
      {collapsed && (
        <>
          <p className="p-0 pb-10px font-main text-[12px] leading-[17px] uppercase">
            {intl.formatMessage({ id: 'deposit.add.assetMissmatch.description' })}
          </p>
          <div>
            {assetsWA.map(({ asset, address }, index) => (
              <AssetAddress
                className="pt-10px first:pt-0"
                network={network}
                asset={asset}
                size="small"
                address={address}
                key={`${address}-${index}`}
              />
            ))}
          </div>
        </>
      )}
    </>
  )

  return (
    <Alert
      className={className}
      type="warning"
      title={intl.formatMessage({ id: 'deposit.add.assetMissmatch.title' })}
      description={subContent}
    />
  )
}
