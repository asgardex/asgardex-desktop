import { AssetData } from '@chainflip/sdk/swap'
import { describe, expect, it } from 'vitest'

import { cAssetToXAsset, cChainToXChain } from './utils'

describe('services/chainflip/utils', () => {
  // Regression: Chainflip mainnet added `Bsc` (BNB, USDT), which threw inside
  // AssetsTableCollapsable's render and blanked the wallet after unlock.
  it('cChainToXChain returns null for chains unknown to ASGARDEX', () => {
    expect(cChainToXChain('Bsc' as AssetData['chain'])).toBeNull()
    expect(cChainToXChain('Assethub')).toBeNull()
    expect(cChainToXChain('SomeFutureChain' as AssetData['chain'])).toBeNull()
    expect(cChainToXChain('Bitcoin')).toBe('BTC')
  })

  it('cAssetToXAsset returns null instead of throwing for unknown chains', () => {
    const bsc = { chain: 'Bsc', symbol: 'USDT', contractAddress: '0x55d3' } as unknown as AssetData
    expect(() => cAssetToXAsset(bsc)).not.toThrow()
    expect(cAssetToXAsset(bsc)).toBeNull()
  })
})
