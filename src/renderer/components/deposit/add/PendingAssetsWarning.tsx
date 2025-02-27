import React, { useState } from 'react'

import { ChevronRightIcon } from '@heroicons/react/20/solid'
import { Network } from '@xchainjs/xchain-client'
import { assetToString, baseToAsset, formatAssetAmount } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { index } from 'io-ts/lib/DecodeError'
import { useIntl } from 'react-intl'

import { isRuneNativeAsset } from '../../../helpers/assetHelper'
import { AssetWithAmount1e8, AssetsWithAmount1e8 } from '../../../types/asgardex'
import { Alert } from '../../uielements/alert'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { AssetLabel } from '../../uielements/assets/assetLabel'
import { TextButton } from '../../uielements/button'
import { Label } from '../../uielements/label'

type AssetIconAmountProps = {
  assetWA: AssetWithAmount1e8
  network: Network
  loading: boolean
}

const AssetIconAmount: React.FC<AssetIconAmountProps> = (props): JSX.Element => {
  const {
    assetWA: { asset, amount1e8 },
    network,
    loading
  } = props
  return (
    <div className="my-10px flex h-[32px] items-center first:mr-10px last:m-0">
      <AssetIcon className="mr-5px" size="small" asset={asset} network={network} />
      <AssetLabel className="p-0" asset={asset} />
      <Label
        className="!md:text-[24px] !md:leading-[24px] !w-auto p-0 font-mainBold !text-[17px] !leading-[17px]"
        loading={loading}>
        {formatAssetAmount({
          amount: baseToAsset(amount1e8),
          trimZeros: true
        })}
      </Label>
    </div>
  )
}

export type PendingAssetsProps = {
  network: Network
  pendingAssets: AssetsWithAmount1e8
  failedAssets: AssetsWithAmount1e8
  loading: boolean
  className?: string
}

export const PendingAssetsWarning: React.FC<PendingAssetsProps> = (props): JSX.Element => {
  const { pendingAssets, failedAssets, network, loading, className = '' } = props

  const intl = useIntl()

  const [collapsed, setCollapsed] = useState(true)

  const Description: React.FC<{ children: React.ReactNode }> = ({ children }): JSX.Element => (
    <p className="p-0 pb-10px font-main text-[12px] uppercase leading-[17px]">{children}</p>
  )

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
          <Description>{intl.formatMessage({ id: 'deposit.add.pendingAssets.description' })}</Description>
          {pendingAssets.map((assetWB, index) => (
            <AssetIconAmount
              network={network}
              assetWA={assetWB}
              loading={loading}
              key={`${assetToString(assetWB.asset)}-${index}`}
            />
          ))}
          <Description>{intl.formatMessage({ id: 'deposit.add.failedAssets.description' })}</Description>
          {failedAssets.map((assetWB, index) => (
            <AssetIconAmount
              network={network}
              assetWA={assetWB}
              loading={loading}
              key={`${assetToString(assetWB.asset)}-${index}`}
            />
          ))}
          {failedAssets.map((assetWb) => (
            <Description key={`${assetToString(assetWb.asset)}-${index}`}>
              {isRuneNativeAsset(assetWb.asset)
                ? intl.formatMessage({ id: 'deposit.add.pendingAssets.recoveryDescriptionRune' })
                : intl.formatMessage({ id: 'deposit.add.pendingAssets.recoveryDescriptionAsset' })}
            </Description>
          ))}
        </>
      )}
    </>
  )

  return (
    <Alert
      className={className}
      type="warning"
      message={intl.formatMessage({ id: 'deposit.add.pendingAssets.title' })}
      description={subContent}
    />
  )
}
