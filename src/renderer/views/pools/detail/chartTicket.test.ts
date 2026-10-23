import { AssetType } from '@xchainjs/xchain-util'
import { describe, expect, it } from 'vitest'

import { THORChain } from '../../../../shared/utils/chainIds'
import { chartRouteAsset, counterAfterChartChange, readChartTicketState } from './chartTicket'

const avax = { chain: 'AVAX' as const, symbol: 'AVAX', ticker: 'AVAX', type: AssetType.NATIVE }
const usdt = {
  chain: 'AVAX' as const,
  symbol: 'USDT-0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  ticker: 'USDT',
  type: AssetType.TOKEN
}
const btc = { chain: 'BTC' as const, symbol: 'BTC', ticker: 'BTC', type: AssetType.NATIVE }

describe('chartTicket', () => {
  it('keeps the token being spent when the received asset changes to BTC', () => {
    expect(counterAfterChartChange(btc, avax, usdt)).toEqual(usdt)
  })

  it('keeps the other leg when a chain token replaces the chart asset', () => {
    expect(counterAfterChartChange(usdt, avax, btc)).toEqual(btc)
  })

  it('moves the previous chart asset across when it was the other leg', () => {
    expect(counterAfterChartChange(usdt, avax, usdt)).toEqual(avax)
  })

  it('drops a counter that is the chart asset itself', () => {
    expect(counterAfterChartChange(btc, avax, avax)).toBeNull()
  })

  it('opens a trade-settled token on its trade route and a wallet token on the pool', () => {
    expect(chartRouteAsset(usdt, 'trade', THORChain).type).toBe(AssetType.TRADE)
    expect(chartRouteAsset(usdt, 'wallet', THORChain)).toEqual(usdt)
  })

  it('reads only a chart ticket from route state', () => {
    expect(readChartTicketState({ tradeMode: 'buy', settlement: 'wallet', counter: 'AVAX.USDT-0x' })).toEqual({
      tradeMode: 'buy',
      settlement: 'wallet',
      counter: 'AVAX.USDT-0x'
    })
    expect(readChartTicketState({ other: true })).toBeNull()
    expect(readChartTicketState(null)).toBeNull()
  })
})
