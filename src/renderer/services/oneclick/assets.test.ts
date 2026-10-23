import { AssetBETH, BASEChain } from '@xchainjs/xchain-base'
import { AssetTRX, TRONChain } from '@xchainjs/xchain-tron'
import { AssetType } from '@xchainjs/xchain-util'
import { describe, expect, it } from 'vitest'

import { AssetZEC, ZECChain } from '../../../shared/utils/chainIds'
import { ONECLICK_FALLBACK_CHAINS, oneClickTokenToXAsset } from './assets'

const token = (blockchain: string, symbol: string, contractAddress?: string) => ({
  assetId: `${blockchain}:${symbol}`,
  blockchain,
  symbol,
  decimals: 18,
  contractAddress
})

describe('oneClickTokenToXAsset', () => {
  it('maps native Base ETH to the wallet gas asset', () => {
    expect(oneClickTokenToXAsset(token('base', 'ETH'))).toEqual(AssetBETH)
  })

  it('keeps a Base token contract on the asset symbol', () => {
    expect(oneClickTokenToXAsset(token('base', 'USDC', '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'))).toEqual({
      chain: BASEChain,
      symbol: 'USDC-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      ticker: 'USDC',
      type: AssetType.TOKEN
    })
  })

  it('maps native Tron and Zcash to the wallet assets', () => {
    expect(oneClickTokenToXAsset(token('tron', 'TRX'))).toEqual(AssetTRX)
    expect(oneClickTokenToXAsset(token('zec', 'ZEC'))).toEqual(AssetZEC)
  })

  it('drops a chain the aggregator map does not include', () => {
    expect(oneClickTokenToXAsset(token('gnosis', 'xDAI'))).toBeNull()
  })
})

describe('ONECLICK_FALLBACK_CHAINS', () => {
  it('includes Base, Tron, and Zcash before the token list loads', () => {
    expect(ONECLICK_FALLBACK_CHAINS).toEqual(expect.arrayContaining([BASEChain, TRONChain, ZECChain]))
  })
})
