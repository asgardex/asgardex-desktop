import React from 'react'

import { baseToAsset, formatAssetAmountCurrency, baseAmount, formatBN } from '@xchainjs/xchain-util'

import { ZERO_BN } from '../../const'
import { isUSDAsset } from '../../helpers/assetHelper'
import { ParentProps } from '../../views/wallet/SaversTableView'
import * as Styled from '../PoolShares/PoolShares.styles'
import { AssetIcon } from '../uielements/assets/assetIcon'
import { SaversButton } from '../uielements/button/SaversButton'

export const SaversDetailsTable: React.FC<ParentProps> = ({ assetDetails }): JSX.Element => {
  const columns = [
    {
      title: 'Chain',
      dataIndex: 'key',
      key: 'key',
      render: (key: string) => {
        const [chain, symbol, walletType] = key.split('.')
        const assetDetail = assetDetails.find(
          (detail) => detail.asset.chain === chain && detail.asset.symbol === symbol && detail.walletType === walletType
        )
        return assetDetail ? <AssetIcon asset={assetDetail.asset} size="small" network={assetDetail.network} /> : 'N/A'
      }
    },
    {
      title: 'Asset',
      dataIndex: 'assetTicker',
      key: 'asset'
    },
    {
      title: 'Deposit Value',
      dataIndex: 'priceDepositLabel',
      key: 'priceDeposit'
    },
    {
      title: 'Asset Amount',
      dataIndex: 'depositValueLabel',
      key: 'assetValue'
    },
    {
      title: 'Redeem Value',
      dataIndex: 'redeemValueLabel',
      key: 'redeemValue'
    },
    {
      title: 'Redeem Deposit Amount',
      dataIndex: 'redeemDepositLabel',
      key: 'redeemDeposit'
    },
    {
      title: 'Growth Value',
      dataIndex: 'growthValueLabel',
      key: 'growthValue'
    },
    {
      title: 'Price Growth',
      dataIndex: 'percentLabel',
      key: 'percentLabel'
    },
    {
      title: 'Wallet Type',
      dataIndex: 'walletType',
      key: 'walletType'
    },
    {
      title: 'Manage',
      key: 'manage',
      render: (record: typeof dataSource[0]) => {
        const assetDetail = assetDetails.find(
          (detail) =>
            detail.asset.chain === record.key.split('.')[0] && detail.asset.symbol === record.key.split('.')[1]
        )
        return assetDetail ? <SaversButton asset={assetDetail.asset} isTextView={true}></SaversButton> : 'N/A'
      }
    }
  ]

  const dataSource = assetDetails.map(({ asset, deposit, redeem, priceAsset, percent, walletType }) => {
    const depositValueLabel = formatAssetAmountCurrency({ amount: baseToAsset(deposit.amount), asset, decimal: 3 })

    const priceDepositLabel = formatAssetAmountCurrency({
      amount: baseToAsset(deposit.price),
      asset: priceAsset,
      decimal: isUSDAsset(priceAsset) ? 2 : 6
    })
    const redeemValueLabel = formatAssetAmountCurrency({ amount: baseToAsset(redeem.amount), asset, decimal: 3 })

    const redeemDepositLabel = formatAssetAmountCurrency({
      amount: baseToAsset(redeem.price),
      asset: priceAsset,
      decimal: isUSDAsset(priceAsset) ? 2 : 6
    })

    const growthValue = redeem.amount.minus(deposit.amount)
    const growthValueLabel = formatAssetAmountCurrency({
      amount: baseToAsset(growthValue.gt(0) ? growthValue : baseAmount(0, deposit.amount.decimal)),
      asset,
      decimal: isUSDAsset(asset) ? 2 : 6
    })

    const assetTicker = asset.ticker

    const percentLabel = `${formatBN(percent.gt(0) ? percent : ZERO_BN, 4)}%`
    return {
      key: `${asset.chain}.${asset.symbol}.${walletType}`,
      depositValueLabel,
      redeemValueLabel,
      priceDepositLabel,
      redeemDepositLabel,
      growthValue,
      growthValueLabel,
      percentLabel,
      assetTicker,
      walletType
    }
  })

  return (
    <>
      <Styled.Table loading={false} dataSource={dataSource} columns={columns}></Styled.Table>
    </>
  )
}
