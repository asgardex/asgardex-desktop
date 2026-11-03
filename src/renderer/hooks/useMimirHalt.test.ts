/* eslint-disable no-console -- tests assert the console.warn on a mimir key casing mismatch */
// Fixture: __fixtures__/thornode-mainnet-chains-halted-lp-paused (THORNode mainnet mimir + lastblock, height 28483475).
// Captured 2026-11-01 03:39:30 UTC (14:09:30 ACDT) from gateway.liquify.com/chain/thorchain_api/thorchain.
import { act, createElement } from 'react'
import * as RD from '@devexperts/remote-data-ts'
import { createRoot } from 'react-dom/client'
import { AnyAsset, assetFromStringEx } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'
import { afterEach, beforeEach, vi } from 'vitest'

import { AssetAVAX } from '../../shared/utils/asset'
import { DEFAULT_ENABLED_CHAINS } from '../../shared/utils/chain'
import { AVAXChain, BTCChain, THORChain } from '../../shared/utils/chainIds'
import { AssetUSDCAVAX } from '../const'
import { resetMimirCasingWarnings } from '../helpers/mimirLookup'
import {
  disableAllActions,
  disablePoolActions,
  disableTradingActions,
  disableWithdrawActions
} from '../helpers/poolHelper'
import { DEFAULT_MIMIR_HALT, UNKNOWN_MIMIR_HALT, getPoolDepositPauseMimirKey } from '../services/thorchain/const'
import { Mimir } from '../services/thorchain/types'
import { isProtocolGloballyHalted } from '../views/app/AppHaltedChains.helpers'
import thorLastblock from './__fixtures__/thornode-mainnet-chains-halted-lp-paused/lastblock.json'
import thorMimir from './__fixtures__/thornode-mainnet-chains-halted-lp-paused/mimir.json'
import { getMimirStatus, getThorchainMimirHalt, useThorchainMimirHalt } from './useMimirHalt'

// Streams of the THORChain services context and stored user chains, set per test
const mockThorchainContext = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('../contexts/ThorchainContext', () => ({
  useThorchainContext: () => mockThorchainContext.value
}))
vi.mock('../services/storage/userChains', () => ({ userChains$: Rx.of(['BTC', 'THOR']) }))

describe('hooks/useMimirHalt', () => {
  describe('getMimirStatus', () => {
    it('mimir = 1', () => {
      expect(getMimirStatus(1)).toBeTruthy()
    })
    it('mimir = 0', () => {
      expect(getMimirStatus(0)).toBeFalsy()
    })
    it('mimir = 99, blockheight = 100', () => {
      expect(getMimirStatus(99, 100)).toBeTruthy()
    })
    it('mimir = 100, blockheight = 100 (halt height reached: active, THORNode `value <= height`)', () => {
      expect(getMimirStatus(100, 100)).toBeTruthy()
    })
    it('mimir = 101, blockheight = 100', () => {
      expect(getMimirStatus(101, 100)).toBeFalsy()
    })
    it('mimir = 10, blockheight = 0', () => {
      expect(getMimirStatus(10, 0)).toBeFalsy()
    })
    it('mimir = -1 (unset), blockheight = 100', () => {
      expect(getMimirStatus(-1, 100)).toBeFalsy()
    })
    it('mimir = undefined + blockheight = undefined', () => {
      expect(getMimirStatus(undefined, undefined)).toBeFalsy()
    })
  })

  describe('getThorchainMimirHalt', () => {
    const chains = ['BTC', 'ETH', 'THOR']

    it('detects upper-case chain halt keys (THORNode format)', () => {
      const result = getThorchainMimirHalt({ mimir: { HALTBTCCHAIN: 1 }, lastHeight: 100, chains })
      expect(result.HALTBTCCHAIN).toBe(true)
      expect(result.HALTETHCHAIN).toBe(false)
    })

    describe('key casing (never fails open)', () => {
      beforeEach(() => {
        resetMimirCasingWarnings()
        vi.spyOn(console, 'warn').mockImplementation(() => {})
      })
      afterEach(() => vi.restoreAllMocks())

      it('matches keys case-insensitively: a halt in another casing still halts', () => {
        const result = getThorchainMimirHalt({
          mimir: { haltethchain: 1, HaltBtcChain: 1, halttrading: 1, pauselp: 1, HaltSolTrading: 1 },
          lastHeight: 100,
          chains: [...chains, 'SOL']
        })
        expect(result.HALTETHCHAIN).toBe(true)
        expect(result.HALTBTCCHAIN).toBe(true)
        expect(result.haltGlobalTrading).toBe(true)
        expect(result.pauseGlobalLp).toBe(true)
        expect(result.HALTSOLTRADING).toBe(true)
      })

      it('a mismatched key reaches the helpers that block actions', () => {
        const mimirHalt = getThorchainMimirHalt({ mimir: { haltthorchain: 1 }, lastHeight: 100, chains })
        expect(disableAllActions({ chain: BTCChain, haltedChains: [], mimirHalt })).toBe(true)
      })

      it('warns about a casing mismatch (once per key), not about exact keys', () => {
        getThorchainMimirHalt({ mimir: { HaltBtcChain: 1, HALTETHCHAIN: 1 }, lastHeight: 100, chains })
        getThorchainMimirHalt({ mimir: { HaltBtcChain: 1, HALTETHCHAIN: 1 }, lastHeight: 101, chains })
        expect(console.warn).toHaveBeenCalledTimes(1)
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"HaltBtcChain"'))
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"HALTBTCCHAIN"'))
      })

      it('does not warn for keys the app does not read', () => {
        getThorchainMimirHalt({ mimir: { SomeOtherKey: 1, HALTBTCCHAIN: 0 }, lastHeight: 100, chains })
        expect(console.warn).not.toHaveBeenCalled()
      })

      it('same key in two casings: the halting one wins', () => {
        const result = getThorchainMimirHalt({
          mimir: { HALTBTCCHAIN: 0, haltbtcchain: 1 },
          lastHeight: 100,
          chains
        })
        expect(result.HALTBTCCHAIN).toBe(true)
      })
    })

    it('every key in the raw THORNode mimir snapshot is upper-case', () => {
      const keys = Object.keys(thorMimir)
      expect(keys.length).toBeGreaterThan(0)
      expect(keys.filter((key) => key !== key.toUpperCase())).toEqual([])
    })

    it('chain halt: height already passed -> halted, height in the future or 0 -> not halted', () => {
      const result = getThorchainMimirHalt({
        mimir: { HALTBTCCHAIN: 99, HALTETHCHAIN: 101, HALTTHORCHAIN: 0 },
        lastHeight: 100,
        chains
      })
      expect(result.HALTBTCCHAIN).toBe(true)
      expect(result.HALTETHCHAIN).toBe(false)
      expect(result.HALTTHORCHAIN).toBe(false)
    })

    it('nothing halted for empty mimir', () => {
      const result = getThorchainMimirHalt({ mimir: {}, lastHeight: 100, chains })
      expect(Object.values(result).every((v) => v === false)).toBe(true)
    })

    it('detects HALTTHORCHAIN', () => {
      const result = getThorchainMimirHalt({ mimir: { HALTTHORCHAIN: 1 }, lastHeight: 100, chains })
      expect(result.HALTTHORCHAIN).toBe(true)
    })

    it('detects HALTTHORCHAIN even when THOR is not in the chain list', () => {
      const result = getThorchainMimirHalt({ mimir: { HALTTHORCHAIN: 1 }, lastHeight: 100, chains: ['BTC'] })
      expect(result.HALTTHORCHAIN).toBe(true)
    })

    it('HALTTHORCHAIN reaches AppHaltedChains isProtocolGloballyHalted', () => {
      const mimirHalt = getThorchainMimirHalt({ mimir: { HALTTHORCHAIN: 1 }, lastHeight: 100, chains })
      expect(isProtocolGloballyHalted({ protocol: THORChain, inboundHaltedChains: [], mimirHalt, midgard: true })).toBe(
        true
      )
    })

    it('per-chain trading and LP pause flags', () => {
      const result = getThorchainMimirHalt({
        mimir: { HALTBTCTRADING: 1, PAUSELPETH: 1, 'PAUSELPDEPOSIT-BTC-BTC': 1 },
        lastHeight: 100,
        chains
      })
      expect(result.HALTBTCTRADING).toBe(true)
      expect(result.HALTETHTRADING).toBe(false)
      expect(result.PAUSELPETH).toBe(true)
      expect(result.PAUSELPBTC).toBe(false)
      expect(result['PAUSELPDEPOSIT-BTC-BTC']).toBe(true)
      expect(result['PAUSELPDEPOSIT-ETH-ETH']).toBe(false)
    })

    it('global HALTTRADING and PAUSELP flags', () => {
      expect(getThorchainMimirHalt({ mimir: { HALTTRADING: 1 }, lastHeight: 100, chains }).haltGlobalTrading).toBe(true)
      expect(getThorchainMimirHalt({ mimir: { PAUSELP: 1 }, lastHeight: 100, chains }).pauseGlobalLp).toBe(true)
      const none = getThorchainMimirHalt({ mimir: {}, lastHeight: 100, chains })
      expect(none.haltGlobalTrading).toBe(false)
      expect(none.pauseGlobalLp).toBe(false)
    })

    it('PAUSELPDEPOSIT is active for any value > 0, a height above the current block too (THORNode IsPoolDepositPaused)', () => {
      const result = getThorchainMimirHalt({
        mimir: { 'PAUSELPDEPOSIT-BTC-BTC': 1100, 'PAUSELPDEPOSIT-ETH-ETH': 0, 'PAUSELPDEPOSIT-BSC-BNB': -1 },
        lastHeight: 100,
        chains: ['BTC', 'ETH', 'BSC']
      })
      expect(result['PAUSELPDEPOSIT-BTC-BTC']).toBe(true)
      expect(result['PAUSELPDEPOSIT-ETH-ETH']).toBe(false)
      expect(result['PAUSELPDEPOSIT-BSC-BNB']).toBe(false)
    })

    it('carries token-pool PAUSELPDEPOSIT keys with value > 0 for the given chains only', () => {
      const result = getThorchainMimirHalt({
        mimir: {
          'PAUSELPDEPOSIT-AVAX-USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7': 1,
          'PAUSELPDEPOSIT-AVAX-USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E': 0,
          'PAUSELPDEPOSIT-ETH-USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': 1
        },
        lastHeight: 100,
        chains: ['AVAX']
      })
      const keys = Object.keys(result).filter((key) => key.startsWith('PAUSELPDEPOSIT-'))
      expect(keys.sort()).toEqual([
        'PAUSELPDEPOSIT-AVAX-AVAX',
        'PAUSELPDEPOSIT-AVAX-USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7'
      ])
      expect(result['PAUSELPDEPOSIT-AVAX-USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7' as keyof typeof result]).toBe(
        true
      )
    })

    it('returns the same keys as DEFAULT_MIMIR_HALT (the keys the app reads)', () => {
      const result = getThorchainMimirHalt({ mimir: {}, lastHeight: 100, chains: Object.keys(DEFAULT_ENABLED_CHAINS) })
      expect(Object.keys(result).sort()).toEqual(Object.keys(DEFAULT_MIMIR_HALT).sort())
    })

    it('a per-chain halt reaches poolHelper disableAllActions without inbound data', () => {
      const mimirHalt = getThorchainMimirHalt({ mimir: { HALTBTCCHAIN: 1 }, lastHeight: 100, chains })
      expect(disableAllActions({ chain: BTCChain, haltedChains: [], mimirHalt })).toBe(true)
    })

    it('mainnet snapshot (31 Oct 2026): GAIA chain halted, SOL and GAIA trading halted, other keys ignored', () => {
      // Trimmed from https://gateway.liquify.com/chain/thorchain_api/thorchain/mimir at height 28468812
      const mimir = {
        HALTTHORCHAIN: 0,
        HALTTRADING: 0,
        PAUSELP: 0,
        HALTCHAINGLOBAL: 0,
        NODEPAUSECHAINGLOBAL: 28050693,
        HALTBTCCHAIN: 0,
        HALTBTCHAIN: 0,
        HALTBTCTRADING: 0,
        HALTGAIACHAIN: 1,
        HALTGAIATRADING: 1,
        HALTSIGNINGGAIA: 1,
        HALTSIGNINGSOL: 1,
        HALTSOLTRADING: 1,
        SOLVENCYHALTBTCCHAIN: 0,
        PAUSELPBTC: 0,
        'PAUSELPDEPOSIT-BTC-BTC': 1
      }
      const result = getThorchainMimirHalt({
        mimir,
        lastHeight: 28468812,
        chains: ['BTC', 'GAIA', 'SOL', 'THOR']
      })
      expect(result.HALTGAIACHAIN).toBe(true)
      expect(result.HALTGAIATRADING).toBe(true)
      expect(result.HALTSOLTRADING).toBe(true)
      expect(result.HALTSOLCHAIN).toBe(false)
      expect(result.HALTBTCCHAIN).toBe(false)
      expect(result.HALTBTCTRADING).toBe(false)
      expect(result.PAUSELPBTC).toBe(false)
      expect(result['PAUSELPDEPOSIT-BTC-BTC']).toBe(true)
      expect(result.HALTTHORCHAIN).toBe(false)
      expect(result.haltGlobalTrading).toBe(false)
      expect(result.pauseGlobalLp).toBe(false)
    })
  })

  describe('getThorchainMimirHalt: live mainnet fixture (1 Nov 2026, height 28483475)', () => {
    // Raw THORNode /thorchain/mimir and /thorchain/lastblock responses, see __fixtures__/.../README.md
    const mimir: Mimir = thorMimir
    const lastHeight = thorLastblock.find(({ thorchain }) => thorchain > 0)?.thorchain ?? 0
    const chains = [
      'AVAX',
      'BASE',
      'BCH',
      'BSC',
      'BTC',
      'DOGE',
      'ETH',
      'GAIA',
      'LTC',
      'SOL',
      'TRON',
      'XRP',
      'ZEC',
      'THOR'
    ]
    const chainHalted = ['BCH', 'BSC', 'BTC', 'DOGE', 'ETH', 'GAIA', 'LTC', 'TRON', 'ZEC']
    const tradingHalted = [...chainHalted, 'BASE', 'SOL']

    it('reads the fixture height', () => {
      expect(lastHeight).toBe(28483475)
    })

    it('flags exactly the 9 halted chains (HALT{CHAIN}CHAIN = 1)', () => {
      const result = getThorchainMimirHalt({ mimir, lastHeight, chains })
      chains
        .filter((c) => c !== 'THOR')
        .forEach((c) =>
          expect([c, result[`HALT${c}CHAIN` as keyof typeof result]]).toEqual([c, chainHalted.includes(c)])
        )
    })

    it('flags trading halts on 11 chains, incl. TRON by a passed block height (HALTTRONTRADING = 28476980)', () => {
      const result = getThorchainMimirHalt({ mimir, lastHeight, chains })
      chains
        .filter((c) => c !== 'THOR')
        .forEach((c) =>
          expect([c, result[`HALT${c}TRADING` as keyof typeof result]]).toEqual([c, tradingHalted.includes(c)])
        )
    })

    it('flags the gas-pool deposit pauses by asset symbol, incl. PAUSELPDEPOSIT-BSC-BNB and -GAIA-ATOM = 1', () => {
      const result = getThorchainMimirHalt({ mimir, lastHeight, chains })
      expect(result['PAUSELPDEPOSIT-BSC-BNB']).toBe(true)
      expect(result['PAUSELPDEPOSIT-GAIA-ATOM']).toBe(true)
      const depositPaused = ['AVAX', 'BCH', 'BSC', 'BTC', 'DOGE', 'ETH', 'GAIA', 'LTC']
      chains
        .filter((c) => c !== 'THOR')
        .forEach((c) =>
          expect([c, result[getPoolDepositPauseMimirKey(c) as keyof typeof result]]).toEqual([
            c,
            depositPaused.includes(c)
          ])
        )
    })

    it('AVAX (chain not halted): each pool own deposit pause reaches disablePoolActions', () => {
      const mimirHalt = getThorchainMimirHalt({ mimir, lastHeight, chains })
      const depositDisabled = (asset: AnyAsset) => disablePoolActions({ asset, haltedChains: [], mimirHalt })
      expect(disableAllActions({ chain: AVAXChain, haltedChains: [], mimirHalt })).toBe(false)
      // PAUSELPDEPOSIT-AVAX-USDT-0X97… = 1
      expect(depositDisabled(assetFromStringEx('AVAX.USDT-0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7'))).toBe(true)
      // PAUSELPDEPOSIT-AVAX-USDC-0XB97… = 0
      expect(depositDisabled(AssetUSDCAVAX)).toBe(false)
      // PAUSELPDEPOSIT-AVAX-AVAX = 1
      expect(depositDisabled(AssetAVAX)).toBe(true)
    })

    it('THORChain itself, global trading and global LP are not halted', () => {
      const result = getThorchainMimirHalt({ mimir, lastHeight, chains })
      expect(result.HALTTHORCHAIN).toBe(false)
      expect(result.haltGlobalTrading).toBe(false)
      expect(result.pauseGlobalLp).toBe(false)
    })

    it('a halt height equal to the current height is active, one block later is scheduled', () => {
      const at = getThorchainMimirHalt({
        mimir: { ...mimir, HALTXRPCHAIN: lastHeight, HALTXRPTRADING: lastHeight },
        lastHeight,
        chains
      })
      expect(at.HALTXRPCHAIN).toBe(true)
      expect(at.HALTXRPTRADING).toBe(true)
      const next = getThorchainMimirHalt({
        mimir: { ...mimir, HALTXRPCHAIN: lastHeight + 1, HALTXRPTRADING: lastHeight + 1 },
        lastHeight,
        chains
      })
      expect(next.HALTXRPCHAIN).toBe(false)
      expect(next.HALTXRPTRADING).toBe(false)
    })
  })

  describe('chain-global halts and TCY (THORNode IsChainHalted / IsTCYTradingHalted)', () => {
    const chains = ['BTC', 'ETH', 'THOR']

    it('SOLVENCYHALT{CHAIN}CHAIN halts that chain only', () => {
      const result = getThorchainMimirHalt({ mimir: { SOLVENCYHALTBTCCHAIN: 99 }, lastHeight: 100, chains })
      expect(result.HALTBTCCHAIN).toBe(true)
      expect(result.HALTETHCHAIN).toBe(false)
      expect(result.HALTTHORCHAIN).toBe(false)
    })

    it('SOLVENCYHALT: a scheduled height is not active yet', () => {
      const result = getThorchainMimirHalt({ mimir: { SOLVENCYHALTBTCCHAIN: 101 }, lastHeight: 100, chains })
      expect(result.HALTBTCCHAIN).toBe(false)
    })

    it('HALTCHAINGLOBAL halts every chain, THORChain included (also chains not in the list)', () => {
      const mimirHalt = getThorchainMimirHalt({ mimir: { HALTCHAINGLOBAL: 1 }, lastHeight: 100, chains })
      expect(mimirHalt.HALTBTCCHAIN).toBe(true)
      expect(mimirHalt.HALTETHCHAIN).toBe(true)
      expect(mimirHalt.HALTTHORCHAIN).toBe(true)
      expect(disableAllActions({ chain: 'DOGE', haltedChains: [], mimirHalt })).toBe(true)
      expect(isProtocolGloballyHalted({ protocol: THORChain, inboundHaltedChains: [], mimirHalt, midgard: true })).toBe(
        true
      )
    })

    it('HALTCHAINGLOBAL: a scheduled height is not active yet', () => {
      const result = getThorchainMimirHalt({ mimir: { HALTCHAINGLOBAL: 101 }, lastHeight: 100, chains })
      expect(result.HALTBTCCHAIN).toBe(false)
      expect(result.HALTTHORCHAIN).toBe(false)
    })

    it('NODEPAUSECHAINGLOBAL pauses until its height: active up to and including it (THORNode `value >= height`)', () => {
      const pause = (value: number) =>
        getThorchainMimirHalt({ mimir: { NODEPAUSECHAINGLOBAL: value }, lastHeight: 100, chains })
      expect(pause(101).HALTBTCCHAIN).toBe(true)
      expect(pause(100).HALTBTCCHAIN).toBe(true)
      expect(pause(100).HALTTHORCHAIN).toBe(true)
      expect(pause(99).HALTBTCCHAIN).toBe(false)
      expect(pause(0).HALTBTCCHAIN).toBe(false)
    })

    it('NODEPAUSECHAINGLOBAL is not applied without a height', () => {
      const result = getThorchainMimirHalt({ mimir: { NODEPAUSECHAINGLOBAL: 100 }, chains })
      expect(result.HALTBTCCHAIN).toBe(false)
    })

    it('HALTTCYTRADING', () => {
      expect(getThorchainMimirHalt({ mimir: { HALTTCYTRADING: 1 }, lastHeight: 100, chains }).HALTTCYTRADING).toBe(true)
      expect(getThorchainMimirHalt({ mimir: { HALTTCYTRADING: 101 }, lastHeight: 100, chains }).HALTTCYTRADING).toBe(
        false
      )
      expect(getThorchainMimirHalt({ mimir: {}, lastHeight: 100, chains }).HALTTCYTRADING).toBe(false)
    })

    it('live fixture: no chain-global halt, expired nothing', () => {
      const result = getThorchainMimirHalt({ mimir: thorMimir, lastHeight: 28483475, chains })
      expect(result.HALTTHORCHAIN).toBe(false)
      expect(result.HALTTCYTRADING).toBe(false)
    })
  })

  describe('DEFAULT / UNKNOWN_MIMIR_HALT', () => {
    it('unknown halt has every key of the default set, all true, and blocks all actions', () => {
      expect(Object.keys(UNKNOWN_MIMIR_HALT).sort()).toEqual(Object.keys(DEFAULT_MIMIR_HALT).sort())
      expect(Object.values(UNKNOWN_MIMIR_HALT).every((v) => v === true)).toBe(true)
      expect(DEFAULT_MIMIR_HALT.haltStatusUnknown).toBe(false)
      Object.keys(DEFAULT_ENABLED_CHAINS).forEach((chain) => {
        const args = { chain, haltedChains: [], mimirHalt: UNKNOWN_MIMIR_HALT }
        expect([chain, disableAllActions(args)]).toEqual([chain, true])
        expect([chain, disableTradingActions(args)]).toEqual([chain, true])
        expect([chain, disablePoolActions(args)]).toEqual([chain, true])
        expect([chain, disableWithdrawActions(args)]).toEqual([chain, true])
      })
    })

    it('unknown halt blocks a chain that is not in the default chain list', () => {
      const args = { chain: 'NOTACHAIN', haltedChains: [], mimirHalt: UNKNOWN_MIMIR_HALT }
      expect(disableAllActions(args)).toBe(true)
      expect(disableTradingActions(args)).toBe(true)
      expect(disablePoolActions(args)).toBe(true)
      expect(disableWithdrawActions(args)).toBe(true)
    })
  })

  describe('useThorchainMimirHalt: halt status unknown (fail closed)', () => {
    const renderHook = (enabled = true) => {
      let result: ReturnType<typeof useThorchainMimirHalt> | undefined
      const Probe = () => {
        result = useThorchainMimirHalt(enabled)
        return null
      }
      ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
      const root = createRoot(document.createElement('div'))
      act(() => root.render(createElement(Probe)))
      const unmount = () => act(() => root.unmount())
      return { get: () => result as NonNullable<typeof result>, unmount }
    }
    const lastblock = (thorchain: number) => RD.success([{ chain: 'BTC', thorchain }])

    it('mimir request failed -> unknown halt, never "no halt"', () => {
      mockThorchainContext.value = {
        mimir$: Rx.of(RD.failure(Error('mimir down'))),
        thorchainLastblockState$: Rx.of(lastblock(100))
      }
      const { get, unmount } = renderHook()
      expect(RD.isFailure(get().mimirHaltRD)).toBe(true)
      expect(get().mimirHalt).toBe(UNKNOWN_MIMIR_HALT)
      expect(get().mimirHalt.haltStatusUnknown).toBe(true)
      expect(disableAllActions({ chain: BTCChain, haltedChains: [], mimirHalt: get().mimirHalt })).toBe(true)
      expect(disableTradingActions({ chain: BTCChain, haltedChains: [], mimirHalt: get().mimirHalt })).toBe(true)
      unmount()
    })

    it('lastblock request failed -> unknown halt', () => {
      mockThorchainContext.value = {
        mimir$: Rx.of(RD.success({})),
        thorchainLastblockState$: Rx.of(RD.failure(Error('lastblock down')))
      }
      const { get, unmount } = renderHook()
      expect(get().mimirHalt.haltStatusUnknown).toBe(true)
      unmount()
    })

    it('lastblock without a THORChain height -> unknown halt', () => {
      mockThorchainContext.value = {
        mimir$: Rx.of(RD.success({})),
        thorchainLastblockState$: Rx.of(lastblock(0))
      }
      const { get, unmount } = renderHook()
      expect(get().mimirHalt.haltStatusUnknown).toBe(true)
      unmount()
    })

    it('still loading (no value yet) -> unknown halt', () => {
      mockThorchainContext.value = { mimir$: Rx.of(RD.pending), thorchainLastblockState$: Rx.of(lastblock(100)) }
      const { get, unmount } = renderHook()
      expect(get().mimirHalt.haltStatusUnknown).toBe(true)
      unmount()
    })

    it('loaded mimir with no halts -> known, nothing blocked', () => {
      mockThorchainContext.value = { mimir$: Rx.of(RD.success({})), thorchainLastblockState$: Rx.of(lastblock(100)) }
      const { get, unmount } = renderHook()
      expect(get().mimirHalt.haltStatusUnknown).toBe(false)
      expect(disableAllActions({ chain: BTCChain, haltedChains: [], mimirHalt: get().mimirHalt })).toBe(false)
      unmount()
    })

    it('loaded mimir with HALTCHAINGLOBAL halts, and is known', () => {
      mockThorchainContext.value = {
        mimir$: Rx.of(RD.success({ HALTCHAINGLOBAL: 1 })),
        thorchainLastblockState$: Rx.of(lastblock(100))
      }
      const { get, unmount } = renderHook()
      expect(get().mimirHalt.haltStatusUnknown).toBe(false)
      expect(get().mimirHalt.HALTTHORCHAIN).toBe(true)
      unmount()
    })

    it('disabled hook keeps the default (it opted out of the halt status)', () => {
      mockThorchainContext.value = { mimir$: Rx.of(RD.pending), thorchainLastblockState$: Rx.of(lastblock(100)) }
      const { get, unmount } = renderHook(false)
      expect(get().mimirHalt).toBe(DEFAULT_MIMIR_HALT)
      unmount()
    })
  })
})
