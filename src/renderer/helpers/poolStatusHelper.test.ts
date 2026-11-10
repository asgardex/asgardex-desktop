import { AnyAsset, AssetType } from '@xchainjs/xchain-util'

import { MAYAChain, THORChain } from '../../shared/utils/chainIds'
import {
  getPoolDepositPauseKey,
  getPoolStatus,
  isAddDisabled,
  isSwapDisabled,
  PoolStatusParams
} from './poolStatusHelper'

const asset = (chain: string, symbol: string, ticker = symbol.split('-')[0]): AnyAsset => ({
  chain,
  symbol,
  ticker,
  type: AssetType.NATIVE
})

const BTC = asset('BTC', 'BTC')
const USDC_ETH = asset('ETH', 'USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48')
const USDT_ETH = asset('ETH', 'USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7')

const params = (overrides: Partial<PoolStatusParams> = {}): PoolStatusParams => ({
  asset: BTC,
  protocol: THORChain,
  mimir: {},
  lastHeight: 100,
  haltedChains: [],
  pausedLpChains: [],
  ...overrides
})

describe('helpers/poolStatusHelper', () => {
  describe('getPoolDepositPauseKey', () => {
    it('uses chain and symbol in upper case', () => {
      expect(getPoolDepositPauseKey(asset('eth', 'usdc-0xa0b8'))).toBe('PAUSELPDEPOSIT-ETH-USDC-0XA0B8')
    })
  })

  describe('getPoolStatus', () => {
    it('returns undefined for an unlimited pool', () => {
      expect(getPoolStatus(params())).toBeUndefined()
    })

    it('chain halt by mimir', () => {
      expect(getPoolStatus(params({ mimir: { HALTBTCCHAIN: 1 } }))?.kind).toBe('chain')
    })

    it('global THORChain halt applies to all pools', () => {
      expect(getPoolStatus(params({ asset: USDC_ETH, mimir: { HALTTHORCHAIN: 1 } }))?.kind).toBe('chain')
    })

    it('global MAYAChain halt applies to MAYAChain pools only', () => {
      expect(getPoolStatus(params({ protocol: MAYAChain, mimir: { HALTMAYACHAIN: 1 } }))?.kind).toBe('chain')
      expect(getPoolStatus(params({ protocol: THORChain, mimir: { HALTMAYACHAIN: 1 } }))).toBeUndefined()
    })

    it('trading halt by chain or global mimir', () => {
      expect(getPoolStatus(params({ mimir: { HALTBTCTRADING: 1 } }))?.kind).toBe('trading')
      expect(getPoolStatus(params({ mimir: { HALTTRADING: 1 } }))?.kind).toBe('trading')
    })

    it('a trading halt wins over `inbound_addresses.halted` (set by trading halts, too)', () => {
      expect(getPoolStatus(params({ mimir: { HALTBTCTRADING: 1 }, haltedChains: ['BTC'] }))?.kind).toBe('trading')
    })

    it('`inbound_addresses.halted` without a mimir trading halt is a chain halt', () => {
      expect(getPoolStatus(params({ haltedChains: ['BTC'] }))?.kind).toBe('chain')
    })

    it('LP pause by chain mimir, global mimir or `inbound_addresses`', () => {
      expect(getPoolStatus(params({ mimir: { PAUSELPBTC: 1 } }))?.kind).toBe('lp')
      expect(getPoolStatus(params({ mimir: { PAUSELP: 1 } }))?.kind).toBe('lp')
      expect(getPoolStatus(params({ pausedLpChains: ['BTC'] }))?.kind).toBe('lp')
    })

    it('deposit pause applies to its own pool only', () => {
      const mimir = { 'PAUSELPDEPOSIT-ETH-USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': 1 }
      expect(getPoolStatus(params({ asset: USDC_ETH, mimir }))?.kind).toBe('deposit')
      expect(getPoolStatus(params({ asset: USDT_ETH, mimir }))).toBeUndefined()
    })

    it('deposit pause is active for any value > 0 (no height check)', () => {
      expect(getPoolStatus(params({ mimir: { 'PAUSELPDEPOSIT-BTC-BTC': 1000 }, lastHeight: 1 }))?.kind).toBe('deposit')
    })

    it('most severe status wins', () => {
      const mimir = { HALTBTCCHAIN: 1, HALTBTCTRADING: 1, PAUSELPBTC: 1, 'PAUSELPDEPOSIT-BTC-BTC': 1 }
      expect(getPoolStatus(params({ mimir }))?.kind).toBe('chain')
    })

    it('mimir set as block height: THORNode activates at `value <= height`', () => {
      expect(getPoolStatus(params({ mimir: { HALTBTCCHAIN: 100 }, lastHeight: 99 }))).toBeUndefined()
      expect(getPoolStatus(params({ mimir: { HALTBTCCHAIN: 100 }, lastHeight: 100 }))?.kind).toBe('chain')
    })

    it('mimir set as block height: MAYANode activates at `value < height`', () => {
      const maya = { protocol: MAYAChain, mimir: { HALTBTCCHAIN: 100 } }
      expect(getPoolStatus(params({ ...maya, lastHeight: 100 }))).toBeUndefined()
      expect(getPoolStatus(params({ ...maya, lastHeight: 101 }))?.kind).toBe('chain')
    })

    it('flags delayed outbound txs (`HALTSIGNING{CHAIN}`) of a limited pool', () => {
      expect(getPoolStatus(params({ mimir: { 'PAUSELPDEPOSIT-BTC-BTC': 1, HALTSIGNINGBTC: 1 } }))).toEqual({
        kind: 'deposit',
        outboundDelayed: true
      })
      expect(getPoolStatus(params({ mimir: { 'PAUSELPDEPOSIT-BTC-BTC': 1 } }))?.outboundDelayed).toBe(false)
    })

    it('ignores a signing halt of an otherwise unlimited pool', () => {
      expect(getPoolStatus(params({ mimir: { HALTSIGNINGBTC: 1 } }))).toBeUndefined()
    })
  })

  describe('isSwapDisabled / isAddDisabled', () => {
    it.each([
      ['chain', true, true],
      ['trading', true, true],
      ['lp', false, true],
      ['deposit', false, true]
    ] as const)('%s: swap disabled %s, add disabled %s', (kind, swap, add) => {
      const status = { kind, outboundDelayed: false }
      expect(isSwapDisabled(status)).toBe(swap)
      expect(isAddDisabled(status)).toBe(add)
    })

    it('enables all actions for an unlimited pool', () => {
      expect(isSwapDisabled(undefined)).toBe(false)
      expect(isAddDisabled(undefined)).toBe(false)
    })
  })
})
