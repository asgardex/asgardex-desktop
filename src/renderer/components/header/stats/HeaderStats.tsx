import React, { useCallback, useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { AssetCacao } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { baseToAsset, formatAssetAmountCurrency, currencySymbolByAsset } from '@xchainjs/xchain-util'
import { Grid, Tooltip } from 'antd'
import * as FP from 'fp-ts/lib/function'
import { useIntl } from 'react-intl'

import { Dex } from '../../../../shared/api/types'
import { isUSDAsset } from '../../../helpers/assetHelper'
import { abbreviateNumber } from '../../../helpers/numberHelper'
import { loadingString } from '../../../helpers/stringHelper'
import { PriceRD } from '../../../services/midgard/types'
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
  dex: Dex
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
    reloadVolume24PriceMaya,
    dex
  } = props

  const isSmallMobileView = Grid.useBreakpoint()?.xs ?? false

  const intl = useIntl()

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
            decimal: isUSDAsset(asset) ? 2 : 6
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
            decimal: isUSDAsset(asset) ? 2 : 6
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

  const reloadVolume24PriceHandler = useCallback(() => {
    if (!RD.isPending(volume24PriceRuneRD)) {
      reloadVolume24PriceRune()
    }
  }, [reloadVolume24PriceRune, volume24PriceRuneRD])
  const reloadVolume24PriceHandlerMaya = useCallback(() => {
    if (!RD.isPending(volume24PriceMayaRD)) {
      reloadVolume24PriceMaya()
    }
  }, [reloadVolume24PriceMaya, volume24PriceMayaRD])

  const reloadRunePriceHandler = useCallback(() => {
    if (!RD.isPending(runePriceRD)) {
      reloadRunePrice()
    }
  }, [reloadRunePrice, runePriceRD])
  const reloadMayaPriceHandler = useCallback(() => {
    if (!RD.isPending(mayaPriceRD)) {
      reloadMayaPrice()
    }
  }, [reloadMayaPrice, mayaPriceRD])

  return (
    <Styled.Wrapper>
      <Styled.Container clickable={false}>
        <Styled.Dex dex={dex.chain}>{dex.chain}</Styled.Dex>
      </Styled.Container>
      <Styled.Container onClick={reloadRunePriceHandler} clickable={!RD.isPending(runePriceRD)}>
        <Styled.Title>
          {intl.formatMessage({ id: `common.price.${AssetRuneNative.symbol.toLowerCase()}` })}
        </Styled.Title>
        <Styled.Label loading={RD.isPending(runePriceRD) ? 'true' : 'false'}>{runePriceLabel}</Styled.Label>
      </Styled.Container>
      {!isSmallMobileView && (
        <>
          <Tooltip title={intl.formatMessage({ id: 'common.volume24.description' })}>
            <Styled.Container onClick={reloadVolume24PriceHandler} clickable={!RD.isPending(volume24PriceRuneRD)}>
              <Styled.Title>{intl.formatMessage({ id: 'common.volume24' })}</Styled.Title>
              <Styled.Label loading={RD.isPending(volume24PriceRuneRD) ? 'true' : 'false'}>
                {volume24PriceRuneLabel}
              </Styled.Label>
            </Styled.Container>
          </Tooltip>
        </>
      )}
      <Styled.Container clickable={false}>
        <Styled.Dex dex={AssetCacao.chain}>{AssetCacao.chain}</Styled.Dex>
      </Styled.Container>
      <Styled.Container onClick={reloadMayaPriceHandler} clickable={!RD.isPending(mayaPriceRD)}>
        <Styled.Title>{intl.formatMessage({ id: `common.price.${AssetCacao.symbol.toLowerCase()}` })}</Styled.Title>
        <Styled.Label loading={RD.isPending(mayaPriceRD) ? 'true' : 'false'}>{mayaPriceLabel}</Styled.Label>
      </Styled.Container>
      {!isSmallMobileView && (
        <>
          <Tooltip title={intl.formatMessage({ id: 'common.volume24.description' })}>
            <Styled.Container onClick={reloadVolume24PriceHandlerMaya} clickable={!RD.isPending(volume24PriceMayaRD)}>
              <Styled.Title>{intl.formatMessage({ id: 'common.volume24' })}</Styled.Title>
              <Styled.Label loading={RD.isPending(volume24PriceMayaRD) ? 'true' : 'false'}>
                {volume24PriceMayaLabel}
              </Styled.Label>
            </Styled.Container>
          </Tooltip>
        </>
      )}
    </Styled.Wrapper>
  )
}
