/* eslint-disable no-console -- tests assert the console.warn on a mimir key casing mismatch */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMimirLookup, isHaltRelevantMimirKey, parseMimir, resetMimirCasingWarnings } from './mimirLookup'

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

describe('helpers/mimirLookup parseMimir', () => {
  it('accepts numbers and integer strings', () => {
    expect(parseMimir({ HALTBTCCHAIN: 1, PAUSELP: '12', OTHER: ' 3 ' })).toEqual({
      HALTBTCCHAIN: 1,
      PAUSELP: 12,
      OTHER: 3
    })
  })

  it.each([[''], [null], [false], ['abc'], [Number.NaN], [{}], ['1.5']])(
    'rejects a malformed halt key value %p (status unknown, never "no halt")',
    (raw) => {
      expect(() => parseMimir({ HALTBTCCHAIN: raw })).toThrow('HALTBTCCHAIN')
    }
  )

  it('checks halt keys case-insensitively', () => {
    expect(() => parseMimir({ haltbtcchain: '' })).toThrow()
  })

  it('drops malformed values of unrelated keys', () => {
    expect(parseMimir({ SOMETHINGELSE: 'x', HALTBTCCHAIN: 0 })).toEqual({ HALTBTCCHAIN: 0 })
  })

  it('throws for a non-object body', () => {
    expect(() => parseMimir(null)).toThrow()
    expect(() => parseMimir([1])).toThrow()
    expect(() => parseMimir('x')).toThrow()
  })

  it('treats every halt key the app reads as relevant', () => {
    ;[
      'HALTBTCCHAIN',
      'HALTBTCTRADING',
      'HALTTHORCHAIN',
      'HALTTCYTRADING',
      'HALTTRADING',
      'HALTCHAINGLOBAL',
      'SOLVENCYHALTBTCCHAIN',
      'NODEPAUSECHAINGLOBAL',
      'PAUSELP',
      'PAUSELPBTC',
      'PAUSELPDEPOSIT-BTC-BTC'
    ].forEach((key) => expect([key, isHaltRelevantMimirKey(key)]).toEqual([key, true]))
    expect(isHaltRelevantMimirKey('MINIMUMBONDINRUNE')).toBe(false)
  })
})
