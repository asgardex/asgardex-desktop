import React, { useState } from 'react'

import { ArrowTopRightOnSquareIcon, ChevronRightIcon } from '@heroicons/react/20/solid'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, assetToString } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { FormattedMessage, useIntl } from 'react-intl'

import { ASYM_DEPOSIT_TOOL_URL } from '../../../const'
import { Alert } from '../../uielements/alert'
import { AssetData } from '../../uielements/assets/assetData'
import { BorderButton, TextButton } from '../../uielements/button'

type AsymAssetsWarningProps = {
  network: Network
  assets: AnyAsset[]
  loading: boolean
  onClickOpenAsymTool: FP.Lazy<void>
  className?: string
}

const Description = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <p className="p-0 pb-10px font-main text-[12px] uppercase leading-[17px]">{children}</p>
)

export const AsymAssetsWarning = (props: AsymAssetsWarningProps): JSX.Element => {
  const { assets, network, onClickOpenAsymTool, className = '' } = props

  const intl = useIntl()

  const [collapsed, setCollapsed] = useState(false)

  const subContent = (
    <>
      <TextButton
        size="normal"
        color="neutral"
        className="mr-10px whitespace-nowrap pl-0 !font-mainBold uppercase"
        onClick={() => setCollapsed((v) => !v)}>
        {intl.formatMessage({ id: 'common.informationMore' })}
        <ChevronRightIcon className={clsx('ease h-[20px] w-[20px] text-turquoise', { 'rotate-90': collapsed })} />
      </TextButton>
      {collapsed && (
        <>
          <Description>{intl.formatMessage({ id: 'deposit.add.asymAssets.description' })}</Description>
          {assets.map((asset) => (
            <AssetData asset={asset} network={network} key={`${assetToString(asset)}`} />
          ))}
          <Description>
            <FormattedMessage
              id="deposit.add.asymAssets.recoveryDescription"
              values={{
                url: (
                  <span
                    className="cursor-pointer uppercase text-inherit underline hover:text-turquoise"
                    onClick={onClickOpenAsymTool}>
                    {ASYM_DEPOSIT_TOOL_URL[network]}
                  </span>
                )
              }}
            />
          </Description>
          <BorderButton color="warning" className="my-10px" onClick={onClickOpenAsymTool}>
            {intl.formatMessage({ id: 'deposit.add.asymAssets.recoveryTitle' })}
            <ArrowTopRightOnSquareIcon className="ml-5px h-20px w-20px text-inherit" />
          </BorderButton>
        </>
      )}
    </>
  )

  return (
    <Alert
      className={className}
      type="warning"
      title={intl.formatMessage({ id: 'deposit.add.asymAssets.title' })}
      description={subContent}
    />
  )
}
