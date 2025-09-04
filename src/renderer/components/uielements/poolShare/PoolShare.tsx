import { RefObject, useCallback, useMemo, useRef } from 'react'

import { AssetCacao, CACAO_DECIMAL } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import { THORCHAIN_DECIMAL } from '@xchainjs/xchain-thorchain-query'
import {
  Address,
  AnyAsset,
  Chain,
  formatBN,
  BaseAmount,
  baseToAsset,
  formatAssetAmountCurrency,
  baseAmount,
  formatAssetAmount
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { AssetWithDecimal } from '../../../types/asgardex'
import { AssetLabel } from '../assets/assetLabel'
import { Label } from '../label'
import { PoolShareCard } from './PoolShareCard'

export type Props = {
  asset: AssetWithDecimal
  runePrice: BaseAmount
  priceAsset?: AnyAsset
  /**
   * Shares of Rune and selected Asset.
   * Note: Decimal needs to be based on **original asset decimals**
   **/
  shares: { rune: BaseAmount; asset: BaseAmount }
  assetPrice: BaseAmount
  poolShare: BigNumber
  depositUnits: BigNumber
  addresses: { rune: O.Option<Address>; asset: O.Option<Address> }
  smallWidth?: boolean
  loading?: boolean
  protocol: Chain
}

export const PoolShare = ({
  asset: assetWD,
  runePrice,
  loading,
  priceAsset,
  shares: { rune: runeShare, asset: assetShare },
  assetPrice,
  poolShare,
  depositUnits,
  protocol
}: Props): JSX.Element => {
  const intl = useIntl()

  const dexAsset = protocol === THORChain ? AssetRuneNative : AssetCacao
  const dexAssetDecimal = protocol === THORChain ? THORCHAIN_DECIMAL : CACAO_DECIMAL

  const { asset } = assetWD

  const totalDepositPrice = useMemo(
    () => baseAmount(runePrice.amount().plus(assetPrice.amount())),
    [assetPrice, runePrice]
  )

  const ref: RefObject<HTMLDivElement> = useRef(null)

  const renderRedemptionCol = useCallback(
    (amount: BaseAmount, price: BaseAmount, asset: AnyAsset) => (
      <div>
        <Label align="center" color="dark" loading={loading} size="big" weight="bold">
          {formatAssetAmountCurrency({ amount: baseToAsset(amount), asset, decimal: 2 })}
        </Label>
        <Label align="center" color="dark" size="big" textTransform="uppercase" loading={loading}>
          {formatAssetAmountCurrency({ amount: baseToAsset(price), asset: priceAsset, decimal: 2 })}
        </Label>
      </div>
    ),
    [loading, priceAsset]
  )

  const renderRedemption = useMemo(
    () => (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="flex flex-col bg-turquoise/20 rounded-lg p-2 space-y-2">
          <AssetLabel className="flex justify-center" asset={asset} />
          {renderRedemptionCol(assetShare, assetPrice, asset)}
        </div>
        <div className="flex flex-col bg-turquoise/20 rounded-lg p-2 space-y-2">
          <AssetLabel className="flex justify-center" asset={dexAsset} />
          {renderRedemptionCol(runeShare, runePrice, dexAsset)}
        </div>
      </div>
    ),
    [asset, renderRedemptionCol, runeShare, runePrice, dexAsset, assetShare, assetPrice]
  )

  const depositUnitsFormatted = useMemo(() => {
    // Convert `depositUnits` to `AssetAmount`
    const amount = baseToAsset(baseAmount(depositUnits, dexAssetDecimal))
    // and format it
    return formatAssetAmount({ amount, decimal: 2 })
  }, [depositUnits, dexAssetDecimal])

  return (
    <div className="w-full p-2 space-y-2" ref={ref}>
      <PoolShareCard title={intl.formatMessage({ id: 'deposit.share.title' })}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="bg-turquoise/20 rounded-lg p-2 space-y-2">
            <Label align="center" color="dark" size="small" textTransform="uppercase">
              {intl.formatMessage({ id: 'deposit.share.units' })}
            </Label>
            <Label align="center" color="dark" loading={loading} size="large" weight="bold">
              {depositUnitsFormatted}
            </Label>
          </div>
          <div className="bg-turquoise/20 rounded-lg p-2 space-y-2">
            <Label align="center" color="dark" size="small" textTransform="uppercase">
              {intl.formatMessage({ id: 'deposit.share.poolshare' })}
            </Label>
            <Label align="center" color="dark" loading={loading} size="large" weight="bold">
              {`${formatBN(poolShare, 2)}%`}
            </Label>
          </div>
        </div>
      </PoolShareCard>
      <PoolShareCard title={intl.formatMessage({ id: 'deposit.redemption.title' })}>
        {renderRedemption}
        <div className="mt-4 flex flex-col items-center">
          <Label align="center" color="dark" textTransform="uppercase">
            {intl.formatMessage({ id: 'deposit.share.total' })}
          </Label>
          <Label align="center" color="dark" loading={loading} size="large" weight="bold">
            {formatAssetAmountCurrency({ amount: baseToAsset(totalDepositPrice), asset: priceAsset, decimal: 2 })}
          </Label>
        </div>
      </PoolShareCard>
    </div>
  )
}
