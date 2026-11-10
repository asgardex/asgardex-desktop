import { AnyAsset, AssetType, Chain } from '@xchainjs/xchain-util'

import { MAYAChain, THORChain } from '../../shared/utils/chainIds'
import { getThorchainMimirHalt } from '../hooks/useMimirHalt'
import { getMayachainMimirHalt } from '../hooks/useMimirHaltMaya'
import { getPoolStatus, isAddDisabled, isSwapDisabled, PoolHaltData } from './poolStatusHelper'

const asset = (chain: string, symbol: string, ticker = symbol.split('-')[0]): AnyAsset => ({
  chain,
  symbol,
  ticker,
  type: AssetType.NATIVE
})

const BTC = asset('BTC', 'BTC')
const SOL = asset('SOL', 'SOL')
const USDC_ETH = asset('ETH', 'USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48')
const USDT_ETH = asset('ETH', 'USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7')

// Same path as `usePoolStatus`: raw mimir -> shared `getThorchainMimirHalt` / `getMayachainMimirHalt` -> MimirHalt
const thor = (
  { chain }: AnyAsset,
  mimir: Record<string, number> = {},
  {
    lastHeight = 100,
    haltedChains = [],
    pausedLpChains = []
  }: Partial<{ lastHeight: number; haltedChains: Chain[]; pausedLpChains: Chain[] }> = {}
): PoolHaltData => ({
  protocol: THORChain,
  mimirHalt: getThorchainMimirHalt({ mimir, lastHeight, chains: [chain] }),
  haltedChains,
  pausedLpChains
})
const maya = (
  { chain }: AnyAsset,
  mimir: Record<string, number> = {},
  {
    lastHeight = 100,
    haltedChains = [],
    pausedLpChains = []
  }: Partial<{ lastHeight: number; haltedChains: Chain[]; pausedLpChains: Chain[] }> = {}
): PoolHaltData => ({
  protocol: MAYAChain,
  mimirHalt: getMayachainMimirHalt({ mimir, lastHeight, chains: [chain] }),
  haltedChains,
  pausedLpChains
})

const kindOf = (a: AnyAsset, data: PoolHaltData | undefined) => getPoolStatus(a, data)?.kind

describe('helpers/poolStatusHelper', () => {
  describe('getPoolStatus (THORChain)', () => {
    it('no status without halts or pauses', () => {
      expect(getPoolStatus(BTC, thor(BTC))).toBeUndefined()
    })

    it('unknown (fail closed) without halt data', () => {
      expect(getPoolStatus(BTC, undefined)).toEqual({ kind: 'unknown' })
    })

    it('chain halt: HALT{CHAIN}CHAIN and HALTTHORCHAIN', () => {
      expect(kindOf(BTC, thor(BTC, { HALTBTCCHAIN: 1 }))).toBe('chain')
      expect(kindOf(BTC, thor(BTC, { HALTTHORCHAIN: 1 }))).toBe('chain')
    })

    it('trading halt: HALT{CHAIN}TRADING and HALTTRADING, before an inbound halt', () => {
      expect(kindOf(SOL, thor(SOL, { HALTSOLTRADING: 1 }))).toBe('trading')
      expect(kindOf(BTC, thor(BTC, { HALTTRADING: 1 }))).toBe('trading')
      // `inbound_addresses` marks trading halted chains as `halted`, too
      expect(kindOf(SOL, thor(SOL, { HALTSOLTRADING: 1 }, { haltedChains: ['SOL'] }))).toBe('trading')
    })

    it('inbound halt without mimir: chain', () => {
      expect(kindOf(SOL, thor(SOL, {}, { haltedChains: ['SOL'] }))).toBe('chain')
    })

    it('chain halt wins over trading halt and pauses', () => {
      expect(kindOf(BTC, thor(BTC, { HALTBTCCHAIN: 1, HALTBTCTRADING: 1, PAUSELPBTC: 1 }))).toBe('chain')
    })

    it('LP pause: PAUSELP{CHAIN}, PAUSELP and inbound chain_lp_actions_paused', () => {
      expect(kindOf(BTC, thor(BTC, { PAUSELPBTC: 1 }))).toBe('lp')
      expect(kindOf(BTC, thor(BTC, { PAUSELP: 1 }))).toBe('lp')
      expect(kindOf(BTC, thor(BTC, {}, { pausedLpChains: ['BTC'] }))).toBe('lp')
    })

    it('deposit pause is per pool, not per chain', () => {
      const mimir = { 'PAUSELPDEPOSIT-ETH-USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': 1 }
      expect(kindOf(USDC_ETH, thor(USDC_ETH, mimir))).toBe('deposit')
      expect(kindOf(USDT_ETH, thor(USDT_ETH, mimir))).toBeUndefined()
      expect(kindOf(BTC, thor(BTC, { 'PAUSELPDEPOSIT-BTC-BTC': 1 }))).toBe('deposit')
    })

    it('scheduled halts (height not reached) are ignored', () => {
      expect(getPoolStatus(BTC, thor(BTC, { HALTBTCCHAIN: 101, HALTBTCTRADING: 200, PAUSELPBTC: 101 }))).toBeUndefined()
    })
  })

  describe('getPoolStatus (MAYAChain)', () => {
    it('uses MAYA keys and height rule (value < height)', () => {
      expect(kindOf(BTC, maya(BTC, { HALTMAYACHAIN: 1 }))).toBe('chain')
      expect(kindOf(BTC, maya(BTC, { HALTTHORCHAIN: 1 }))).toBeUndefined()
      expect(kindOf(BTC, maya(BTC, { HALTBTCCHAIN: 100 }))).toBeUndefined()
      expect(kindOf(BTC, maya(BTC, { HALTBTCCHAIN: 99 }))).toBe('chain')
    })

    it('LP pause and inbound halt', () => {
      expect(kindOf(BTC, maya(BTC, { PAUSELPBTC: 1 }))).toBe('lp')
      expect(kindOf(BTC, maya(BTC, {}, { haltedChains: ['BTC'] }))).toBe('chain')
      expect(kindOf(BTC, maya(BTC, {}, { pausedLpChains: ['BTC'] }))).toBe('lp')
    })
  })

  describe('isSwapDisabled / isAddDisabled', () => {
    it('chain, trading and unknown disable swap and add', () => {
      for (const kind of ['chain', 'trading', 'unknown'] as const) {
        expect(isSwapDisabled({ kind })).toBe(true)
        expect(isAddDisabled({ kind })).toBe(true)
      }
    })

    it('lp and deposit pauses disable add only', () => {
      for (const kind of ['lp', 'deposit'] as const) {
        expect(isSwapDisabled({ kind })).toBe(false)
        expect(isAddDisabled({ kind })).toBe(true)
      }
    })

    it('no status: nothing disabled', () => {
      expect(isSwapDisabled(undefined)).toBe(false)
      expect(isAddDisabled(undefined)).toBe(false)
    })
  })
})
