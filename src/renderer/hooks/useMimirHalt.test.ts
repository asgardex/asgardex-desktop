import { DEFAULT_ENABLED_CHAINS } from '../../shared/utils/chain'
import { BTCChain, THORChain } from '../../shared/utils/chainIds'
import { disableAllActions } from '../helpers/poolHelper'
import { DEFAULT_MIMIR_HALT } from '../services/thorchain/const'
import { isProtocolGloballyHalted } from '../views/app/AppHaltedChains.helpers'
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
    it('mimir = 100, blockheight = 100', () => {
      expect(getMimirStatus(100, 100)).toBeFalsy()
    })
    it('mimir = 101, blockheight = 100', () => {
      expect(getMimirStatus(101, 100)).toBeFalsy()
    })
    it('mimir = 10, blockheight = 0', () => {
      expect(getMimirStatus(10, 0)).toBeFalsy()
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

    it('detects lower-case chain halt keys', () => {
      const result = getThorchainMimirHalt({ mimir: { haltethchain: 1 }, lastHeight: 100, chains })
      expect(result.HALTETHCHAIN).toBe(true)
      expect(result.HALTBTCCHAIN).toBe(false)
    })

    it('detects mixed-case chain halt keys', () => {
      const result = getThorchainMimirHalt({ mimir: { HALTBTCChain: 1, HaltEthChain: 1 }, lastHeight: 100, chains })
      expect(result.HALTBTCCHAIN).toBe(true)
      expect(result.HALTETHCHAIN).toBe(true)
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

    it('per-chain trading and LP pause flags (any case)', () => {
      const result = getThorchainMimirHalt({
        mimir: { HALTBTCTRADING: 1, pauselpeth: 1, 'PauseLpDeposit-btc-btc': 1 },
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

    it('global HALTTRADING and PAUSELP flags (any case)', () => {
      expect(getThorchainMimirHalt({ mimir: { HALTTRADING: 1 }, lastHeight: 100, chains }).haltGlobalTrading).toBe(true)
      expect(getThorchainMimirHalt({ mimir: { pauselp: 1 }, lastHeight: 100, chains }).pauseGlobalLp).toBe(true)
      const none = getThorchainMimirHalt({ mimir: {}, lastHeight: 100, chains })
      expect(none.haltGlobalTrading).toBe(false)
      expect(none.pauseGlobalLp).toBe(false)
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
})
