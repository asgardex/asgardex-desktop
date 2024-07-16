import React from 'react'

import { Asset, BaseAmount, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import { useIntl } from 'react-intl'

import { isUSDAsset } from '../../helpers/assetHelper'
import { EmptyResult } from '../shared/result/EmptyResult'

type Props = {
  asset: Asset
  priceAsset: Asset
  current: { amount: BaseAmount; price: BaseAmount }
  issued: { amount: BaseAmount; price: BaseAmount }
  repaid: { amount: BaseAmount; price: BaseAmount }
}
//tobefixed
export const LoanDetails: React.FC<Props> = (props): JSX.Element => {
  const { asset, priceAsset, current, issued, repaid } = props
  const intl = useIntl()

  const currentValueLabel = formatAssetAmountCurrency({ amount: baseToAsset(current.amount), asset, decimal: 3 })

  const priceCurrentLabel = formatAssetAmountCurrency({
    amount: baseToAsset(current.price),
    asset: priceAsset,
    decimal: isUSDAsset(priceAsset) ? 2 : 6
  })
  const issuedValueLabel = formatAssetAmountCurrency({ amount: baseToAsset(issued.amount), asset, decimal: 3 })

  const priceIssuedLabel = formatAssetAmountCurrency({
    amount: baseToAsset(issued.price),
    asset: priceAsset,
    decimal: isUSDAsset(priceAsset) ? 2 : 6
  })

  const repaidValueLabel = formatAssetAmountCurrency({ amount: baseToAsset(repaid.amount), asset, decimal: 3 })
  const priceRepaidLable = formatAssetAmountCurrency({
    amount: baseToAsset(repaid.price),
    asset,
    decimal: isUSDAsset(asset) ? 2 : 6
  })

  // const priceGrowth = redeem.price.minus(deposit.price)
  // const priceGrowthLabel = formatAssetAmountCurrency({
  //   amount: baseToAsset(priceGrowth.gt(0) ? priceGrowth : baseAmount(0, deposit.price.decimal)),
  //   asset: priceAsset,
  //   decimal: isUSDAsset(priceAsset) ? 2 : 6
  // })

  // const percentLabel = `${formatBN(percent.gt(0) ? percent : ZERO_BN, 4)}%`

  const hasSavings = current.amount.gt(0)

  return hasSavings ? (
    <div className="flex w-full flex-col items-center p-20px">
      <h1 className="pb-10px pt-0 text-center font-mainSemiBold text-14 uppercase text-text2 dark:text-text2 lg:pt-[50px]">
        {intl.formatMessage({ id: 'loan.detail.title' })}
      </h1>

      <div className="w-full border border-gray0 p-20px dark:border-gray0d">
        <div className="flex flex-col items-center font-main">
          <div className="text-[21px] text-text0 dark:text-text0d">{currentValueLabel}</div>
          <div className="text-[17px] text-gray2 dark:text-gray2d">{priceCurrentLabel}</div>
        </div>
      </div>
      <h1 className="pb-10px pt-30px text-center font-mainSemiBold text-14 uppercase text-text2 dark:text-text2">
        {intl.formatMessage({ id: 'loan.detail.debt.title' })}
      </h1>
      <div className="w-full border border-gray0 p-20px dark:border-gray0d">
        <div className="flex flex-col items-center font-main">
          <div className="text-[21px] text-text0 dark:text-text0d">{issuedValueLabel}</div>
          <div className="text-[17px] text-gray2 dark:text-gray2d">{priceIssuedLabel}</div>
        </div>
      </div>
      <h1 className="pb-10px pt-30px text-center font-mainSemiBold text-14 uppercase text-text2 dark:text-text2">
        {intl.formatMessage({ id: 'loan.detail.collateral.title' })}
      </h1>
      <div className="w-full border border-gray0 p-20px dark:border-gray0d">
        <div className="flex flex-col items-center font-main">
          <div className="text-[21px] text-text0 dark:text-text0d">{priceRepaidLable}</div>
          <div className="text-[17px] text-gray2 dark:text-gray2d">{repaidValueLabel}</div>
        </div>
      </div>
      {/* <h1 className="pb-10px pt-30px text-center font-mainSemiBold text-14 uppercase text-text2 dark:text-text2">
        {intl.formatMessage({
          id: 'savers.detail.percent'
        })}
      </h1>
      <div className="w-full border border-gray0 p-20px dark:border-gray0d">
        <div className="flex flex-col items-center font-main">
          <div className="text-[33px] text-text0 dark:text-text0d">{percentLabel}</div>
          <div className="my-20px h-[1px] w-full border-b border-gray0 px-20px dark:border-gray0d"></div>
          <div className="text-[17px] text-text0 dark:text-text0d">{growthValueLabel}</div>
          <div className="text-[14px] text-gray2 dark:text-gray2d">{priceGrowthLabel}</div>
        </div>
      </div> */}
    </div>
  ) : (
    <EmptyResult
      title={intl.formatMessage({
        id: 'loan.noLoans'
      })}
      className="h-full w-full py-50px"
    />
  )
}
