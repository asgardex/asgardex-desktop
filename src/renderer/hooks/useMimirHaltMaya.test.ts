// Fixture: __fixtures__/mayanode-mainnet-btc-eth-zec-trading-halted (MAYANode mainnet mimir + lastblock, height 19095919).
// Captured 2026-11-02 05:14:58 UTC (15:44:58 ACDT) from mayanode.mayachain.info/mayachain.
import { act, createElement } from 'react'
import * as RD from '@devexperts/remote-data-ts'
import { createRoot } from 'react-dom/client'
import * as Rx from 'rxjs'
import { vi } from 'vitest'

import { SUPPORTED_CHAINS } from '../../shared/utils/chain'
import { BTCChain, MAYAChain } from '../../shared/utils/chainIds'
import { disableAllActions } from '../helpers/poolHelperMaya'
import { DEFAULT_MIMIR_HALT } from '../services/mayachain/const'
import { Mimir } from '../services/mayachain/types'
import mayaLastblock from './__fixtures__/mayanode-mainnet-btc-eth-zec-trading-halted/lastblock.json'
import mayaMimir from './__fixtures__/mayanode-mainnet-btc-eth-zec-trading-halted/mimir.json'
import { getMayachainMimirHalt, getMimirStatus, useMayachainMimirHalt } from './useMimirHaltMaya'

// Mock the MAYAChain services context and stored user chains with successful RemoteData streams,
// so the hook itself can be rendered (same module-mock approach as useRemoteImage.test.ts).
// Streams are created once (stable identity across renders), as the real context provides them.
const mockMayachainContext = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('../contexts/MayachainContext', () => ({
  useMayachainContext: () => mockMayachainContext.value
}))
// Scheduled halt one block above the fixture capture height (19095919). MAYANode activates a halt
// only once `value < height`, so it is scheduled at the halt height and active one block later.
const HALT_HEIGHT = 19095920
const lastblockAt = (mayachain: number) =>
  RD.success([{ chain: 'BTC', last_observed_in: 97412, last_signed_out: 19093802, mayachain }])
// BehaviorSubject (not Rx.of) so the test can emit a later lastblock height after the first render.
const mockLastblock = vi.hoisted(() => ({ subject: undefined as unknown as Rx.BehaviorSubject<unknown> }))
mockLastblock.subject = new Rx.BehaviorSubject<unknown>(lastblockAt(HALT_HEIGHT))
mockMayachainContext.value = {
  mimir$: Rx.of(RD.success({ HALTMAYACHAIN: HALT_HEIGHT })),
  mayachainLastblockState$: mockLastblock.subject
}
vi.mock('../services/storage/userChains', () => ({ userChains$: Rx.of(['BTC', 'MAYA']) }))

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
      const result = getMayachainMimirHalt({ mimir: {}, lastHeight: 100, chains: Object.keys(SUPPORTED_CHAINS) })
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

  describe('useMayachainMimirHalt', () => {
    it('re-publishes mimirHalt when lastblock moves past a scheduled HALTMAYACHAIN height', () => {
      let result: ReturnType<typeof useMayachainMimirHalt> | undefined
      const Probe = () => {
        result = useMayachainMimirHalt()
        return null
      }
      ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
      const root = createRoot(document.createElement('div'))
      act(() => root.render(createElement(Probe)))
      // lastblock at the halt height: scheduled, not active yet
      expect(RD.isSuccess(result!.mimirHaltRD)).toBe(true)
      expect(result?.mimirHalt.HALTMAYACHAIN).toBe(false)
      // a later lastblock height: the halt is now active and the hook publishes it
      act(() => mockLastblock.subject.next(lastblockAt(HALT_HEIGHT + 1)))
      expect(result?.mimirHalt.HALTMAYACHAIN).toBe(true)
      act(() => root.unmount())
    })
  })
})
