import { Network } from '@xchainjs/xchain-client'
import {
  AssetXMR as SdkAssetXMR,
  XMR_DECIMALS as SDK_XMR_DECIMALS,
  XMRChain as SdkXMRChain
} from '@xchainjs/xchain-monero'

import { CHAINS_STORAGE_DEFAULT } from '../const'
import {
  chainToString,
  DEFAULT_ENABLED_CHAINS,
  OPT_IN_CHAINS,
  SUPPORTED_CHAINS,
  DefaultChainAttributes,
  getChainsForDex,
  isChainOfMaya,
  isChainOfThor,
  isSupportedChain,
  isWatchOnlyChain
} from './chain'
import { AssetXMR, XMRChain, XMR_DECIMAL } from './chainIds'

describe('XMR (watch-only chain)', () => {
  it('local chain ids match @xchainjs/xchain-monero', () => {
    expect(XMRChain).toBe(SdkXMRChain)
    expect(XMR_DECIMAL).toBe(SDK_XMR_DECIMALS)
    expect(AssetXMR).toEqual(SdkAssetXMR)
    expect(XMR_DECIMAL).toBe(12)
  })

  it('is supported and named', () => {
    expect(isSupportedChain('XMR')).toBe(true)
    expect(SUPPORTED_CHAINS.XMR).toBe('Monero')
    expect(chainToString('XMR')).toBe('Monero')
    expect(DefaultChainAttributes.XMR).toBeDefined()
  })

  describe('opt-in', () => {
    it('is not enabled by default (no key derivation / node access until the user enables it)', () => {
      expect(OPT_IN_CHAINS).toContain('XMR')
      expect(Object.keys(DEFAULT_ENABLED_CHAINS)).not.toContain('XMR')
      expect(CHAINS_STORAGE_DEFAULT.chains).not.toContain('XMR')
    })

    it('can still be enabled by the user (it stays a supported chain)', () => {
      expect(Object.keys(SUPPORTED_CHAINS)).toContain('XMR')
      expect(isSupportedChain('XMR')).toBe(true)
    })

    it('every other supported chain stays enabled by default', () => {
      const expected = Object.keys(SUPPORTED_CHAINS).filter((c) => c !== 'XMR')
      expect(Object.keys(DEFAULT_ENABLED_CHAINS).sort()).toEqual(expected.sort())
      expect([...CHAINS_STORAGE_DEFAULT.chains].sort()).toEqual(expected.sort())
    })
  })

  it('is excluded from THOR and MAYA swap lists', () => {
    expect(isChainOfThor('XMR')).toBe(false)
    expect(isChainOfMaya('XMR')).toBe(false)
    expect(getChainsForDex('THOR')).not.toContain('XMR')
    expect(getChainsForDex('MAYA')).not.toContain('XMR')
    // other chains stay untouched
    expect(isChainOfThor('BTC')).toBe(true)
    expect(isChainOfThor('ZEC')).toBe(true)
    expect(isChainOfMaya('ZEC')).toBe(true)
  })

  it('isWatchOnlyChain', () => {
    expect(isWatchOnlyChain('XMR')).toBe(true)
    expect(isWatchOnlyChain('xmr')).toBe(true)
    for (const chain of Object.keys(SUPPORTED_CHAINS).filter((c) => c !== 'XMR')) {
      expect(isWatchOnlyChain(chain)).toBe(false)
    }
  })

  it('network type is unused here, but Network enum still maps (sanity)', () => {
    expect(Network.Mainnet).toBeDefined()
  })
})
