import * as RD from '@devexperts/remote-data-ts'
import { describe, expect, it } from 'vitest'

import { resolveHaltState } from './haltedChains'

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
