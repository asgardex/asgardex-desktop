// Fixture: __fixtures__/mayanode-mainnet-btc-eth-zec-trading-halted (MAYANode mainnet mimir + lastblock, height 19095919).
// Captured 2026-11-02 05:14:58 UTC (15:44:58 ACDT) from mayanode.mayachain.info/mayachain.
import { DEFAULT_ENABLED_CHAINS } from '../../shared/utils/chain'
import { BTCChain, MAYAChain } from '../../shared/utils/chainIds'
import { disableAllActions } from '../helpers/poolHelperMaya'
import { DEFAULT_MIMIR_HALT } from '../services/mayachain/const'
import { Mimir } from '../services/mayachain/types'
import mayaLastblock from './__fixtures__/mayanode-mainnet-btc-eth-zec-trading-halted/lastblock.json'
import mayaMimir from './__fixtures__/mayanode-mainnet-btc-eth-zec-trading-halted/mimir.json'
import { getMayachainMimirHalt, getMimirStatus } from './useMimirHaltMaya'

describe('hooks/useMimirHaltMaya', () => {
  describe('getMimirStatus (MAYANode rule: value > 0 && value < height)', () => {
    it('mimir = 1', () => {
      expect(getMimirStatus(1)).toBeTruthy()
    })
    it('mimir = 0', () => {
      expect(getMimirStatus(0)).toBeFalsy()
    })
    it('mimir = 99, blockheight = 100', () => {
      expect(getMimirStatus(99, 100)).toBeTruthy()
    })
    it('mimir = 100, blockheight = 100 (not active yet: MAYANode uses `value < height`, unlike THORNode)', () => {
      expect(getMimirStatus(100, 100)).toBeFalsy()
    })
    it('mimir = 101, blockheight = 100', () => {
      expect(getMimirStatus(101, 100)).toBeFalsy()
    })
    it('mimir = -1 (unset), blockheight = 100', () => {
      expect(getMimirStatus(-1, 100)).toBeFalsy()
    })
    it('mimir = undefined + blockheight = undefined', () => {
      expect(getMimirStatus(undefined, undefined)).toBeFalsy()
    })
  })

  describe('getMayachainMimirHalt', () => {
    const chains = ['BTC', 'ETH', 'MAYA']

    it('detects per-chain halt, trading and LP pause keys', () => {
      const result = getMayachainMimirHalt({
        mimir: { HALTBTCCHAIN: 1, HALTETHTRADING: 1, PAUSELPBTC: 1 },
        lastHeight: 100,
        chains
      })
      expect(result.HALTBTCCHAIN).toBe(true)
      expect(result.HALTETHCHAIN).toBe(false)
      expect(result.HALTETHTRADING).toBe(true)
      expect(result.HALTBTCTRADING).toBe(false)
      expect(result.PAUSELPBTC).toBe(true)
      expect(result.PAUSELPETH).toBe(false)
    })

    it('detects HALTMAYACHAIN', () => {
      const result = getMayachainMimirHalt({ mimir: { HALTMAYACHAIN: 1 }, lastHeight: 100, chains })
      expect(result.HALTMAYACHAIN).toBe(true)
    })

    it('detects HALTMAYACHAIN even when MAYA is not in the chain list', () => {
      const result = getMayachainMimirHalt({ mimir: { HALTMAYACHAIN: 1 }, lastHeight: 100, chains: ['BTC'] })
      expect(result.HALTMAYACHAIN).toBe(true)
    })

    it('HALTMAYACHAIN reaches poolHelperMaya disableAllActions when MAYA is not in the chain list', () => {
      const mimirHalt = getMayachainMimirHalt({ mimir: { HALTMAYACHAIN: 1 }, lastHeight: 100, chains: ['BTC'] })
      expect(disableAllActions({ chain: BTCChain, haltedChains: [], mimirHalt })).toBe(true)
      expect(disableAllActions({ chain: MAYAChain, haltedChains: [], mimirHalt })).toBe(true)
    })

    it('global HALTTRADING and PAUSELP flags', () => {
      expect(getMayachainMimirHalt({ mimir: { HALTTRADING: 1 }, lastHeight: 100, chains }).haltGlobalTrading).toBe(true)
      expect(getMayachainMimirHalt({ mimir: { PAUSELP: 1 }, lastHeight: 100, chains }).pauseGlobalLp).toBe(true)
      const none = getMayachainMimirHalt({ mimir: {}, lastHeight: 100, chains })
      expect(Object.values(none).every((v) => v === false)).toBe(true)
    })

    it('returns the same keys as DEFAULT_MIMIR_HALT (the keys the app reads)', () => {
      const result = getMayachainMimirHalt({ mimir: {}, lastHeight: 100, chains: Object.keys(DEFAULT_ENABLED_CHAINS) })
      expect(Object.keys(result).sort()).toEqual(Object.keys(DEFAULT_MIMIR_HALT).sort())
    })
  })

  describe('getMayachainMimirHalt: live mainnet fixture (2 Nov 2026, height 19095919)', () => {
    // Raw MAYANode /mayachain/mimir and /mayachain/lastblock responses, see __fixtures__/.../README.md
    const mimir: Mimir = mayaMimir
    const lastHeight = mayaLastblock.find(({ mayachain }) => mayachain > 0)?.mayachain ?? 0
    const chains = ['DASH', 'BTC', 'ETH', 'THOR', 'MAYA', 'ARB', 'ZEC', 'ADA']

    it('reads the fixture height', () => {
      expect(lastHeight).toBe(19095919)
    })

    it('every key in the raw MAYANode mimir snapshot is upper-case', () => {
      const keys = Object.keys(mayaMimir)
      expect(keys.length).toBeGreaterThan(0)
      expect(keys.filter((key) => key !== key.toUpperCase())).toEqual([])
    })

    it('flags trading halts on BTC, ETH and ZEC only, and no chain halts', () => {
      const result = getMayachainMimirHalt({ mimir, lastHeight, chains })
      const tradingHalted = ['BTC', 'ETH', 'ZEC']
      chains.forEach((c) => {
        expect([c, result[`HALT${c}TRADING` as keyof typeof result]]).toEqual([c, tradingHalted.includes(c)])
        expect([c, result[`HALT${c}CHAIN` as keyof typeof result]]).toEqual([c, false])
      })
    })

    it('MAYAChain itself, global trading and global LP are not halted', () => {
      const result = getMayachainMimirHalt({ mimir, lastHeight, chains })
      expect(result.HALTMAYACHAIN).toBe(false)
      expect(result.haltGlobalTrading).toBe(false)
      expect(result.pauseGlobalLp).toBe(false)
    })

    it('a halt height equal to the current height is scheduled, one block earlier is active', () => {
      const at = getMayachainMimirHalt({ mimir: { ...mimir, HALTDASHCHAIN: lastHeight }, lastHeight, chains })
      expect(at.HALTDASHCHAIN).toBe(false)
      const before = getMayachainMimirHalt({ mimir: { ...mimir, HALTDASHCHAIN: lastHeight - 1 }, lastHeight, chains })
      expect(before.HALTDASHCHAIN).toBe(true)
    })
  })
})
