// Fixture: __fixtures__/thornode-mainnet-chains-halted-lp-paused (THORNode mainnet mimir + lastblock, height 28483475).
// Captured 2026-11-01 03:39:30 UTC (14:09:30 ACDT) from gateway.liquify.com/chain/thorchain_api/thorchain.
import { DEFAULT_ENABLED_CHAINS } from '../../shared/utils/chain'
import { BTCChain, THORChain } from '../../shared/utils/chainIds'
import { disableAllActions } from '../helpers/poolHelper'
import { DEFAULT_MIMIR_HALT, getPoolDepositPauseMimirKey } from '../services/thorchain/const'
import { Mimir } from '../services/thorchain/types'
import { isProtocolGloballyHalted } from '../views/app/AppHaltedChains.helpers'
import thorLastblock from './__fixtures__/thornode-mainnet-chains-halted-lp-paused/lastblock.json'
import thorMimir from './__fixtures__/thornode-mainnet-chains-halted-lp-paused/mimir.json'
import { getMimirStatus, getThorchainMimirHalt } from './useMimirHalt'

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

    it('reads mimir keys exactly as THORNode sends them (upper-case); other casing is ignored', () => {
      const result = getThorchainMimirHalt({
        mimir: { haltethchain: 1, HaltBtcChain: 1, halttrading: 1, pauselp: 1 },
        lastHeight: 100,
        chains
      })
      expect(result.HALTETHCHAIN).toBe(false)
      expect(result.HALTBTCCHAIN).toBe(false)
      expect(result.haltGlobalTrading).toBe(false)
      expect(result.pauseGlobalLp).toBe(false)
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
})
