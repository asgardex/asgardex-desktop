import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { GAIAChain } from '@xchainjs/xchain-cosmos'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'

import { chainToString, isSupportedChain } from './chain'

describe('chain', () => {
  it('isSupportedChain', () => {
    expect(isSupportedChain('BTC')).toBeTruthy()
    expect(isSupportedChain('BCH')).toBeTruthy()
    expect(isSupportedChain('ETH')).toBeTruthy()
    expect(isSupportedChain('ARB')).toBeTruthy()
    expect(isSupportedChain('AVAX')).toBeTruthy()
    expect(isSupportedChain('BSC')).toBeTruthy()
    expect(isSupportedChain('THOR')).toBeTruthy()
    expect(isSupportedChain('GAIA')).toBeTruthy()
    expect(isSupportedChain('LTC')).toBeTruthy()
    expect(isSupportedChain('GAIA')).toBeTruthy()
    expect(isSupportedChain('ARB')).toBeTruthy()
    expect(isSupportedChain('invalid')).toBeFalsy()
    expect(isSupportedChain('')).toBeFalsy()
  })

  describe('chainToString', () => {
    it('THORChain', () => {
      expect(chainToString(THORChain)).toEqual('THORChain')
    })
    it('BTC', () => {
      expect(chainToString(BTCChain)).toEqual('Bitcoin')
    })
    it('BCH', () => {
      expect(chainToString(BCHChain)).toEqual('Bitcoin Cash')
    })
    it('ETH', () => {
      expect(chainToString(ETHChain)).toEqual('Ethereum')
    })
    it('AVAX', () => {
      expect(chainToString(AVAXChain)).toEqual('Avax')
    })
    it('BSC', () => {
      expect(chainToString(BSCChain)).toEqual('BNB Chain (BSC)')
    })
    it('GAIA', () => {
      expect(chainToString(GAIAChain)).toEqual('GAIA')
    })
    it('LTC', () => {
      expect(chainToString(LTCChain)).toEqual('Litecoin')
    })
    it('DOGE', () => {
      expect(chainToString(DOGEChain)).toEqual('Dogecoin')
    })
    it('ARB', () => {
      expect(chainToString(ARBChain)).toEqual('Arbitrum')
    })
    it('MAYA', () => {
      expect(chainToString(MAYAChain)).toEqual('MAYAChain')
    })
  })
})
