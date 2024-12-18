import React, { useCallback, useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import { baseToAsset, formatAssetAmountCurrency, currencySymbolByAsset } from '@xchainjs/xchain-util'
import { Grid } from 'antd'
import * as FP from 'fp-ts/lib/function'

import { abbreviateNumber } from '../../../helpers/numberHelper'
import { loadingString } from '../../../helpers/stringHelper'
import { useNetwork } from '../../../hooks/useNetwork'
import { PriceRD } from '../../../services/midgard/types'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import * as Styled from './HeaderStats.styles'

export type Props = {
  runePrice: PriceRD
  mayaPrice: PriceRD
  reloadRunePrice: FP.Lazy<void>
  reloadMayaPrice: FP.Lazy<void>
  volume24PriceRune: PriceRD
  volume24PriceMaya: PriceRD
  reloadVolume24PriceRune: FP.Lazy<void>
  reloadVolume24PriceMaya: FP.Lazy<void>
}

export const HeaderStats: React.FC<Props> = (props): JSX.Element => {
  const {
    runePrice: runePriceRD,
    mayaPrice: mayaPriceRD,
    reloadRunePrice,
    reloadMayaPrice,
    volume24PriceRune: volume24PriceRuneRD,
    volume24PriceMaya: volume24PriceMayaRD,
    reloadVolume24PriceRune,
    reloadVolume24PriceMaya
  } = props

  const isSmallMobileView = Grid.useBreakpoint()?.xs ?? false

  const { network } = useNetwork()

  const prevRunePriceLabel = useRef<string>(loadingString)
  const prevMayaPriceLabel = useRef<string>(loadingString)
  const runePriceLabel = useMemo(
    () =>
      FP.pipe(
        runePriceRD,
        RD.map(({ asset, amount }) => {
          const price = formatAssetAmountCurrency({
            amount: baseToAsset(amount),
            asset,
            decimal: 2
          })
          return price
        }),
        RD.map((label) => {
          // store price label
          prevRunePriceLabel.current = label
          return label
        }),
        RD.fold(
          () => prevRunePriceLabel.current,
          () => prevRunePriceLabel.current,
          () => '--',
          FP.identity
        )
      ),

    [runePriceRD]
  )

  const mayaPriceLabel = useMemo(
    () =>
      FP.pipe(
        mayaPriceRD,
        RD.map(({ asset, amount }) => {
          const price = formatAssetAmountCurrency({
            amount: baseToAsset(amount),
            asset,
            decimal: 2
          })
          return price
        }),
        RD.map((label) => {
          // store price label
          prevMayaPriceLabel.current = label
          return label
        }),
        RD.fold(
          () => prevMayaPriceLabel.current,
          () => prevMayaPriceLabel.current,
          () => '--',
          FP.identity
        )
      ),

    [mayaPriceRD]
  )
  const prevVolume24PriceLabel = useRef<string>(loadingString)
  const volume24PriceRuneLabel = useMemo(
    () =>
      FP.pipe(
        volume24PriceRuneRD,
        RD.map(
          ({ asset, amount }) =>
            (prevVolume24PriceLabel.current /* store price label */ = `${currencySymbolByAsset(
              asset
            )} ${abbreviateNumber(
              baseToAsset(amount) /* show values as `AssetAmount`   */
                .amount()
                .toNumber(),
              2
            )}`)
        ),
        RD.fold(
          () => prevVolume24PriceLabel.current,
          () => prevVolume24PriceLabel.current,
          () => '--',
          FP.identity
        )
      ),

    [volume24PriceRuneRD]
  )
  const prevVolume24PriceMayaLabel = useRef<string>(loadingString)
  const volume24PriceMayaLabel = useMemo(
    () =>
      FP.pipe(
        volume24PriceMayaRD,
        RD.map(
          ({ asset, amount }) =>
            (prevVolume24PriceMayaLabel.current /* store price label */ = `${currencySymbolByAsset(
              asset
            )} ${abbreviateNumber(
              baseToAsset(amount) /* show values as `AssetAmount`   */
                .amount()
                .toNumber(),
              2
            )}`)
        ),
        RD.fold(
          () => prevVolume24PriceMayaLabel.current,
          () => prevVolume24PriceMayaLabel.current,
          () => '--',
          FP.identity
        )
      ),

    [volume24PriceMayaRD]
  )

  const reloadThorStats = useCallback(() => {
    if (!RD.isPending(volume24PriceRuneRD)) {
      reloadVolume24PriceRune()
    }
    if (!RD.isPending(runePriceRD)) {
      reloadRunePrice()
    }
  }, [reloadRunePrice, reloadVolume24PriceRune, runePriceRD, volume24PriceRuneRD])

  const reloadMayaStats = useCallback(() => {
    if (!RD.isPending(volume24PriceMayaRD)) {
      reloadVolume24PriceMaya()
    }
    if (!RD.isPending(mayaPriceRD)) {
      reloadMayaPrice()
    }
  }, [mayaPriceRD, reloadMayaPrice, reloadVolume24PriceMaya, volume24PriceMayaRD])

  return (
    <Styled.Wrapper className="space-x-2">
      <div
        className="flex cursor-pointer items-center space-x-2 rounded-xl bg-bg0 py-1 pl-1 pr-2 dark:bg-gray0d"
        onClick={reloadThorStats}>
        <AssetIcon size="xsmall" asset={AssetRuneNative} network={network} />
        <Styled.Protocol chain={THORChain}>{THORChain}</Styled.Protocol>
        <Styled.Label loading={RD.isPending(runePriceRD) ? 'true' : 'false'}>{runePriceLabel}</Styled.Label>

        {!isSmallMobileView && (
          <>
            <div className="h-full w-[1px] bg-gray2 dark:bg-gray2d" />
            <Styled.Label loading={RD.isPending(volume24PriceRuneRD) ? 'true' : 'false'}>
              {volume24PriceRuneLabel}
            </Styled.Label>
          </>
        )}
      </div>

      <div
        className="flex cursor-pointer items-center space-x-2 rounded-xl bg-bg0 py-1 pl-1 pr-2 dark:bg-gray0d"
        onClick={reloadMayaStats}>
        <AssetIcon size="xsmall" asset={AssetCacao} network={network} />
        <Styled.Protocol chain={MAYAChain}>{MAYAChain}</Styled.Protocol>
        <Styled.Label loading={RD.isPending(mayaPriceRD) ? 'true' : 'false'}>{mayaPriceLabel}</Styled.Label>

        {!isSmallMobileView && (
          <>
            <div className="h-full w-[1px] bg-gray2 dark:bg-gray2d" />
            <Styled.Label loading={RD.isPending(volume24PriceMayaRD) ? 'true' : 'false'}>
              {volume24PriceMayaLabel}
            </Styled.Label>
          </>
        )}
      </div>
    </Styled.Wrapper>
  )
}
