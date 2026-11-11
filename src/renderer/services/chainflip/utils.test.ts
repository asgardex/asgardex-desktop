import { AssetData } from '@chainflip/sdk/swap'
import { describe, expect, it } from 'vitest'

import { BSCChain } from '../../../shared/utils/chainIds'
import {
  cAssetToXAsset,
  cChainToXChain,
  chainflipAssetVolumeUsd,
  ChainflipVolumeResponse,
  sumVolumeByAsset,
  xChainToCChain
} from './utils'

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

  describe('sumVolumeByAsset', () => {
    it('sums source and destination volume per asset (a swap counts for both sides)', () => {
      const response: ChainflipVolumeResponse = {
        data: {
          bySource: {
            groupedAggregates: [
              { keys: ['Btc'], sum: { ingressValueUsd: '100.50' } },
              { keys: ['Usdc'], sum: { ingressValueUsd: '200' } }
            ]
          },
          byDestination: {
            groupedAggregates: [
              { keys: ['Usdc'], sum: { ingressValueUsd: '100.50' } },
              { keys: ['Eth'], sum: { ingressValueUsd: '50' } }
            ]
          }
        }
      }
      const volumeByAsset = sumVolumeByAsset(response)
      expect(volumeByAsset.get('Btc')).toBe(100.5)
      expect(volumeByAsset.get('Usdc')).toBe(300.5)
      expect(volumeByAsset.get('Eth')).toBe(50)
      expect(volumeByAsset.has('Flip')).toBe(false)
    })

    it('joins reporting keys to chainflipId so the same ticker on two chains stays distinct', () => {
      const volumeByAsset = sumVolumeByAsset({
        data: {
          bySource: {
            groupedAggregates: [
              { keys: ['Usdc'], sum: { ingressValueUsd: '10' } },
              { keys: ['ArbUsdc'], sum: { ingressValueUsd: '20' } }
            ]
          }
        }
      })
      const ethUsdc = { chainflipId: 'Usdc', asset: 'USDC' } as AssetData
      const arbUsdc = { chainflipId: 'ArbUsdc', asset: 'USDC' } as AssetData

      expect(chainflipAssetVolumeUsd(volumeByAsset, ethUsdc)).toBe(10)
      expect(chainflipAssetVolumeUsd(volumeByAsset, arbUsdc)).toBe(20)
      // The ticker (`AssetData.asset`) is not a reporting key and would miss both rows.
      expect(volumeByAsset.get(ethUsdc.asset)).toBeUndefined()
    })

    it('treats a null sum as 0, and tolerates a missing data payload', () => {
      expect(
        sumVolumeByAsset({
          data: { bySource: { groupedAggregates: [{ keys: ['Btc'], sum: { ingressValueUsd: null } }] } }
        }).get('Btc')
      ).toBe(0)
      expect(sumVolumeByAsset({}).size).toBe(0)
    })
  })
})
