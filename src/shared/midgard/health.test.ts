import { describe, expect, it } from 'vitest'

import { isMidgardUsable, MIDGARD_USABLE_LAG_BLOCKS } from './health'

describe('isMidgardUsable', () => {
  it('accepts a database that is in sync', () => {
    expect(isMidgardUsable({ database: true, inSync: true })).toBe(true)
  })

  it('accepts a database a few blocks behind THORNode', () => {
    expect(
      isMidgardUsable({
        database: true,
        inSync: false,
        scannerHeight: '28621351',
        lastThorNode: { height: 28621362 }
      })
    ).toBe(true)
  })

  it('rejects a scanner further behind than the lag budget', () => {
    expect(
      isMidgardUsable({
        database: true,
        inSync: false,
        scannerHeight: '100',
        lastThorNode: { height: 100 + MIDGARD_USABLE_LAG_BLOCKS + 1 }
      })
    ).toBe(false)
  })

  it('rejects a health payload whose database is down', () => {
    expect(isMidgardUsable({ database: false, inSync: true })).toBe(false)
  })

  it('rejects a catching-up payload that has no heights', () => {
    expect(isMidgardUsable({ database: true, inSync: false })).toBe(false)
  })
})
