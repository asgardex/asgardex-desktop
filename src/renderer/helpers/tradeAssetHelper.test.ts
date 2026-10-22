import { AssetType } from '@xchainjs/xchain-util'
import { describe, expect, it } from 'vitest'

import { AssetCacao, AssetRuneNative, MAYAChain, THORChain } from '../../shared/utils/chainIds'
import {
  menuAssets,
  orderSwapAssets,
  preferredCounter,
  settlementChainAsset,
  supportsTradeSettlement,
  toPoolAsset,
  toTradeAsset
} from './tradeAssetHelper'

const eth: { chain: 'ETH'; symbol: string; ticker: string; type: AssetType } = {
  chain: 'ETH',
  symbol: 'ETH',
  ticker: 'ETH',
  type: AssetType.NATIVE
}

const ethUsdc = {
  chain: 'ETH' as const,
  symbol: 'USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48',
  ticker: 'USDC',
  type: AssetType.TOKEN
}

describe('tradeAssetHelper', () => {
  it('charts a trade asset as its underlying pool asset', () => {
    expect(toPoolAsset({ ...eth, type: AssetType.TRADE })).toEqual(eth)
    expect(toPoolAsset({ ...ethUsdc, type: AssetType.TRADE }).type).toBe(AssetType.TOKEN)
    expect(toPoolAsset(eth)).toEqual(eth)
  })

  it('keeps the dex native asset native and marks the rest as trade', () => {
    expect(toTradeAsset(AssetRuneNative, THORChain)).toBe(AssetRuneNative)
    expect(toTradeAsset(AssetCacao, MAYAChain)).toBe(AssetCacao)
    expect(toTradeAsset(eth, THORChain).type).toBe(AssetType.TRADE)
    expect(toTradeAsset(ethUsdc, MAYAChain).symbol).toBe(ethUsdc.symbol)
  })

  it('sends a trade asset from the dex chain for the selected protocol', () => {
    expect(settlementChainAsset({ ...eth, type: AssetType.TRADE }, THORChain)).toBe(AssetRuneNative)
    expect(settlementChainAsset({ ...eth, type: AssetType.TRADE }, MAYAChain)).toBe(AssetCacao)
    expect(settlementChainAsset(eth, THORChain)).toEqual(eth)
  })

  it('lists stablecoins before other assets and drops the excluded one', () => {
    const btc = { chain: 'BTC' as const, symbol: 'BTC', ticker: 'BTC', type: AssetType.NATIVE }
    const avax = { chain: 'AVAX' as const, symbol: 'AVAX', ticker: 'AVAX', type: AssetType.NATIVE }
    const usdt = { chain: 'AVAX' as const, symbol: 'USDT-0x', ticker: 'USDT', type: AssetType.TOKEN }
    expect(menuAssets([avax, btc, usdt]).map((asset) => asset.ticker)).toEqual(['USDT', 'AVAX', 'BTC'])
    expect(orderSwapAssets([avax, btc, usdt], avax).map((asset) => asset.ticker)).toEqual(['USDT', 'BTC'])
  })

  it('opens the counter on ETH USDC, then any USDC, then BTC', () => {
    const busd = { chain: 'BSC' as const, symbol: 'BUSD-0x', ticker: 'BUSD', type: AssetType.TOKEN }
    const btc = { chain: 'BTC' as const, symbol: 'BTC', ticker: 'BTC', type: AssetType.NATIVE }
    const bscUsdc = { chain: 'BSC' as const, symbol: 'USDC-0x', ticker: 'USDC', type: AssetType.TOKEN }
    expect(preferredCounter([busd, bscUsdc, ethUsdc, btc])).toEqual(ethUsdc)
    expect(preferredCounter([busd, bscUsdc, btc])).toEqual(bscUsdc)
    expect(preferredCounter([busd, btc])).toEqual(btc)
    expect(preferredCounter([])).toBeNull()
  })

  it('allows trade settlement only on a chain the selected dex lists', () => {
    expect(supportsTradeSettlement(eth, THORChain)).toBe(true)
    expect(supportsTradeSettlement(eth, MAYAChain)).toBe(true)
    expect(
      supportsTradeSettlement({ chain: 'SOL', symbol: 'SOL', ticker: 'SOL', type: AssetType.NATIVE }, MAYAChain)
    ).toBe(false)
  })
})
