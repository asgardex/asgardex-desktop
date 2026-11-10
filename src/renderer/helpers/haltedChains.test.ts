import * as RD from '@devexperts/remote-data-ts'
import { describe, expect, it } from 'vitest'

import { getThorchainMimirHalt } from '../hooks/useMimirHalt'
import { DEFAULT_MIMIR_HALT, UNKNOWN_MIMIR_HALT } from '../services/thorchain/const'
import { isRuneSendDisabled, resolveHaltState } from './haltedChains'

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
    ;[
      { HALTTHORCHAIN: 1 },
      { SOLVENCYHALTTHORCHAIN: 1 },
      { HALTCHAINGLOBAL: 1 },
      { NODEPAUSECHAINGLOBAL: 200 }
    ].forEach((mimir) => {
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
    expect(isRuneSendDisabled({ ...DEFAULT_MIMIR_HALT, HALTBTCCHAIN: true })).toBe(false)
  })
})
