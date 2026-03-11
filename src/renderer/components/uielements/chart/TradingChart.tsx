import { useEffect, useRef } from 'react'

import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp
} from 'lightweight-charts'

import { calculateSMA, calculateEMA, calculateBollingerBands } from '../../../helpers/indicatorHelper'
import type { IndicatorConfig, OHLCVData } from '../../../views/pools/detail/types'

type Props = {
  data: OHLCVData
  indicators?: IndicatorConfig[]
}

const CHART_BG = '#131722'
const BULLISH_COLOR = '#50E3C2'
const BEARISH_COLOR = '#FF4D4F'

export const TradingChart = ({ data, indicators = [] }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const indicatorSeriesRefs = useRef<ISeriesApi<'Line'>[]>([])

  // Create chart on mount
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
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

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      chart.applyOptions({ width, height })
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
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

  return <div ref={containerRef} className="h-[500px] w-full rounded-lg" />
}
