import React from 'react'

import { THORChain } from '@xchainjs/xchain-thorchain'
import { Asset, BaseAmount, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import { isUSDAsset } from '../../helpers/assetHelper'
import { EmptyResult } from '../shared/result/EmptyResult'
import { getBlockDate } from './Loan.utils'

type Props = {
  asset: Asset
  priceAsset: Asset
  current: { amount: BaseAmount; price: BaseAmount }
  issued: { amount: BaseAmount; price: BaseAmount }
  repaid: { amount: BaseAmount; price: BaseAmount }
  lastRepayHeight: O.Option<number>
  lastBlockTC: number
}

export const LoanDetails: React.FC<Props> = (props): JSX.Element => {
  const { asset, priceAsset, current, issued, repaid, lastRepayHeight, lastBlockTC } = props
  const intl = useIntl()

  const lastRepayHeightDate = FP.pipe(
    lastRepayHeight,
    O.getOrElse(() => 0), // Default to 0 if `lastRepayHeight` is None
    (height: number) => getBlockDate(lastBlockTC, height, THORChain)
  )
  const currentCollateralValueLabel = formatAssetAmountCurrency({
    amount: baseToAsset(current.amount),
    asset,
    decimal: 3
  })
  // already in USD or TOR
  const priceDebtCurrentLabel = formatAssetAmountCurrency({
    amount: baseToAsset(current.price),
    asset: priceAsset,
    decimal: isUSDAsset(priceAsset) ? 2 : 6
  })
  const collateralDeposited = formatAssetAmountCurrency({ amount: baseToAsset(issued.amount), asset, decimal: 3 })

  const priceDebtIssuedLabel = formatAssetAmountCurrency({
    amount: baseToAsset(issued.price),
    asset: priceAsset,
    decimal: isUSDAsset(priceAsset) ? 2 : 6
  })

  const collateralWithdrawnLabel = formatAssetAmountCurrency({ amount: baseToAsset(repaid.amount), asset, decimal: 3 })
  const priceDebtRepaidLable = formatAssetAmountCurrency({
    amount: baseToAsset(repaid.price),
    asset: priceAsset,
    decimal: isUSDAsset(asset) ? 2 : 6
  })

  const hasSavings = current.amount.gt(0)

  return hasSavings ? (
    <div className="flex w-full flex-col items-center p-20px">
      <h1 className="pb-10px pt-0 text-center font-mainSemiBold text-14 uppercase text-text2 dark:text-text2 lg:pt-[50px]">
        {intl.formatMessage({ id: 'loan.detail.title' })}
      </h1>
      <div className="w-full border border-gray0 p-20px dark:border-gray0d">
        <div className="flex w-full justify-between pl-10px text-[12px]">
          <div className={`flex items-center`}>{intl.formatMessage({ id: 'loan.detail.collateral.current' })}</div>
          <div className="text-[21px] text-text0 dark:text-text0d">{currentCollateralValueLabel}</div>
        </div>
        <div className="flex w-full justify-between pl-10px text-[12px]">
          <div className={`flex items-center`}>{intl.formatMessage({ id: 'loan.detail.debt.current' })}</div>
          <div className="text-[17px] text-gray2 dark:text-gray2d">{priceDebtCurrentLabel}</div>
        </div>
        <div className="flex w-full justify-between pl-10px text-[12px]">
          <div className={`flex items-center`}>{intl.formatMessage({ id: 'loan.detail.lastRepay' })}</div>
          <div className="text-[17px] text-gray2 dark:text-gray2d">{lastRepayHeightDate.toDateString()}</div>
        </div>
      </div>
      <div className="w-full border border-gray0 p-20px dark:border-gray0d">
        <div className="flex w-full justify-between pl-10px text-[12px]">
          <div className={`flex items-center`}>{intl.formatMessage({ id: 'loan.detail.collateral.deposited' })}</div>
          <div className="text-[21px] text-text0 dark:text-text0d">{collateralDeposited}</div>
        </div>
        <div className="flex w-full justify-between pl-10px text-[12px]">
          <div className={`flex items-center`}>{intl.formatMessage({ id: 'loan.detail.debt.issued' })}</div>
          <div className="text-[17px] text-gray2 dark:text-gray2d">{priceDebtIssuedLabel}</div>
        </div>
      </div>
      <div className="w-full border border-gray0 p-20px dark:border-gray0d">
        <div className="flex w-full justify-between pl-10px text-[12px]">
          <div className={`flex items-center`}>{intl.formatMessage({ id: 'loan.detail.repayed' })}</div>
          <div className="text-[21px] text-text0 dark:text-text0d">{priceDebtRepaidLable}</div>
        </div>
        <div className="flex w-full justify-between pl-10px text-[12px]">
          <div className={`flex items-center`}>{intl.formatMessage({ id: 'loan.detail.collateral.withdrawn' })}</div>
          <div className="text-[17px] text-gray2 dark:text-gray2d">{collateralWithdrawnLabel}</div>
        </div>
      </div>
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
