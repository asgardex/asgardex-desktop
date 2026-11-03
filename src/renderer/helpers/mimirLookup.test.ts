/* eslint-disable no-console -- tests assert the console.warn on a mimir key casing mismatch */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMimirLookup, resetMimirCasingWarnings } from './mimirLookup'

describe('helpers/mimirLookup', () => {
  beforeEach(() => {
    resetMimirCasingWarnings()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('returns the value of an exact key without warning', () => {
    const lookup = createMimirLookup({ HALTBTCCHAIN: 5 }, 'THORNode')
    expect(lookup('HALTBTCCHAIN')).toEqual([5])
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('returns [] for an unknown key', () => {
    expect(createMimirLookup({ HALTBTCCHAIN: 5 }, 'THORNode')('HALTETHCHAIN')).toEqual([])
  })

  it('finds a key in any casing and warns with the source, both spellings', () => {
    const lookup = createMimirLookup({ HaltBtcChain: 7 }, 'MAYANode')
    expect(lookup('HALTBTCCHAIN')).toEqual([7])
    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(console.warn).toHaveBeenCalledWith(
      '[ASGARDEX][MAYANode] mimir key "HaltBtcChain" has unexpected casing, read as "HALTBTCCHAIN"'
    )
  })

  it('warns once per key and source', () => {
    const mimir = { haltbtcchain: 1 }
    createMimirLookup(mimir, 'THORNode')('HALTBTCCHAIN')
    createMimirLookup(mimir, 'THORNode')('HALTBTCCHAIN')
    expect(console.warn).toHaveBeenCalledTimes(1)
    createMimirLookup(mimir, 'MAYANode')('HALTBTCCHAIN')
    expect(console.warn).toHaveBeenCalledTimes(2)
  })

  it('returns every value when a key is sent in several casings', () => {
    const lookup = createMimirLookup({ HALTBTCCHAIN: 0, haltbtcchain: 9 }, 'THORNode')
    expect(lookup('HALTBTCCHAIN').sort()).toEqual([0, 9])
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('does not warn about keys that are never looked up', () => {
    createMimirLookup({ somethingElse: 1 }, 'THORNode')('HALTBTCCHAIN')
    expect(console.warn).not.toHaveBeenCalled()
  })
})
