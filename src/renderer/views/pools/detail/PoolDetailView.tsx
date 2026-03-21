import { useCallback, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { assetFromString, assetToString } from '@xchainjs/xchain-util'
import { function as FP } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useParams } from 'react-router-dom'

import { AssetIcon } from '../../../components/uielements/assets/assetIcon'
import { BackLinkButton } from '../../../components/uielements/button'
import {
  CandleTimeframeSelector,
  ChartDateRangeSelector,
  TradingChart,
  SpreadLabel,
  IndicatorToolbar
} from '../../../components/uielements/chart'
import { Label } from '../../../components/uielements/label'
import { Spin } from '../../../components/uielements/spin'
import { useAppContext } from '../../../contexts/AppContext'
import { usePriceLevelContext } from '../../../contexts/PriceLevelContext'
import { useBinanceOHLCV } from '../../../hooks/useBinanceOHLCV'
import { useChainflipPrice } from '../../../hooks/useChainflipPrice'
import { useOHLCVData } from '../../../hooks/useOHLCVData'
import { usePriceSpread } from '../../../hooks/usePriceSpread'
import { DEFAULT_NETWORK } from '../../../services/const'
import type { PriceLevel } from '../../../services/priceLevel/types'
import { TradingPanel, type TradingPanelHandle } from './TradingPanel'
import type { TradeMode } from './TradingPanelBar'
import type { CandleTimeframe, ChartDateRange, IndicatorConfig, OHLCVDataRD } from './types'

const DEFAULT_INDICATORS: IndicatorConfig[] = [
  { type: 'SMA', enabled: false, period: 20, color: '#FF6B6B' },
  { type: 'EMA', enabled: false, period: 20, color: '#4ECDC4' },
  { type: 'BB', enabled: false, period: 20, color: '#FFE66D' }
]

export const PoolDetailView = () => {
  const { asset: routeAsset } = useParams<{ asset: string }>()
  const intl = useIntl()
  const { network$ } = useAppContext()
  const network = useObservableState<Network>(network$, DEFAULT_NETWORK)
  const poolAsset = useMemo(() => (routeAsset ? assetFromString(routeAsset) : null), [routeAsset])

  const [timeframe, setTimeframe] = useState<CandleTimeframe>('4H')
  const [dateRange, setDateRange] = useState<ChartDateRange>('30d')
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(DEFAULT_INDICATORS)
  const [tradeMode, setTradeMode] = useState<TradeMode>('buy')

  const midgardDataRD = useOHLCVData({ poolAsset, timeframe, dateRange })
  const { dataRD: binanceDataRD, hasBinance } = useBinanceOHLCV({ poolAsset, timeframe, dateRange })
  const { priceRD: chainflipPriceRD } = useChainflipPrice(poolAsset)
  const spreadInfoRD = usePriceSpread(midgardDataRD, binanceDataRD, chainflipPriceRD)

  // Use Binance as primary when available and loaded, otherwise fall back to Midgard
  const chartDataRD: OHLCVDataRD = useMemo(() => {
    if (!hasBinance) return midgardDataRD
    if (RD.isPending(binanceDataRD)) return RD.pending
    if (RD.isInitial(binanceDataRD) || RD.isFailure(binanceDataRD)) return midgardDataRD
    const data = binanceDataRD.value
    return data.length > 0 ? RD.success(data) : midgardDataRD
  }, [hasBinance, binanceDataRD, midgardDataRD])

  // Track which data source the chart is actually using
  const chartSource = useMemo(() => {
    if (!hasBinance) return 'THORChain'
    if (RD.isSuccess(binanceDataRD) && binanceDataRD.value.length > 0) return 'Binance'
    return 'THORChain'
  }, [hasBinance, binanceDataRD])

  // ── Price levels ──────────────────────────────────────────────────────
  const priceLevelService = usePriceLevelContext()
  const assetKey = poolAsset ? assetToString(poolAsset) : ''
  const levelsMap = useObservableState(priceLevelService.levels$, {})
  const priceLevels: PriceLevel[] = assetKey ? (levelsMap[assetKey] ?? []) : []

  // TradingPanel exposes addPriceLevelAtPrice via this ref.
  // Chart click delegates to TradingPanel which captures the full trade context
  // (amount, target asset, direction) as a limit order.
  const tradingPanelRef = useRef<TradingPanelHandle | null>(null)

  const handlePriceClick = useCallback((price: number) => {
    tradingPanelRef.current?.addPriceLevelAtPrice(price)
  }, [])

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
        <AssetIcon asset={poolAsset} size="normal" network={network} className="pointer-events-none" />
        <h2 className="font-main text-18 text-text0 dark:text-text0d">{poolAsset.ticker}</h2>
      </div>

      {/* Chart + Trading panel — side by side on wide screens */}
      <div className="flex flex-col gap-3 rounded-lg bg-[#131722] lg:flex-row">
        {/* Chart column */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CandleTimeframeSelector selected={timeframe} onChange={setTimeframe} />
              <ChartDateRangeSelector selected={dateRange} onChange={setDateRange} />
              <span className="rounded bg-white/10 px-2 py-0.5 font-main text-11 text-gray-400">{chartSource}</span>
            </div>
            <div className="flex items-center gap-2">
              <IndicatorToolbar indicators={indicators} onChange={setIndicators} />
            </div>
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
                    <Label className="text-gray2">{intl.formatMessage({ id: 'pools.chart.noData' })}</Label>
                  </div>
                ) : (
                  <TradingChart
                    data={data}
                    indicators={indicators}
                    priceLevels={priceLevels}
                    onPriceClick={handlePriceClick}
                  />
                )
            )
          )}
        </div>

        {/* Trading panel column — fixed width on wide screens */}
        <div className="flex flex-col border-t border-white/10 lg:w-[320px] lg:border-t-0 lg:border-l">
          <TradingPanel
            poolAsset={poolAsset}
            network={network}
            tradeMode={tradeMode}
            setTradeMode={setTradeMode}
            handleRef={tradingPanelRef}
          />
        </div>
      </div>
    </div>
  )
}
