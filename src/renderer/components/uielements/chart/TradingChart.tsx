import { useEffect, useRef } from 'react'

import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp
} from 'lightweight-charts'

import type { OHLCVData } from '../../../views/pools/detail/types'

type Props = {
  data: OHLCVData
}

const BULLISH_COLOR = '#50E3C2'
const BEARISH_COLOR = '#FF4D4F'

export const TradingChart = ({ data }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)

  // Create chart on mount
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#999'
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.06)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.06)' }
      },
      crosshair: {
        vertLine: { color: 'rgba(255, 255, 255, 0.2)' },
        horzLine: { color: 'rgba(255, 255, 255, 0.2)' }
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

    // Responsive resize
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
    }
  }, [])

  // Update data
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
      color: d.close >= d.open ? `${BULLISH_COLOR}40` : `${BEARISH_COLOR}40`
    }))

    candleSeriesRef.current.setData(candleData)
    volumeSeriesRef.current.setData(volumeData)
    chartRef.current?.timeScale().fitContent()
  }, [data])

  return <div ref={containerRef} className="h-[500px] w-full" />
}
