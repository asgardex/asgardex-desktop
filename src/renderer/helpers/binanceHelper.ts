import { AnyAsset } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'

import type { CandleTimeframe, ChartDateRange, OHLCVCandle } from '../views/pools/detail/types'

/**
 * Binance kline array format from /api/v3/klines
 * [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote, ignore]
 */
export type BinanceKline = [
  number, // openTime (ms)
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // closeTime (ms)
  string, // quoteAssetVolume
  number, // numberOfTrades
  string, // takerBuyBaseVolume
  string, // takerBuyQuoteVolume
  string // ignore
]

/** Tickers that have a USDT pair on Binance */
const BINANCE_TICKER_MAP: Record<string, string> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  BNB: 'BNBUSDT',
  DOGE: 'DOGEUSDT',
  ATOM: 'ATOMUSDT',
  USDC: 'USDCUSDT',
  RUNE: 'RUNEUSDT',
  AVAX: 'AVAXUSDT',
  LTC: 'LTCUSDT',
  BCH: 'BCHUSDT'
}

/**
 * Map a pool asset to its Binance trading symbol.
 * Returns O.none for assets not listed on Binance (e.g. CACAO).
 */
export const poolAssetToBinanceSymbol = (asset: AnyAsset): O.Option<string> => {
  const symbol = BINANCE_TICKER_MAP[asset.ticker]
  return symbol ? O.some(symbol) : O.none
}

/** Map app timeframe to Binance kline interval string */
export const timeframeToBinanceInterval = (tf: CandleTimeframe): string => {
  switch (tf) {
    case '1H':
      return '1h'
    case '4H':
      return '4h'
    case '1D':
      return '1d'
    case '1W':
      return '1w'
  }
}

/** Calculate start time in ms for Binance API based on date range */
export const dateRangeToStartTime = (range: ChartDateRange): number => {
  const days: Record<ChartDateRange, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '180d': 180,
    '365d': 365
  }
  return Date.now() - days[range] * 24 * 60 * 60 * 1000
}

/** Transform a Binance kline array to an OHLCVCandle */
export const binanceKlineToCandle = (kline: BinanceKline): OHLCVCandle => ({
  time: Math.floor(kline[0] / 1000), // ms → seconds
  open: parseFloat(kline[1]),
  high: parseFloat(kline[2]),
  low: parseFloat(kline[3]),
  close: parseFloat(kline[4]),
  volume: parseFloat(kline[5])
})
