import { useCallback, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, AssetType, assetFromString, assetToString } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
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
  IndicatorToolbar,
  formatChartUsd
} from '../../../components/uielements/chart'
import { Label } from '../../../components/uielements/label'
import { Spin } from '../../../components/uielements/spin'
import { useAppContext } from '../../../contexts/AppContext'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { usePriceLevelContext } from '../../../contexts/PriceLevelContext'
import { isUSDAsset } from '../../../helpers/assetHelper'
import { toPoolAsset } from '../../../helpers/tradeAssetHelper'
import { useBinanceOHLCV } from '../../../hooks/useBinanceOHLCV'
import { useChainflipPrice } from '../../../hooks/useChainflipPrice'
import { useOHLCVData } from '../../../hooks/useOHLCVData'
import { usePriceSpread } from '../../../hooks/usePriceSpread'
import { DEFAULT_NETWORK } from '../../../services/const'
import { getPoolDetail } from '../../../services/midgard/thorMidgard/utils'
import type { PriceLevel } from '../../../services/priceLevel/types'
import { chartHeadline } from './chartHeadline'
import { levelPriceOnChart } from './limitPrice'
import { formatChartAmount, ratioCandles } from './pairChart'
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
  const routeParsed = useMemo(() => (routeAsset ? assetFromString(routeAsset) : null), [routeAsset])
  // `ETH~ETH` is the same pool as `ETH.ETH`. The ticket opens in trade settlement.
  const poolAsset = useMemo(() => (routeParsed ? toPoolAsset(routeParsed) : null), [routeParsed])
  const initialSettlement = routeParsed?.type === AssetType.TRADE ? 'trade' : 'wallet'

  const [timeframe, setTimeframe] = useState<CandleTimeframe>('4H')
  const [dateRange, setDateRange] = useState<ChartDateRange>('30d')
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(DEFAULT_INDICATORS)
  // The ticket sizes the chart asset, so the live quote starts as a sell of that size.
  const [tradeMode, setTradeMode] = useState<TradeMode>('sell')
  const [counterAsset, setCounterAsset] = useState<AnyAsset | null>(null)

  const midgardDataRD = useOHLCVData({ poolAsset, timeframe, dateRange })
  const { dataRD: binanceDataRD, hasBinance } = useBinanceOHLCV({ poolAsset, timeframe, dateRange })
  // A dollar stable keeps the asset/USD chart. Anything else is repriced from the two USDT markets.
  // The pool list rebuilds the asset object; the Binance symbol only depends on the ticker.
  const quoteTicker = counterAsset?.ticker ?? ''
  const quoteAsset = useMemo(() => {
    if (!counterAsset || isUSDAsset(counterAsset) || counterAsset.ticker === poolAsset?.ticker) return null
    return counterAsset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteTicker, poolAsset?.ticker])
  const { dataRD: quoteBinanceRD, hasBinance: quoteHasBinance } = useBinanceOHLCV({
    poolAsset: quoteAsset,
    timeframe,
    dateRange
  })
  const { priceRD: chainflipPriceRD } = useChainflipPrice(poolAsset)
  const spreadInfoRD = usePriceSpread(midgardDataRD, binanceDataRD, chainflipPriceRD)

  const wantsPair = quoteAsset !== null && hasBinance && quoteHasBinance

  // Pair series when both legs have a Binance USDT market. Otherwise the chart stays in dollars.
  const chartView = useMemo((): { data: OHLCVDataRD; unit: 'usd' | 'pair' } => {
    const usd = (): { data: OHLCVDataRD; unit: 'usd' } => {
      if (!hasBinance) return { data: midgardDataRD, unit: 'usd' }
      if (RD.isPending(binanceDataRD)) return { data: RD.pending, unit: 'usd' }
      if (RD.isInitial(binanceDataRD) || RD.isFailure(binanceDataRD)) return { data: midgardDataRD, unit: 'usd' }
      return binanceDataRD.value.length > 0
        ? { data: RD.success(binanceDataRD.value), unit: 'usd' }
        : { data: midgardDataRD, unit: 'usd' }
    }
    if (!wantsPair) return usd()
    if (
      RD.isPending(binanceDataRD) ||
      RD.isInitial(binanceDataRD) ||
      RD.isPending(quoteBinanceRD) ||
      RD.isInitial(quoteBinanceRD)
    ) {
      return { data: RD.pending, unit: 'pair' as const }
    }
    if (RD.isSuccess(binanceDataRD) && RD.isSuccess(quoteBinanceRD)) {
      const ratio = ratioCandles(binanceDataRD.value, quoteBinanceRD.value)
      if (ratio.length > 0) return { data: RD.success(ratio), unit: 'pair' as const }
    }
    return usd()
  }, [wantsPair, hasBinance, binanceDataRD, quoteBinanceRD, midgardDataRD])

  const chartDataRD = chartView.data
  const chartUnit = chartView.unit

  // Track which data source the chart is actually using
  const chartSource = useMemo(() => {
    if (chartUnit === 'pair') return 'Binance'
    if (!hasBinance) return 'THORChain'
    if (RD.isSuccess(binanceDataRD) && binanceDataRD.value.length > 0) return 'Binance'
    return 'THORChain'
  }, [chartUnit, hasBinance, binanceDataRD])

  const headline = useMemo(() => (RD.isSuccess(chartDataRD) ? chartHeadline(chartDataRD.value) : null), [chartDataRD])

  const chartSourceLabel =
    chartSource === 'Binance'
      ? intl.formatMessage({ id: 'pools.chart.source.binance' })
      : intl.formatMessage({ id: 'pools.chart.source.midgard' })

  // ── Price levels ──────────────────────────────────────────────────────
  const priceLevelService = usePriceLevelContext()
  const assetKey = poolAsset ? assetToString(poolAsset) : ''
  const levelsMap = useObservableState(priceLevelService.levels$, {})
  const priceLevels: PriceLevel[] = assetKey ? (levelsMap[assetKey] ?? []) : []
  const {
    service: {
      pools: { poolsState$ }
    }
  } = useMidgardContext()
  const poolsRD = useObservableState(poolsState$, RD.pending)
  // Orders are stored as THORChain USD. Pair charts need that price scaled onto the counter axis.
  const poolUsd = useMemo(() => {
    if (!poolAsset || !RD.isSuccess(poolsRD)) return 0
    const price = FP.pipe(
      getPoolDetail(poolsRD.value.poolDetails, poolAsset),
      O.chain((detail) => O.fromNullable(detail.assetPriceUSD)),
      O.map(Number),
      O.getOrElse(() => 0)
    )
    return Number.isFinite(price) && price > 0 ? price : 0
  }, [poolAsset, poolsRD])
  const chartPrice = headline?.last ?? 0
  const chartLevels = useMemo(
    () =>
      priceLevels.flatMap((level) => {
        const price = levelPriceOnChart(level.price, poolUsd, chartPrice)
        return price === null ? [] : [{ ...level, price }]
      }),
    [priceLevels, poolUsd, chartPrice]
  )

  // TradingPanel exposes setLimitPriceFromChart via this ref.
  // A chart click fills the limit price. Buy or Sell places the order.
  const tradingPanelRef = useRef<TradingPanelHandle | null>(null)

  const handlePriceClick = useCallback((price: number) => {
    tradingPanelRef.current?.setLimitPriceFromChart(price)
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
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <h2 className="m-0 font-main text-18 text-text0 dark:text-text0d">
              {poolAsset.ticker}
              <span className="text-gray2 dark:text-gray2d"> / {counterAsset?.ticker ?? '—'}</span>
            </h2>
            {initialSettlement === 'trade' && (
              <span className="rounded bg-turquoise/15 px-1.5 py-0.5 font-main text-[10px] font-semibold tracking-wide text-turquoise uppercase">
                {intl.formatMessage({ id: 'pools.chart.tradingPanel.tradeAccount' })}
              </span>
            )}
          </div>
          {headline && (
            <div className="flex items-baseline gap-2">
              <span className="font-main text-11 text-gray2 dark:text-gray2d">
                {intl.formatMessage({ id: 'common.price' })}
              </span>
              <span className="font-main text-14 text-text0 dark:text-text0d">
                {chartUnit === 'pair' && counterAsset
                  ? formatChartAmount(headline.last, counterAsset.ticker)
                  : formatChartUsd(headline.last)}
              </span>
              {headline.changePct !== null && (
                <span
                  className={clsx(
                    'text-12 font-main',
                    headline.changePct >= 0 ? 'text-turquoise' : 'text-error0 dark:text-error0d'
                  )}>
                  {dateRange} {headline.changePct >= 0 ? '+' : ''}
                  {headline.changePct.toFixed(2)}%
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chart + Trading panel — side by side on wide screens */}
      <div className="flex flex-col gap-3 rounded-lg bg-[#131722] lg:flex-row">
        {/* Chart column */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-lg bg-white/5 px-1 py-1">
                <span className="text-10 px-1.5 font-main tracking-wide text-gray-500 uppercase">
                  {intl.formatMessage({ id: 'pools.chart.timeframe' })}
                </span>
                <CandleTimeframeSelector selected={timeframe} onChange={setTimeframe} />
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-white/5 px-1 py-1">
                <span className="text-10 px-1.5 font-main tracking-wide text-gray-500 uppercase">
                  {intl.formatMessage({ id: 'pools.chart.range' })}
                </span>
                <ChartDateRangeSelector selected={dateRange} onChange={setDateRange} />
              </div>
            </div>
            <IndicatorToolbar indicators={indicators} onChange={setIndicators} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {chartUnit === 'usd' && hasBinance && RD.isSuccess(spreadInfoRD) ? (
              <SpreadLabel spread={spreadInfoRD.value} />
            ) : (
              <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 font-main text-11 text-gray-300">
                {chartSourceLabel}
              </span>
            )}
          </div>

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
                    priceLevels={chartLevels}
                    onPriceClick={handlePriceClick}
                  />
                )
            )
          )}
        </div>

        {/* Trading panel column — fixed width on wide screens */}
        <div className="flex min-h-0 flex-col border-t border-white/10 lg:w-[380px] lg:border-t-0 lg:border-l">
          <TradingPanel
            key={routeAsset}
            poolAsset={poolAsset}
            network={network}
            tradeMode={tradeMode}
            setTradeMode={setTradeMode}
            initialSettlement={initialSettlement}
            handleRef={tradingPanelRef}
            onCounterAssetChange={setCounterAsset}
            chartUnit={chartUnit}
            chartPrice={headline?.last ?? 0}
          />
        </div>
      </div>
    </div>
  )
}
