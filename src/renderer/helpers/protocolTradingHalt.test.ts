import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { assetFromStringEx } from '@xchainjs/xchain-util'
import { describe, expect, it } from 'vitest'

import { DEFAULT_MIMIR_HALT as DEFAULT_MIMIR_HALT_MAYA } from '../services/mayachain/const'
import { DEFAULT_MIMIR_HALT } from '../services/thorchain/const'
import { filterQuotableProtocols, isProtocolTradingHaltedForAssets } from './protocolTradingHalt'

const ethUsdc = assetFromStringEx('ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48')
const solNative = assetFromStringEx('SOL.SOL')

const baseHaltState = {
  thor: { haltedChains: [] as string[], mimirHalt: { ...DEFAULT_MIMIR_HALT } },
  maya: { haltedChains: [] as string[], mimirHalt: { ...DEFAULT_MIMIR_HALT_MAYA } }
}

describe('protocolTradingHalt', () => {
  it('does not filter Chainflip/OneClick when THOR trading is halted', () => {
    const haltState = {
      ...baseHaltState,
      thor: {
        haltedChains: [ETHChain],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, HALTETHTRADING: true }
      }
    }

    expect(isProtocolTradingHaltedForAssets('Thorchain', ethUsdc, solNative, haltState)).toBe(true)
    expect(isProtocolTradingHaltedForAssets('Chainflip', ethUsdc, solNative, haltState)).toBe(false)
    expect(isProtocolTradingHaltedForAssets('OneClick', ethUsdc, solNative, haltState)).toBe(false)

    expect(
      filterQuotableProtocols(['Thorchain', 'Mayachain', 'Chainflip', 'OneClick'], ethUsdc, solNative, haltState)
    ).toEqual(['Mayachain', 'Chainflip', 'OneClick'])
  })

  it('skips Thorchain when destination chain trading is halted on THOR', () => {
    const haltState = {
      ...baseHaltState,
      thor: {
        haltedChains: [],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, HALTSOLTRADING: true }
      }
    }

    expect(isProtocolTradingHaltedForAssets('Thorchain', ethUsdc, solNative, haltState)).toBe(true)
    expect(filterQuotableProtocols(['Thorchain', 'Chainflip'], ethUsdc, solNative, haltState)).toEqual(['Chainflip'])
  })

  it('skips Thorchain when inbound addresses mark source chain halted', () => {
    const haltState = {
      ...baseHaltState,
      thor: {
        haltedChains: [ETHChain],
        mimirHalt: { ...DEFAULT_MIMIR_HALT }
      }
    }

    expect(isProtocolTradingHaltedForAssets('Thorchain', ethUsdc, solNative, haltState)).toBe(true)
  })

  it('skips Thorchain when HALTTHORCHAIN is set', () => {
    const haltState = {
      ...baseHaltState,
      thor: {
        haltedChains: [],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, HALTTHORCHAIN: true }
      }
    }

    expect(isProtocolTradingHaltedForAssets('Thorchain', ethUsdc, solNative, haltState)).toBe(true)
  })

  it('keeps Thorchain when only an unrelated chain is halted', () => {
    const haltState = {
      ...baseHaltState,
      thor: {
        haltedChains: [BTCChain],
        mimirHalt: { ...DEFAULT_MIMIR_HALT, HALTBTCTRADING: true }
      }
    }

    expect(isProtocolTradingHaltedForAssets('Thorchain', ethUsdc, solNative, haltState)).toBe(false)
    expect(filterQuotableProtocols(['Thorchain', 'Chainflip'], ethUsdc, solNative, haltState)).toEqual([
      'Thorchain',
      'Chainflip'
    ])
  })

  it('skips Mayachain when MAYA trading for a pair chain is halted', () => {
    const ethMaya = assetFromStringEx('ETH.ETH')
    const haltState = {
      ...baseHaltState,
      maya: {
        haltedChains: [ETHChain],
        mimirHalt: { ...DEFAULT_MIMIR_HALT_MAYA, HALTETHTRADING: true }
      }
    }

    expect(isProtocolTradingHaltedForAssets('Mayachain', ethMaya, ethMaya, haltState)).toBe(true)
    expect(isProtocolTradingHaltedForAssets('Thorchain', ethMaya, ethMaya, haltState)).toBe(false)
  })
})
