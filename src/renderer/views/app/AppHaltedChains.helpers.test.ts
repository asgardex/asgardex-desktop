import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { describe, expect, it } from 'vitest'

import { MimirHalt } from '../../services/thorchain/types'
import {
  CHAINFLIP_LABEL,
  getSwapAlternativeLabels,
  isProtocolChainTradingHalted,
  isProtocolGloballyHalted,
  isProtocolUsableAsSwapAlternative,
  ResolvedProtocolData
} from './AppHaltedChains.helpers'

const baseMimir = {
  HALTTHORCHAIN: false,
  haltGlobalTrading: false,
  pauseGlobalLp: false
} as MimirHalt

const makeProtocol = (
  overrides: Partial<ResolvedProtocolData> & Pick<ResolvedProtocolData, 'protocol'>
): ResolvedProtocolData => {
  const { mimirHalt: mimirOverride, ...rest } = overrides
  return {
    inboundHaltedChains: [],
    midgard: true,
    ...rest,
    mimirHalt: { ...baseMimir, ...(mimirOverride ?? {}) }
  }
}

describe('AppHaltedChains.helpers', () => {
  describe('isProtocolGloballyHalted', () => {
    it('detects haltGlobalTrading and HALTTHORCHAIN', () => {
      expect(
        isProtocolGloballyHalted(
          makeProtocol({ protocol: THORChain, mimirHalt: { ...baseMimir, haltGlobalTrading: true } })
        )
      ).toBe(true)
      expect(
        isProtocolGloballyHalted(
          makeProtocol({ protocol: THORChain, mimirHalt: { ...baseMimir, HALTTHORCHAIN: true } })
        )
      ).toBe(true)
      expect(isProtocolGloballyHalted(makeProtocol({ protocol: MAYAChain }))).toBe(false)
    })
  })

  describe('isProtocolChainTradingHalted', () => {
    it('flags inbound, HALT*CHAIN, and HALT*TRADING', () => {
      expect(
        isProtocolChainTradingHalted(makeProtocol({ protocol: MAYAChain, inboundHaltedChains: ['BTC'] }), 'BTC')
      ).toBe(true)
      expect(
        isProtocolChainTradingHalted(
          makeProtocol({ protocol: MAYAChain, mimirHalt: { ...baseMimir, HALTETHCHAIN: true } as MimirHalt }),
          'ETH'
        )
      ).toBe(true)
      expect(
        isProtocolChainTradingHalted(
          makeProtocol({ protocol: MAYAChain, mimirHalt: { ...baseMimir, HALTBTCTRADING: true } as MimirHalt }),
          'BTC'
        )
      ).toBe(true)
      expect(isProtocolChainTradingHalted(makeProtocol({ protocol: MAYAChain }), 'BTC')).toBe(false)
    })
  })

  describe('isProtocolUsableAsSwapAlternative / getSwapAlternativeLabels', () => {
    it('does not advertise Maya when Maya has per-chain trading halts (pools overview)', () => {
      const thor = makeProtocol({ protocol: THORChain, mimirHalt: { ...baseMimir, haltGlobalTrading: true } })
      const maya = makeProtocol({
        protocol: MAYAChain,
        mimirHalt: { ...baseMimir, HALTBTCTRADING: true, HALTETHTRADING: true } as MimirHalt
      })

      expect(isProtocolUsableAsSwapAlternative(maya)).toBe(false)
      expect(getSwapAlternativeLabels([thor, maya])).toEqual([CHAINFLIP_LABEL])
    })

    it('keeps Maya as an alternative when selected chains are not halted on Maya', () => {
      const thor = makeProtocol({ protocol: THORChain, mimirHalt: { ...baseMimir, haltGlobalTrading: true } })
      const maya = makeProtocol({
        protocol: MAYAChain,
        mimirHalt: { ...baseMimir, HALTBTCTRADING: true } as MimirHalt
      })

      // ZEC is unaffected by Maya's BTC trading halt
      expect(isProtocolUsableAsSwapAlternative(maya, ['ZEC'])).toBe(true)
      expect(getSwapAlternativeLabels([thor, maya], ['ZEC'])).toEqual([CHAINFLIP_LABEL, MAYAChain])
    })

    it('drops Maya for a BTC/ETH swap when those chains are trading-halted on Maya', () => {
      const thor = makeProtocol({ protocol: THORChain, mimirHalt: { ...baseMimir, haltGlobalTrading: true } })
      const maya = makeProtocol({
        protocol: MAYAChain,
        mimirHalt: { ...baseMimir, HALTBTCTRADING: true, HALTETHTRADING: true } as MimirHalt
      })

      expect(isProtocolUsableAsSwapAlternative(maya, ['BTC', 'ETH'])).toBe(false)
      expect(getSwapAlternativeLabels([thor, maya], ['BTC', 'ETH'])).toEqual([CHAINFLIP_LABEL])
    })

    it('never lists a globally halted protocol as an alternative', () => {
      const thor = makeProtocol({ protocol: THORChain, mimirHalt: { ...baseMimir, haltGlobalTrading: true } })
      const maya = makeProtocol({ protocol: MAYAChain, mimirHalt: { ...baseMimir, haltGlobalTrading: true } })
      expect(getSwapAlternativeLabels([thor, maya], ['BTC'])).toEqual([CHAINFLIP_LABEL])
    })
  })
})
