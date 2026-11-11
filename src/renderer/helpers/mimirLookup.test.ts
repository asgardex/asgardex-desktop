/* eslint-disable no-console -- tests assert the console.warn on a mimir key casing mismatch */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createMimirLookup,
  isHaltRelevantMimirKey,
  parseMimir,
  parseMimirValue,
  resetMimirCasingWarnings
} from './mimirLookup'

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
    'retains a malformed halt key value %p as local uncertainty',
    (raw) => {
      expect(parseMimir({ HALTBTCCHAIN: raw }).HALTBTCCHAIN).toBeNaN()
    }
  )

  it.each([[1.5], [-0.5], [0.1], [Number.MAX_SAFE_INTEGER + 1], [-(Number.MAX_SAFE_INTEGER + 1)], [Infinity]])(
    'retains a non-integer or unsafe number %p as local uncertainty',
    (raw) => {
      expect(parseMimir({ HALTBTCCHAIN: raw }).HALTBTCCHAIN).toBeNaN()
      expect(parseMimirValue(raw)).toBeUndefined()
    }
  )

  it('retains an unsafe integer string as local uncertainty', () => {
    expect(parseMimir({ HALTBTCCHAIN: String(Number.MAX_SAFE_INTEGER + 2) }).HALTBTCCHAIN).toBeNaN()
  })

  it.each([[0], [1], [-1], [28483475], [Number.MAX_SAFE_INTEGER], [-Number.MAX_SAFE_INTEGER]])(
    'still accepts the integer %p',
    (raw) => {
      expect(parseMimir({ HALTBTCCHAIN: raw })).toEqual({ HALTBTCCHAIN: raw })
      expect(parseMimirValue(String(raw))).toBe(raw)
    }
  )

  it('drops a non-integer number on an unrelated key instead of throwing', () => {
    expect(parseMimir({ SOMEOTHERKEY: 1.5, HALTBTCCHAIN: 1 })).toEqual({ HALTBTCCHAIN: 1 })
  })

  it('checks halt keys case-insensitively', () => {
    expect(parseMimir({ haltbtcchain: '' }).haltbtcchain).toBeNaN()
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
      'PAUSELPDEPOSIT-BTC-BTC',
      // token-pool keys have more than two segments after PAUSELPDEPOSIT-
      'PAUSELPDEPOSIT-ETH-USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48',
      'pauselpdeposit-avax-usdt-0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7'
    ].forEach((key) => expect([key, isHaltRelevantMimirKey(key)]).toEqual([key, true]))
    expect(isHaltRelevantMimirKey('MINIMUMBONDINRUNE')).toBe(false)
  })

  it('retains malformed token-pool PAUSELPDEPOSIT uncertainty without losing other chains', () => {
    const result = parseMimir({
      'PAUSELPDEPOSIT-ETH-USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48': 'not-a-number',
      HALTBTCCHAIN: 0
    })
    expect(result['PAUSELPDEPOSIT-ETH-USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48']).toBeNaN()
    expect(result.HALTBTCCHAIN).toBe(0)
  })
})

it('isolates a malformed halt key and preserves every valid key', () => {
  const result = parseMimir({ HALTBTCCHAIN: 'bad', HALTETHCHAIN: 1, HALTTRADING: 0 })
  expect(result.HALTBTCCHAIN).toBeNaN()
  expect(result.HALTETHCHAIN).toBe(1)
  expect(result.HALTTRADING).toBe(0)
})
