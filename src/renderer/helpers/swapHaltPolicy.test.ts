// Policy (X, 10 Nov 2026): an *unknown* halt status alone does not block swaps or quote requests, the node
// quote decides. Known halts still block swaps. Liquidity actions and RUNE sends stay blocked while unknown.
import * as RD from '@devexperts/remote-data-ts'
import { assetFromStringEx, Chain } from '@xchainjs/xchain-util'
import { describe, expect, it } from 'vitest'

import { BTCChain, ETHChain } from '../../shared/utils/chainIds'
import { getThorchainMimirHalt } from '../hooks/useMimirHalt'
import { getMayachainMimirHalt } from '../hooks/useMimirHaltMaya'
import {
  DEFAULT_MIMIR_HALT as DEFAULT_MIMIR_HALT_MAYA,
  UNKNOWN_MIMIR_HALT as UNKNOWN_MIMIR_HALT_MAYA
} from '../services/mayachain/const'
import { DEFAULT_MIMIR_HALT, UNKNOWN_MIMIR_HALT } from '../services/thorchain/const'
import { isRuneSendDisabled, resolveHaltState, resolveSwapHaltState } from './haltedChains'
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

const swapState = (
  thor: { inbound: RD.RemoteData<Error, Chain[]>; mimir: typeof DEFAULT_MIMIR_HALT },
  maya: { inbound: RD.RemoteData<Error, Chain[]>; mimir: typeof DEFAULT_MIMIR_HALT_MAYA }
) => ({
  thor: resolveSwapHaltState(thor.inbound, thor.mimir, DEFAULT_MIMIR_HALT),
  maya: resolveSwapHaltState(maya.inbound, maya.mimir, DEFAULT_MIMIR_HALT_MAYA)
})

describe('swap halt policy: unknown status alone does not block swaps', () => {
  it.each(unknownInbound)(
    'mimir unknown + inbound %s: THOR and MAYA stay quotable, the swap is not disabled',
    (_, inbound) => {
      const state = swapState({ inbound, mimir: UNKNOWN_MIMIR_HALT }, { inbound, mimir: UNKNOWN_MIMIR_HALT_MAYA })
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
        { inbound: failed, mimir: UNKNOWN_MIMIR_HALT_MAYA }
      )
      expect(filterQuotableProtocols([...ALL], BTC, ETH, state)).toEqual(['Mayachain', 'Chainflip', 'OneClick'])
      expect(isSwapDisabledForChains({ protocol: 'Thorchain', chains: [BTCChain, ETHChain], ...state.thor })).toBe(true)
    }
  )

  it.each([['HALTBTCTRADING'], ['HALTBTCCHAIN'], ['HALTTRADING'], ['HALTMAYACHAIN']])(
    'MAYA mimir %s loaded + inbound unknown: MAYA dropped from the quote, swap disabled',
    (key) => {
      const state = swapState(
        { inbound: RD.pending, mimir: UNKNOWN_MIMIR_HALT },
        { inbound: RD.pending, mimir: mayaKnown({ [key]: 1 }) }
      )
      expect(filterQuotableProtocols([...ALL], BTC, ETH, state)).toEqual(['Thorchain', 'Chainflip', 'OneClick'])
      expect(isSwapDisabledForChains({ protocol: 'Mayachain', chains: [BTCChain, ETHChain], ...state.maya })).toBe(true)
    }
  )

  it('inbound loaded with a halted chain + mimir unknown: that protocol is dropped / disabled', () => {
    const state = swapState(
      { inbound: loaded([ETHChain]), mimir: UNKNOWN_MIMIR_HALT },
      { inbound: loaded([BTCChain]), mimir: UNKNOWN_MIMIR_HALT_MAYA }
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

describe('liquidity actions and RUNE sends stay blocked while the halt status is unknown', () => {
  it.each(unknownInbound)('THOR inbound %s: deposits, withdrawals and RUNE sends blocked', (_, inbound) => {
    const { haltedChains, mimirHalt } = resolveHaltState(inbound, thorKnown({}), UNKNOWN_MIMIR_HALT)
    expect(PoolHelpers.disablePoolActions({ asset: BTC, haltedChains, mimirHalt })).toBe(true)
    expect(PoolHelpers.disableWithdrawActions({ chain: BTCChain, haltedChains, mimirHalt })).toBe(true)
    expect(PoolHelpers.disableAllActions({ chain: BTCChain, haltedChains, mimirHalt })).toBe(true)
    expect(isRuneSendDisabled(mimirHalt)).toBe(true)
  })

  it('THOR mimir unknown (inbound loaded): deposits, withdrawals and RUNE sends blocked', () => {
    const { haltedChains, mimirHalt } = resolveHaltState(loaded([]), UNKNOWN_MIMIR_HALT, UNKNOWN_MIMIR_HALT)
    expect(PoolHelpers.disablePoolActions({ asset: BTC, haltedChains, mimirHalt })).toBe(true)
    expect(PoolHelpers.disableWithdrawActions({ chain: BTCChain, haltedChains, mimirHalt })).toBe(true)
    expect(isRuneSendDisabled(mimirHalt)).toBe(true)
  })

  it.each(unknownInbound)('MAYA inbound %s: deposits and withdrawals blocked', (_, inbound) => {
    const { haltedChains, mimirHalt } = resolveHaltState(inbound, mayaKnown({}), UNKNOWN_MIMIR_HALT_MAYA)
    expect(PoolHelpersMaya.disablePoolActions({ chain: BTCChain, haltedChains, mimirHalt })).toBe(true)
    expect(PoolHelpersMaya.disableWithdrawActions({ chain: BTCChain, haltedChains, mimirHalt })).toBe(true)
  })

  it('known state, nothing halted: liquidity and RUNE sends allowed (no over-blocking)', () => {
    const { haltedChains, mimirHalt } = resolveHaltState(loaded([]), thorKnown({}), UNKNOWN_MIMIR_HALT)
    expect(PoolHelpers.disablePoolActions({ asset: BTC, haltedChains, mimirHalt })).toBe(false)
    expect(isRuneSendDisabled(mimirHalt)).toBe(false)
  })
})

describe('helpers/haltedChains resolveSwapHaltState', () => {
  it('keeps a loaded halted list and a known mimir as they are', () => {
    const mimir = thorKnown({ HALTETHTRADING: 1 })
    expect(resolveSwapHaltState(loaded([BTCChain]), mimir, DEFAULT_MIMIR_HALT)).toEqual({
      haltedChains: [BTCChain],
      mimirHalt: mimir
    })
  })

  it('drops only the synthetic flags of an unknown status', () => {
    expect(resolveSwapHaltState(failed, UNKNOWN_MIMIR_HALT, DEFAULT_MIMIR_HALT)).toEqual({
      haltedChains: [],
      mimirHalt: DEFAULT_MIMIR_HALT
    })
  })
})
