import * as RD from '@devexperts/remote-data-ts'
import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_ENABLED_CHAINS } from '../../shared/utils/chain'
import { getThorchainMimirHalt } from '../hooks/useMimirHalt'
import { getMayachainMimirHalt } from '../hooks/useMimirHaltMaya'
import { createUnknownMimirHalt as createUnknownMaya } from '../services/mayachain/const'
import {
  createUnknownMimirHalt as createUnknownThor,
  DEFAULT_MIMIR_HALT,
  UNKNOWN_MIMIR_HALT
} from '../services/thorchain/const'
import * as ChainHelpers from './chainHelper'
import { isRuneSendDisabled, isWithdrawDisabled, resolveHaltState } from './haltedChains'

const KNOWN = { known: true }
const UNKNOWN = { known: false }

describe('helpers/haltedChains resolveHaltState', () => {
  it('loaded list: keeps it and the given mimir halt', () => {
    expect(resolveHaltState(RD.success(['BTC']), KNOWN, UNKNOWN)).toEqual({
      haltedChains: ['BTC'],
      mimirHalt: KNOWN,
      haltedChainsUnknown: false
    })
  })

  it.each([
    ['failure', RD.failure(Error('down'))],
    ['pending', RD.pending],
    ['initial', RD.initial]
  ])('%s list: unknown halt (fail closed), never "no halted chains"', (_, rd) => {
    const result = resolveHaltState(rd as RD.RemoteData<Error, string[]>, KNOWN, UNKNOWN)
    expect(result.mimirHalt).toBe(UNKNOWN)
    expect(result.haltedChainsUnknown).toBe(true)
  })
})

describe('helpers/haltedChains isRuneSendDisabled', () => {
  it('blocks a RUNE send under HALTTHORCHAIN (THORNode rejects MsgSend while IsChainHalted(THOR))', () => {
    expect(isRuneSendDisabled({ ...DEFAULT_MIMIR_HALT, HALTTHORCHAIN: true })).toBe(true)
  })

  it('blocks it for every THORChain chain halt that folds into HALTTHORCHAIN', () => {
    const mimirs: Record<string, number>[] = [
      { HALTTHORCHAIN: 1 },
      { SOLVENCYHALTTHORCHAIN: 1 },
      { HALTCHAINGLOBAL: 1 },
      { NODEPAUSECHAINGLOBAL: 200 }
    ]
    mimirs.forEach((mimir) => {
      const mimirHalt = getThorchainMimirHalt({ mimir, lastHeight: 100, chains: ['THOR'] })
      expect([mimir, isRuneSendDisabled(mimirHalt)]).toEqual([mimir, true])
    })
  })

  it('blocks it under HALTTHORTRADING and while the halt status is unknown', () => {
    expect(isRuneSendDisabled({ ...DEFAULT_MIMIR_HALT, HALTTHORTRADING: true })).toBe(true)
    expect(isRuneSendDisabled(UNKNOWN_MIMIR_HALT)).toBe(true)
  })

  it('allows it when nothing is halted, or only another chain', () => {
    expect(isRuneSendDisabled(DEFAULT_MIMIR_HALT)).toBe(false)
    const otherChainHalt = { ...DEFAULT_MIMIR_HALT, HALTBTCCHAIN: true }
    expect(isRuneSendDisabled(otherChainHalt)).toBe(false)
  })
})

describe.each([
  ['THOR', getThorchainMimirHalt],
  ['MAYA', getMayachainMimirHalt]
])('withdraw proven halt policy on %s', (protocol, mapHalt) => {
  const disabled = (mimir: Record<string, number>, lastHeight = 100) =>
    isWithdrawDisabled({
      chain: 'BTC',
      protocol,
      confirmedMimirHalt: mapHalt({ mimir, lastHeight, chains: ['BTC', 'ETH'], includeUncertain: false })
    })

  it.each(['HALTCHAINGLOBAL', 'NODEPAUSECHAINGLOBAL', 'HALTBTCCHAIN', 'SOLVENCYHALTBTCCHAIN', 'PAUSELP', 'PAUSELPBTC'])(
    'blocks proven %s',
    (key) => expect(disabled({ [key]: key === 'NODEPAUSECHAINGLOBAL' ? 200 : 1 })).toBe(true)
  )
  it.each([
    'HALTTRADING',
    'HALTBTCTRADING',
    `HALT${protocol}TRADING`,
    'HALTETHCHAIN',
    'PAUSELPETH',
    'PAUSELPDEPOSIT-BTC-BTC'
  ])('does not block for %s', (key) => expect(disabled({ [key]: 1 })).toBe(false))
  it.each(['HALTBTCCHAIN', 'SOLVENCYHALTBTCCHAIN', 'PAUSELPBTC', 'PAUSELP', 'NODEPAUSECHAINGLOBAL'])(
    'does not block unproven scheduled %s without height',
    (key) => expect(disabled({ [key]: 200 }, 0)).toBe(false)
  )
  it('keeps a proven chain halt while height is unknown', () => expect(disabled({ HALTBTCCHAIN: 1 }, 0)).toBe(true))
  it('does not block for unknown status alone', () => {
    expect(isWithdrawDisabled({ chain: 'BTC', protocol, confirmedMimirHalt: { haltStatusUnknown: true } })).toBe(false)
  })
  it('uses the active protocol chain halt', () => {
    expect(disabled({ [`HALT${protocol}CHAIN`]: 1 })).toBe(true)
    expect(disabled({ [`HALT${protocol === 'THOR' ? 'MAYA' : 'THOR'}CHAIN`]: 1 })).toBe(false)
  })
})

describe.each([
  ['THOR', createUnknownThor],
  ['MAYA', createUnknownMaya]
])('consistent chain list on %s', (_, createUnknown) => {
  it('derives unknown keys from the same live chain list as default keys', () => {
    const original = ChainHelpers.getChainAsset
    const assetLookup = vi
      .spyOn(ChainHelpers, 'getChainAsset')
      .mockImplementation((chain) =>
        chain === 'XMR' ? { ...original('BTC'), chain: 'XMR', symbol: 'XMR', ticker: 'XMR' } : original(chain)
      )
    DEFAULT_ENABLED_CHAINS.XMR = 'Monero'
    try {
      const unknown = createUnknown()
      expect(unknown.HALTXMRCHAIN).toBe(true)
      expect(unknown.HALTXMRTRADING).toBe(true)
      expect(unknown.PAUSELPXMR).toBe(true)
    } finally {
      delete DEFAULT_ENABLED_CHAINS.XMR
      assetLookup.mockRestore()
    }
  })
})
