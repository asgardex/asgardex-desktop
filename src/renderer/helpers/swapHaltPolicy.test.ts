// Unknown status alone does not block swaps or withdrawals; proven halts still apply.
// Deposits and RUNE sends remain fail-closed while their status is unknown.
import * as RD from '@devexperts/remote-data-ts'
import { assetFromStringEx, Chain } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'
import { describe, expect, it } from 'vitest'

import { BTCChain, ETHChain } from '../../shared/utils/chainIds'
import { getSharedThorchainMimirHalt$, getThorchainMimirHalt } from '../hooks/useMimirHalt'
import { getSharedMayachainMimirHalt$, getMayachainMimirHalt } from '../hooks/useMimirHaltMaya'
import {
  DEFAULT_MIMIR_HALT as DEFAULT_MIMIR_HALT_MAYA,
  UNKNOWN_MIMIR_HALT as UNKNOWN_MIMIR_HALT_MAYA
} from '../services/mayachain/const'
import { DEFAULT_MIMIR_HALT, UNKNOWN_MIMIR_HALT } from '../services/thorchain/const'
import { isRuneSendDisabled, isWithdrawDisabled, resolveHaltState, resolveSwapHaltState } from './haltedChains'
import * as PoolHelpers from './poolHelper'
import * as PoolHelpersMaya from './poolHelperMaya'
import { filterQuotableProtocols, isSwapDisabledForChains } from './protocolTradingHalt'

const BTC = assetFromStringEx('BTC.BTC')
const ETH = assetFromStringEx('ETH.ETH')
const ALL = ['Thorchain', 'Mayachain', 'Chainflip', 'OneClick'] as const

const failed = RD.failure(Error('inbound_addresses down')) as RD.RemoteData<Error, Chain[]>
const unknownInbound: Array<[string, RD.RemoteData<Error, Chain[]>]> = [
  ['failure', failed],
  ['pending', RD.pending],
  ['initial', RD.initial]
]
const loaded = (chains: Chain[]) => RD.success(chains) as RD.RemoteData<Error, Chain[]>

const thorKnown = (mimir: Record<string, number>) =>
  getThorchainMimirHalt({ mimir, lastHeight: 100, chains: [BTCChain, ETHChain, 'THOR'] })
const mayaKnown = (mimir: Record<string, number>) =>
  getMayachainMimirHalt({ mimir, lastHeight: 100, chains: [BTCChain, ETHChain, 'MAYA'] })

// `confirmedMimirHalt` of the hooks while mimir is unknown / stale: no proven halt, status unknown
const NO_PROVEN_HALT = { ...DEFAULT_MIMIR_HALT, haltStatusUnknown: true }
const NO_PROVEN_HALT_MAYA = { ...DEFAULT_MIMIR_HALT_MAYA, haltStatusUnknown: true }

const swapState = (
  thor: { inbound: RD.RemoteData<Error, Chain[]>; mimir: typeof DEFAULT_MIMIR_HALT },
  maya: { inbound: RD.RemoteData<Error, Chain[]>; mimir: typeof DEFAULT_MIMIR_HALT_MAYA }
) => ({
  thor: resolveSwapHaltState(thor.inbound, thor.mimir),
  maya: resolveSwapHaltState(maya.inbound, maya.mimir)
})

describe('swap halt policy: unknown status alone does not block swaps', () => {
  it.each(unknownInbound)(
    'mimir unknown + inbound %s: THOR and MAYA stay quotable, the swap is not disabled',
    (_, inbound) => {
      const state = swapState({ inbound, mimir: NO_PROVEN_HALT }, { inbound, mimir: NO_PROVEN_HALT_MAYA })
      expect(filterQuotableProtocols([...ALL], BTC, ETH, state)).toEqual([...ALL])
      expect(isSwapDisabledForChains({ protocol: 'Thorchain', chains: [BTCChain, ETHChain], ...state.thor })).toBe(
        false
      )
      expect(isSwapDisabledForChains({ protocol: 'Mayachain', chains: [BTCChain, ETHChain], ...state.maya })).toBe(
        false
      )
    }
  )

  it('known mimir with nothing halted + inbound unknown: quotable', () => {
    const state = swapState({ inbound: failed, mimir: thorKnown({}) }, { inbound: failed, mimir: mayaKnown({}) })
    expect(filterQuotableProtocols([...ALL], BTC, ETH, state)).toEqual([...ALL])
  })
})

describe('swap halt policy: known halts still block, next to an unknown signal', () => {
  it.each([['HALTBTCTRADING'], ['HALTBTCCHAIN'], ['HALTTRADING'], ['HALTTHORCHAIN'], ['HALTCHAINGLOBAL']])(
    'THOR mimir %s loaded + inbound unknown: THOR dropped from the quote, swap disabled',
    (key) => {
      const state = swapState(
        { inbound: failed, mimir: thorKnown({ [key]: 1 }) },
        { inbound: failed, mimir: NO_PROVEN_HALT_MAYA }
      )
      expect(filterQuotableProtocols([...ALL], BTC, ETH, state)).toEqual(['Mayachain', 'Chainflip', 'OneClick'])
      expect(isSwapDisabledForChains({ protocol: 'Thorchain', chains: [BTCChain, ETHChain], ...state.thor })).toBe(true)
    }
  )

  it.each([['HALTBTCTRADING'], ['HALTBTCCHAIN'], ['HALTTRADING'], ['HALTMAYACHAIN']])(
    'MAYA mimir %s loaded + inbound unknown: MAYA dropped from the quote, swap disabled',
    (key) => {
      const state = swapState(
        { inbound: RD.pending, mimir: NO_PROVEN_HALT },
        { inbound: RD.pending, mimir: mayaKnown({ [key]: 1 }) }
      )
      expect(filterQuotableProtocols([...ALL], BTC, ETH, state)).toEqual(['Thorchain', 'Chainflip', 'OneClick'])
      expect(isSwapDisabledForChains({ protocol: 'Mayachain', chains: [BTCChain, ETHChain], ...state.maya })).toBe(true)
    }
  )

  it('inbound loaded with a halted chain + mimir unknown: that protocol is dropped / disabled', () => {
    const state = swapState(
      { inbound: loaded([ETHChain]), mimir: NO_PROVEN_HALT },
      { inbound: loaded([BTCChain]), mimir: NO_PROVEN_HALT_MAYA }
    )
    expect(filterQuotableProtocols([...ALL], BTC, ETH, state)).toEqual(['Chainflip', 'OneClick'])
    expect(isSwapDisabledForChains({ protocol: 'Thorchain', chains: [BTCChain, ETHChain], ...state.thor })).toBe(true)
    expect(isSwapDisabledForChains({ protocol: 'Mayachain', chains: [BTCChain, ETHChain], ...state.maya })).toBe(true)
  })

  it('TCY trading halt (known) still drops THOR for a TCY pair while inbound is unknown', () => {
    const tcy = assetFromStringEx('THOR.TCY')
    const state = swapState(
      { inbound: failed, mimir: thorKnown({ HALTTCYTRADING: 1 }) },
      { inbound: failed, mimir: DEFAULT_MIMIR_HALT_MAYA }
    )
    expect(filterQuotableProtocols(['Thorchain'], tcy, BTC, state)).toEqual([])
  })
})

const withdrawalHalts = (mimirRD: RD.RemoteData<Error, Record<string, number>>) => ({
  thor: getSharedThorchainMimirHalt$(
    Rx.of(mimirRD),
    Rx.of(RD.success([{ chain: BTCChain, thorchain: 100, last_observed_in: 100, last_signed_out: 100 }]))
  ).withdrawMimirHalt$,
  maya: getSharedMayachainMimirHalt$(
    Rx.of(mimirRD),
    Rx.of(RD.success([{ chain: BTCChain, mayachain: 100, last_observed_in: 100, last_signed_out: 100 }]))
  ).withdrawMimirHalt$
})

describe('unknown status blocks deposits and RUNE sends, not withdrawals', () => {
  it.each(unknownInbound)('THOR inbound %s: withdraw remains allowed', async (_, inbound) => {
    const { haltedChains, mimirHalt } = resolveHaltState(inbound, thorKnown({}), UNKNOWN_MIMIR_HALT)
    expect(PoolHelpers.disablePoolActions({ asset: BTC, haltedChains, mimirHalt })).toBe(true)
    expect(PoolHelpers.disableAllActions({ chain: BTCChain, haltedChains, mimirHalt })).toBe(true)
    expect(isRuneSendDisabled(mimirHalt)).toBe(true)
    const confirmedMimirHalt = await Rx.firstValueFrom(withdrawalHalts(RD.success({})).thor)
    expect(isWithdrawDisabled({ chain: BTCChain, protocol: 'THOR', confirmedMimirHalt })).toBe(false)
  })

  it('THOR mimir unknown: withdraw remains allowed while deposits and RUNE sends block', async () => {
    const { haltedChains, mimirHalt } = resolveHaltState(loaded([]), UNKNOWN_MIMIR_HALT, UNKNOWN_MIMIR_HALT)
    expect(PoolHelpers.disablePoolActions({ asset: BTC, haltedChains, mimirHalt })).toBe(true)
    expect(isRuneSendDisabled(mimirHalt)).toBe(true)
    const confirmedMimirHalt = await Rx.firstValueFrom(withdrawalHalts(RD.failure(Error('mimir down'))).thor)
    expect(isWithdrawDisabled({ chain: BTCChain, protocol: 'THOR', confirmedMimirHalt })).toBe(false)
  })

  it.each(unknownInbound)('MAYA inbound %s: deposits block but withdraw remains allowed', async (_, inbound) => {
    const { haltedChains, mimirHalt } = resolveHaltState(inbound, mayaKnown({}), UNKNOWN_MIMIR_HALT_MAYA)
    expect(PoolHelpersMaya.disablePoolActions({ chain: BTCChain, haltedChains, mimirHalt })).toBe(true)
    const confirmedMimirHalt = await Rx.firstValueFrom(withdrawalHalts(RD.success({})).maya)
    expect(isWithdrawDisabled({ chain: BTCChain, protocol: 'MAYA', confirmedMimirHalt })).toBe(false)
  })

  it('known state, nothing halted: deposits, withdrawals and RUNE sends allowed', async () => {
    const { haltedChains, mimirHalt } = resolveHaltState(loaded([]), thorKnown({}), UNKNOWN_MIMIR_HALT)
    expect(PoolHelpers.disablePoolActions({ asset: BTC, haltedChains, mimirHalt })).toBe(false)
    expect(isRuneSendDisabled(mimirHalt)).toBe(false)
    const confirmedMimirHalt = await Rx.firstValueFrom(withdrawalHalts(RD.success({})).thor)
    expect(isWithdrawDisabled({ chain: BTCChain, protocol: 'THOR', confirmedMimirHalt })).toBe(false)
  })
})

describe('helpers/haltedChains resolveSwapHaltState', () => {
  it('keeps a loaded halted list and the confirmed mimir as they are', () => {
    const mimir = thorKnown({ HALTETHTRADING: 1 })
    expect(resolveSwapHaltState(loaded([BTCChain]), mimir)).toEqual({ haltedChains: [BTCChain], mimirHalt: mimir })
  })

  it('an unknown inbound list adds no halted chain', () => {
    expect(resolveSwapHaltState(failed, NO_PROVEN_HALT)).toEqual({ haltedChains: [], mimirHalt: NO_PROVEN_HALT })
  })

  it('fails closed if given the synthetic UNKNOWN_MIMIR_HALT by mistake (it is not dropped here)', () => {
    const state = swapState(
      { inbound: failed, mimir: UNKNOWN_MIMIR_HALT },
      { inbound: failed, mimir: NO_PROVEN_HALT_MAYA }
    )
    expect(filterQuotableProtocols(['Thorchain'], BTC, ETH, state)).toEqual([])
  })
})
