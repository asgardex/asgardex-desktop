import { AssetAETH } from '@xchainjs/xchain-arbitrum'
import { AssetAVAX } from '@xchainjs/xchain-avax'
import { AssetBETH } from '@xchainjs/xchain-base'
import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { AssetBCH } from '@xchainjs/xchain-bitcoincash'
import { AssetBSC } from '@xchainjs/xchain-bsc'
import { AssetETH } from '@xchainjs/xchain-ethereum'

import { AssetUSDT } from '../const'
import { isEvmChain, isEvmChainAsset, isEvmChainToken } from './evmHelper'

// 1. Test isEvmChain
describe('helpers/evmHelper', () => {
  describe('isEvmChain', () => {
    it('returns true for Ethereum chain', () => {
      expect(isEvmChain(AssetETH.chain)).toBe(true)
    })

    it('returns true for Avalanche chain', () => {
      expect(isEvmChain(AssetAVAX.chain)).toBe(true)
    })

    it('returns true for BSC chain', () => {
      expect(isEvmChain(AssetBSC.chain)).toBe(true)
    })

    it('returns true for Arbitrum chain', () => {
      expect(isEvmChain(AssetAETH.chain)).toBe(true)
    })

    it('returns true for Base chain', () => {
      expect(isEvmChain(AssetBETH.chain)).toBe(true)
    })

    it('returns false for non-EVM chain (BTC)', () => {
      expect(isEvmChain(AssetBCH.chain)).toBe(false)
    })
  })

  // 3. Test isEvmChainToken
  describe('isEvmChainToken', () => {
    it('returns true for an EVM token (ETH.USDT)', () => {
      expect(isEvmChainToken(AssetUSDT)).toBe(true)
    })

    it('returns false for native EVM asset (ETH.ETH)', () => {
      expect(isEvmChainToken(AssetETH)).toBe(false)
    })

    it('returns false for non-EVM asset (BTC.BTC)', () => {
      expect(isEvmChainToken(AssetBTC)).toBe(false) // No EVM chain mocks set to true
    })

    it('returns false for native BSC asset (BSC.BNB)', () => {
      expect(isEvmChainToken(AssetBSC)).toBe(false)
    })
  })

  // 4. Test isEvmChainAsset
  describe('isEvmChainAsset', () => {
    it('returns true for native ETH (ETH.ETH)', () => {
      expect(isEvmChainAsset(AssetETH)).toBe(true)
    })

    it('returns true for native BNB (BSC.BNB)', () => {
      expect(isEvmChainAsset(AssetBSC)).toBe(true)
    })

    it('returns true for native AVAX (AVAX.AVAX)', () => {
      expect(isEvmChainAsset(AssetAVAX)).toBe(true)
    })

    it('returns false for non-native token (ETH.USDT)', () => {
      expect(isEvmChainAsset(AssetUSDT)).toBe(false)
    })

    it('returns false for non-EVM asset (BTC.BTC)', () => {
      expect(isEvmChainAsset(AssetBTC)).toBe(false)
    })
  })
})
