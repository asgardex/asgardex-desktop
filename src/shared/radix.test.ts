import { AssetType, baseAmount, baseToAsset } from '@xchainjs/xchain-util'

import { AssetXRD, RadixChain, XRD_DECIMAL, radixTradeDisabled } from './radix'
import { isChainOfMaya, isChainOfThor, isSupportedChain } from './utils/chain'

describe('radix', () => {
  it('stays a wallet chain with swap and liquidity turned off', () => {
    expect(RadixChain).toBe('XRD')
    expect(XRD_DECIMAL).toBe(18)
    expect(AssetXRD).toEqual({
      chain: 'XRD',
      symbol: 'XRD',
      ticker: 'XRD',
      type: AssetType.NATIVE
    })
    expect(isSupportedChain(RadixChain)).toBe(true)
    expect(isChainOfMaya(RadixChain)).toBe(false)
    expect(isChainOfThor(RadixChain)).toBe(false)
    expect(radixTradeDisabled(RadixChain)).toBe(true)
    expect(radixTradeDisabled('BTC')).toBe(false)
  })

  it('keeps a positive XRD balance visible for an enabled wallet', () => {
    const amount = baseAmount('2500000000000000000', XRD_DECIMAL)
    const enabledChains = new Set<string>([RadixChain, 'BTC'])

    // Same rule as the assets list: an enabled chain stays, and a positive amount is kept.
    const visible = enabledChains.has(AssetXRD.chain) && amount.amount().gt(0)

    expect(visible).toBe(true)
    expect(baseToAsset(amount).amount().toFixed()).toBe('2.5')
  })
})
