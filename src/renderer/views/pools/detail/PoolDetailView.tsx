import { useCallback, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { assetFromString, assetToString } from '@xchainjs/xchain-util'
import { option as O, function as FP } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate, useParams } from 'react-router-dom'

import { AssetRuneNative, AssetCacao } from '../../../../shared/utils/asset'
import { Spin } from '../../../components/uielements/spin'
import { AssetIcon } from '../../../components/uielements/assets/assetIcon'
import { BackLinkButton } from '../../../components/uielements/button'
import {
  CandleTimeframeSelector,
  ChartDateRangeSelector,
  TradingChart,
  SpreadLabel
} from '../../../components/uielements/chart'
import { Label } from '../../../components/uielements/label'
import { DEFAULT_WALLET_TYPE } from '../../../const'
import { useAppContext } from '../../../contexts/AppContext'
import { useBinanceOHLCV } from '../../../hooks/useBinanceOHLCV'
import { useOHLCVData } from '../../../hooks/useOHLCVData'
import { usePriceSpread } from '../../../hooks/usePriceSpread'
import * as poolsRoutes from '../../../routes/pools'
import { DEFAULT_NETWORK } from '../../../services/const'
import { useApp } from '../../../store/app/hooks'
import type { CandleTimeframe, ChartDateRange, OHLCVDataRD } from './types'

export const PoolDetailView = () => {
  const { asset: routeAsset } = useParams<{ asset: string }>()
  const navigate = useNavigate()
  const intl = useIntl()
  const { protocol } = useApp()
  const { network$ } = useAppContext()
  const network = useObservableState<Network>(network$, DEFAULT_NETWORK)

  const [timeframe, setTimeframe] = useState<CandleTimeframe>('1D')
  const [dateRange, setDateRange] = useState<ChartDateRange>('30d')

  const poolAsset = useMemo(() => (routeAsset ? assetFromString(routeAsset) : null), [routeAsset])

  const midgardDataRD = useOHLCVData({ poolAsset, timeframe, dateRange })
  const { dataRD: binanceDataRD, binanceSymbol } = useBinanceOHLCV({ poolAsset, timeframe, dateRange })
  const spreadInfoRD = usePriceSpread(midgardDataRD, binanceDataRD)

  const hasBinance = O.isSome(binanceSymbol)

  // Use Binance as primary when available and loaded, otherwise fall back to Midgard
  const chartDataRD: OHLCVDataRD = useMemo(() => {
    if (!hasBinance) return midgardDataRD
    // If Binance succeeded, use it; if it failed, fall back to Midgard
    return FP.pipe(
      binanceDataRD,
      RD.fold(
        () => midgardDataRD, // initial → use Midgard
        () => RD.pending, // pending → show loading
        () => midgardDataRD, // failure → fall back to Midgard
        (data) => (data.length > 0 ? RD.success(data) : midgardDataRD)
      )
    )
  }, [hasBinance, binanceDataRD, midgardDataRD])

  const handleSwap = useCallback(() => {
    if (!poolAsset) return
    const target = protocol === THORChain ? AssetRuneNative : AssetCacao
    navigate(
      poolsRoutes.swap.path({
        source: assetToString(poolAsset),
        target: assetToString(target),
        sourceWalletType: DEFAULT_WALLET_TYPE,
        targetWalletType: DEFAULT_WALLET_TYPE
      })
    )
  }, [poolAsset, protocol, navigate])

  const handleDeposit = useCallback(() => {
    if (!poolAsset) return
    navigate(
      poolsRoutes.deposit.path({
        asset: assetToString(poolAsset),
        assetWalletType: DEFAULT_WALLET_TYPE,
        dexWalletType: DEFAULT_WALLET_TYPE
      })
    )
  }, [poolAsset, navigate])

  if (!poolAsset) {
    return (
      <div className="flex flex-col items-center p-4">
        <Label>{intl.formatMessage({ id: 'routes.invalid.params' })}</Label>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackLinkButton className="!m-0" />
        <AssetIcon asset={poolAsset} size="normal" network={network} />
        <h2 className="font-main text-18 text-text0 dark:text-text0d">{poolAsset.ticker}</h2>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <CandleTimeframeSelector selected={timeframe} onChange={setTimeframe} />
        <ChartDateRangeSelector selected={dateRange} onChange={setDateRange} />
      </div>

      {/* Spread label — only when Binance data is available */}
      {hasBinance &&
        FP.pipe(
          spreadInfoRD,
          RD.fold(
            () => null,
            () => null,
            () => null,
            (spread) => <SpreadLabel spread={spread} />
          )
        )}

      {/* Chart */}
      {FP.pipe(
        chartDataRD,
        RD.fold(
          () => (
            <div className="flex h-[500px] items-center justify-center">
              <Spin />
            </div>
          ),
          () => (
            <div className="flex h-[500px] items-center justify-center">
              <Spin />
            </div>
          ),
          (error) => (
            <div className="flex h-[500px] items-center justify-center">
              <Label className="text-error0 dark:text-error0d">{error.message}</Label>
            </div>
          ),
          (data) =>
            data.length === 0 ? (
              <div className="flex h-[500px] items-center justify-center">
                <Label>{intl.formatMessage({ id: 'pools.chart.noData' })}</Label>
              </div>
            ) : (
              <TradingChart data={data} />
            )
        )
      )}

      {/* Actions */}
      <div className="flex justify-center gap-4">
        <button
          onClick={handleSwap}
          className="rounded-lg bg-turquoise px-6 py-2 font-main text-14 text-white transition-opacity hover:opacity-80">
          {intl.formatMessage({ id: 'common.swap' })}
        </button>
        <button
          onClick={handleDeposit}
          className="rounded-lg border border-turquoise px-6 py-2 font-main text-14 text-turquoise transition-opacity hover:opacity-80">
          {intl.formatMessage({ id: 'common.add' })}
        </button>
      </div>
    </div>
  )
}
