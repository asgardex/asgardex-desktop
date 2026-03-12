import { useEffect, useRef } from 'react'

import {
  createChart,
  CandlestickSeries,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  ColorType,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp
} from 'lightweight-charts'

import { calculateSMA, calculateEMA, calculateBollingerBands } from '../../../helpers/indicatorHelper'
import type { IndicatorConfig, OHLCVData, PriceLevel } from '../../../views/pools/detail/types'

type Props = {
  data: OHLCVData
  indicators?: IndicatorConfig[]
  priceLevels?: PriceLevel[]
  onPriceClick?: (price: number) => void
}

const CHART_BG = '#131722'
const BULLISH_COLOR = '#50E3C2'
const BEARISH_COLOR = '#FF4D4F'

const BUY_COLOR = '#22c55e'
const SELL_COLOR = '#ef4444'

export const TradingChart = ({ data, indicators = [], priceLevels = [], onPriceClick }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const indicatorSeriesRefs = useRef<ISeriesApi<'Line'>[]>([])
  const priceLevelRefs = useRef<Map<string, IPriceLine>>(new Map())
  const onPriceClickRef = useRef(onPriceClick)
  onPriceClickRef.current = onPriceClick

  // Create chart on mount
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: CHART_BG },
        textColor: '#999',
        fontFamily: "'MainFontRegular', sans-serif"
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.06)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.06)' }
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255, 255, 255, 0.25)', labelBackgroundColor: '#333' },
        horzLine: { color: 'rgba(255, 255, 255, 0.25)', labelBackgroundColor: '#333' }
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)'
      }
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: BULLISH_COLOR,
      downColor: BEARISH_COLOR,
      borderUpColor: BULLISH_COLOR,
      borderDownColor: BEARISH_COLOR,
      wickUpColor: BULLISH_COLOR,
      wickDownColor: BEARISH_COLOR
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume'
    })

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 }
    })

    chartRef.current = chart
    candleSeriesRef.current = candleSeries
    volumeSeriesRef.current = volumeSeries

    chart.subscribeClick((params) => {
      if (!params.point || !candleSeriesRef.current) return
      const price = candleSeriesRef.current.coordinateToPrice(params.point.y)
      if (price !== null && onPriceClickRef.current) {
        onPriceClickRef.current(Number(price))
      }
    })

    return () => {
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      indicatorSeriesRefs.current = []
    }
  }, [])

  // Update candle + volume data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || data.length === 0) return

    const candleData = data.map((d) => ({
      time: d.time as UTCTimestamp,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close
    }))

    const volumeData = data.map((d) => ({
      time: d.time as UTCTimestamp,
      value: d.volume,
      color: d.close >= d.open ? `${BULLISH_COLOR}30` : `${BEARISH_COLOR}30`
    }))

    candleSeriesRef.current.setData(candleData)
    volumeSeriesRef.current.setData(volumeData)
    chartRef.current?.timeScale().fitContent()
  }, [data])

  // Update indicator overlay series
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || data.length === 0) return

    for (const series of indicatorSeriesRefs.current) {
      chart.removeSeries(series)
    }
    indicatorSeriesRefs.current = []

    const closes = data.map((d) => d.close)
    const times = data.map((d) => d.time as UTCTimestamp)

    const addLineSeries = (values: (number | null)[], color: string, lineWidth: 1 | 2 = 2) => {
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false
      })
      const lineData = values
        .map((v, i) => (v !== null ? { time: times[i], value: v } : null))
        .filter((d): d is { time: UTCTimestamp; value: number } => d !== null)
      series.setData(lineData)
      indicatorSeriesRefs.current.push(series)
    }

    for (const ind of indicators) {
      if (!ind.enabled) continue

      switch (ind.type) {
        case 'SMA': {
          const smaValues = calculateSMA(closes, ind.period)
          addLineSeries(smaValues, ind.color)
          break
        }
        case 'EMA': {
          const emaValues = calculateEMA(closes, ind.period)
          addLineSeries(emaValues, ind.color)
          break
        }
        case 'BB': {
          const bb = calculateBollingerBands(closes, ind.period)
          addLineSeries(bb.upper, `${ind.color}99`, 1)
          addLineSeries(bb.middle, ind.color, 1)
          addLineSeries(bb.lower, `${ind.color}99`, 1)
          break
        }
      }
    }
  }, [data, indicators])

  // Sync price level lines
  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series) return

    const currentIds = new Set(priceLevels.map((l) => l.id))
    const existingMap = priceLevelRefs.current

    // Remove lines no longer present
    for (const [id, line] of existingMap) {
      if (!currentIds.has(id)) {
        series.removePriceLine(line)
        existingMap.delete(id)
      }
    }

    // Add or update lines
    for (const level of priceLevels) {
      const baseColor = level.type === 'buy' ? BUY_COLOR : SELL_COLOR
      const isTerminal = level.status === 'completed' || level.status === 'failed'
      const isActive = level.status === 'triggered' || level.status === 'confirming' || level.status === 'executing'

      const color = isTerminal ? `${baseColor}66` : baseColor
      const lineStyle = isActive ? LineStyle.Solid : isTerminal ? LineStyle.Dotted : LineStyle.Dashed
      const lineWidth = isActive ? 2 : 1

      const typeLabel = level.type === 'buy' ? 'Buy' : 'Sell'
      const title = level.amount ? `${typeLabel} ${level.amount}` : typeLabel

      const existing = existingMap.get(level.id)
      if (existing) {
        // Update existing line options
        existing.applyOptions({ price: level.price, color, lineStyle, lineWidth: lineWidth as 1 | 2, title })
      } else {
        const line = series.createPriceLine({
          price: level.price,
          color,
          lineWidth: lineWidth as 1 | 2,
          lineStyle,
          axisLabelVisible: true,
          title
        })
        existingMap.set(level.id, line)
      }
    }
  }, [priceLevels])

  return <div ref={containerRef} className="h-[500px] w-full rounded-lg" />
}
