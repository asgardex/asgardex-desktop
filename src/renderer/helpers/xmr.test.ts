import { Network } from '@xchainjs/xchain-client'
import { AssetBTC, AssetXMR, XMRChain } from '../../shared/utils/chainIds'
import { getAddressPrefixLength, truncateAddress } from './addressHelper'
import { isXmrAsset } from './assetHelper'
import { getChain, getChainAsset, isXmrChain } from './chainHelper'

describe('XMR helpers', () => {
  it('getChainAsset / getChain / isXmrChain', () => {
    expect(getChainAsset(XMRChain)).toEqual(AssetXMR)
    expect(getChain('XMR')).toBe(XMRChain)
    expect(isXmrChain('XMR')).toBe(true)
    expect(isXmrChain('xmr')).toBe(true)
    expect(isXmrChain('BTC')).toBe(false)
  })

  it('isXmrAsset', () => {
    expect(isXmrAsset(AssetXMR)).toBe(true)
    expect(isXmrAsset(AssetBTC)).toBe(false)
  })

  it('address prefix length / truncation', () => {
    expect(getAddressPrefixLength(XMRChain, Network.Mainnet)).toBe(1)
    const addr = '4' + 'A'.repeat(94)
    expect(truncateAddress(addr, XMRChain, Network.Mainnet)).toBe(`4AAAAA...AAAAA`)
  })
})
