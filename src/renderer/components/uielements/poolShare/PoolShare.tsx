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
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { AssetWithDecimal } from '../../../types/asgardex'
import { AssetLabel } from '../assets/assetLabel'
import { TooltipAddress } from '../common/Common.styles'
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
  addresses: { rune: oRuneAddress, asset: oAssetAddress },
  runePrice,
  loading,
  priceAsset,
  shares: { rune: runeShare, asset: assetShare },
  assetPrice,
  poolShare,
  depositUnits,
  smallWidth,
  protocol
}: Props): JSX.Element => {
  const intl = useIntl()

  const dexAsset = protocol === THORChain ? AssetRuneNative : AssetCacao
  const dexAssetDecimal = protocol === THORChain ? THORCHAIN_DECIMAL : CACAO_DECIMAL

  const { asset } = assetWD

  const runeAddress = FP.pipe(
    oRuneAddress,
    O.getOrElse(() => '')
  )

  const assetAddress = FP.pipe(
    oAssetAddress,
    O.getOrElse(() => '')
  )

  const totalDepositPrice = useMemo(
    () => baseAmount(runePrice.amount().plus(assetPrice.amount())),
    [assetPrice, runePrice]
  )

  const ref: RefObject<HTMLDivElement> = useRef(null)

  const renderRedemptionCol = useCallback(
    (amount: BaseAmount, price: BaseAmount, asset: AnyAsset) => (
      <div>
        <Label className="!text-16 px-4" align="center" color="dark" loading={loading} weight="bold">
          {formatAssetAmountCurrency({ amount: baseToAsset(amount), asset, decimal: 2 })}
        </Label>
        <Label className="px-4" align="center" color="dark" size="big" textTransform="uppercase" loading={loading}>
          {formatAssetAmountCurrency({ amount: baseToAsset(price), asset: priceAsset, decimal: 2 })}
        </Label>
      </div>
    ),
    [loading, priceAsset]
  )

  const renderRedemptionLarge = useMemo(
    () => (
      <>
        <div className="border-b border-solid border-gray0 dark:border-gray0d grid">
          <div className="grid grid-cols-1 md:grid-cols-2 p-4">
            <TooltipAddress title={assetAddress}>
              <AssetLabel className="flex justify-center" asset={asset} />
            </TooltipAddress>
            <TooltipAddress title={runeAddress}>
              <AssetLabel className="flex justify-center" asset={dexAsset} />
            </TooltipAddress>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 p-4">
          {renderRedemptionCol(assetShare, assetPrice, asset)}
          {renderRedemptionCol(runeShare, runePrice, dexAsset)}
        </div>
      </>
    ),
    [assetAddress, asset, runeAddress, dexAsset, renderRedemptionCol, assetShare, assetPrice, runeShare, runePrice]
  )

  const renderRedemptionSmall = useMemo(
    () => (
      <>
        <div>
          <TooltipAddress title={assetAddress}>
            <div className="grid p-4 pb-0">
              <AssetLabel className="flex justify-center" asset={asset} />
            </div>
          </TooltipAddress>
        </div>
        <div className="border-b border-solid border-gray0 dark:border-gray0d grid p-4">
          {renderRedemptionCol(assetShare, assetPrice, asset)}
        </div>
        <div>
          <TooltipAddress title={runeAddress}>
            <div className="grid p-4 pb-0">
              <AssetLabel className="flex justify-center" asset={dexAsset} />
            </div>
          </TooltipAddress>
        </div>
        <div className="border-b border-solid border-gray0 dark:border-gray0d grid p-4">
          {renderRedemptionCol(runeShare, runePrice, dexAsset)}
        </div>
      </>
    ),
    [assetAddress, asset, renderRedemptionCol, runeShare, runePrice, dexAsset, runeAddress, assetShare, assetPrice]
  )
  const renderRedemption = useMemo(
    () => (smallWidth ? renderRedemptionSmall : renderRedemptionLarge),
    [renderRedemptionLarge, renderRedemptionSmall, smallWidth]
  )

  const depositUnitsFormatted = useMemo(() => {
    // Convert `depositUnits` to `AssetAmount`
    const amount = baseToAsset(baseAmount(depositUnits, dexAssetDecimal))
    // and format it
    return formatAssetAmount({ amount, decimal: 2 })
  }, [depositUnits, dexAssetDecimal])

  return (
    <div className="w-full" ref={ref}>
      <PoolShareCard title={intl.formatMessage({ id: 'deposit.share.title' })}>
        <div className="grid grid-cols-1 md:grid-cols-2 p-4">
          <div className="space-y-2">
            <Label className="px-4" align="center" color="dark" size="big" textTransform="uppercase">
              {intl.formatMessage({ id: 'deposit.share.units' })}
            </Label>
            <Label className="!text-16 px-4" align="center" color="dark" loading={loading} weight="bold">
              {depositUnitsFormatted}
            </Label>
          </div>
          <div className="space-y-2">
            <Label className="px-4" align="center" color="dark" size="big" textTransform="uppercase">
              {intl.formatMessage({ id: 'deposit.share.poolshare' })}
            </Label>
            <Label className="!text-16 px-4" align="center" color="dark" loading={loading} weight="bold">
              {`${formatBN(poolShare, 2)}%`}
            </Label>
          </div>
        </div>
      </PoolShareCard>
      <PoolShareCard title={intl.formatMessage({ id: 'deposit.redemption.title' })}>
        {renderRedemption}
        <div className="flex flex-col items-center p-4">
          <Label className="px-4" align="center" color="dark" size="big" textTransform="uppercase">
            {intl.formatMessage({ id: 'deposit.share.total' })}
          </Label>
          <Label className="!text-16 px-4" align="center" color="dark" loading={loading} weight="bold">
            {formatAssetAmountCurrency({ amount: baseToAsset(totalDepositPrice), asset: priceAsset, decimal: 2 })}
          </Label>
        </div>
      </PoolShareCard>
    </div>
  )
}
