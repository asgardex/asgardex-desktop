import React from 'react'

import { Asset, BaseAmount, baseToAsset, formatAssetAmountCurrency, baseAmount, formatBN } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'

import { ZERO_BN } from '../../const'
import { isUSDAsset } from '../../helpers/assetHelper'
import * as Styled from '../PoolShares/PoolShares.styles'
import { SaversButton } from '../uielements/button/SaversButton'

type Props = {
  asset: Asset
  priceAsset: Asset
  deposit: { amount: BaseAmount; price: BaseAmount }
  redeem: { amount: BaseAmount; price: BaseAmount }
  percent: BigNumber
}

export const SaversDetailsTable: React.FC<Props> = (props): JSX.Element => {
  const { asset, priceAsset, deposit, redeem, percent } = props
  // const navigate = useNavigate()
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

  const priceGrowthLabel = formatAssetAmountCurrency({
    amount: baseToAsset(growthValue.gt(0) ? growthValue : baseAmount(0, deposit.price.decimal)),
    asset: priceAsset,
    decimal: isUSDAsset(priceAsset) ? 2 : 6
  })

  const percentLabel = `${formatBN(percent.gt(0) ? percent : ZERO_BN, 4)}%`

  // const navigateToManagePage = (asset: Asset) => {
  //   // Here, navigate to the manage page with the assetSymbol
  //   // For example, using your existing navigate function:
  //   navigate(
  //     poolsRoutes.earn.path({
  //       asset: assetToString(asset),
  //       walletType: DEFAULT_WALLET_TYPE
  //     })
  //   )
  // }

  //const hasSavings = deposit.amount.gt(0)
  const columns = [
    {
      title: `Asset`,
      dataIndex: 'key', // This will display the asset symbol
      key: `asset-${asset.symbol}`
    },
    {
      title: `Deposit Value`,
      dataIndex: 'priceDepositLabel',
      key: `priceDeposit-${asset.symbol}`
    },
    {
      title: `Asset Amount`,
      dataIndex: 'depositValueLabel',
      key: `assetValue-${asset.symbol}`
    },
    {
      title: `Redeem Value`,
      dataIndex: 'redeemValueLabel',
      key: `redeemValue-${asset.symbol}`
    },
    {
      title: `Redeem Deposit Amount`,
      dataIndex: 'redeemDepositLabel',
      key: `redeemValue-${asset.symbol}`
    },
    {
      title: `Growth Value`,
      dataIndex: 'growthValueLabel',
      key: `redeemValue-${asset.symbol}`
    },
    {
      title: `Price growth`,
      dataIndex: 'priceGrowthLabel',
      key: `redeemValue-${asset.symbol}`
    },
    {
      title: 'Manage',
      key: 'manage',
      render: () => (
        <SaversButton asset={asset} isTextView={true} {...asset}>
          Manage
        </SaversButton>
      )
    }
    // Add more columns as needed
  ]

  const dataSource = [
    {
      key: asset.symbol,
      depositValueLabel,
      redeemValueLabel,
      priceDepositLabel,
      redeemDepositLabel,
      growthValue,
      growthValueLabel,
      percentLabel,
      priceGrowthLabel
      // Add more data fields as needed
    }
  ]

  return (
    <>
      <Styled.Table loading={false} dataSource={dataSource} columns={columns}></Styled.Table>
    </>
  )
}
