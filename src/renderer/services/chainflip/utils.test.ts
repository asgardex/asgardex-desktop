import { AssetData } from '@chainflip/sdk/swap'
import { describe, expect, it } from 'vitest'

import { BSCChain } from '../../../shared/utils/chainIds'
import { cAssetToXAsset, cChainToXChain, xChainToCChain } from './utils'

describe('services/chainflip/utils', () => {
  // Regression: Chainflip mainnet added `Bsc` (BNB, USDT). Treating it as
  // unknown threw inside AssetsTableCollapsable's render and blanked the wallet.
  it('maps Chainflip Bsc onto the app BSC chain', () => {
    expect(cChainToXChain('Bsc')).toBe(BSCChain)
    expect(xChainToCChain(BSCChain)).toBe('Bsc')
  })

  it('returns null for chains ASGARDEX does not map', () => {
    expect(cChainToXChain('Assethub')).toBeNull()
    expect(cChainToXChain('SomeFutureChain' as AssetData['chain'])).toBeNull()
    expect(cChainToXChain('Bitcoin')).toBe('BTC')
  })

  it('converts a BSC asset instead of throwing during render', () => {
    const asset = cAssetToXAsset({
      chain: 'Bsc',
      asset: 'BNB',
      symbol: 'BNB',
      contractAddress: undefined
    } as AssetData)

    expect(asset).toMatchObject({ chain: 'BSC', symbol: 'BNB', ticker: 'BNB' })
  })

  it('cAssetToXAsset returns null instead of throwing for unknown chains', () => {
    const future = { chain: 'FutureChain', symbol: 'FUT' } as unknown as AssetData
    expect(() => cAssetToXAsset(future)).not.toThrow()
    expect(cAssetToXAsset(future)).toBeNull()
  })
})
