import { AssetType } from '@xchainjs/xchain-util'

import { isChainOfMaya, isChainOfThor, isSupportedChain, radixTradeDisabled } from './utils/chain'
import { AssetXRD, RadixChain, XRD_DECIMAL } from './utils/chainIds'

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
})
