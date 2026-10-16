import { describe, expect, it } from 'vitest'

import { newlyCompletedDestinationChains, type TrackerRow } from './trackerBalance'

const row = (id: string, isComplete: boolean, toAsset: string): TrackerRow => ({ id, isComplete, toAsset })

describe('newlyCompletedDestinationChains', () => {
  it('reloads the destination chain when a watched swap completes', () => {
    const watching = new Set<string>()
    const reloaded = new Set<string>()
    expect(newlyCompletedDestinationChains([row('a', false, 'LTC.LTC')], watching, reloaded)).toEqual([])
    expect(newlyCompletedDestinationChains([row('a', true, 'LTC.LTC')], watching, reloaded)).toEqual(['LTC'])
  })

  it('ignores a swap that is already complete the first time it appears', () => {
    const watching = new Set<string>()
    const reloaded = new Set<string>()
    expect(newlyCompletedDestinationChains([row('old', true, 'LTC.LTC')], watching, reloaded)).toEqual([])
    expect(newlyCompletedDestinationChains([row('old', true, 'LTC.LTC')], watching, reloaded)).toEqual([])
  })

  it('reloads each destination chain once when several swaps finish together', () => {
    const watching = new Set<string>(['a', 'b', 'c'])
    const reloaded = new Set<string>()
    expect(
      newlyCompletedDestinationChains(
        [row('a', true, 'LTC.LTC'), row('b', true, 'LTC.LTC'), row('c', true, 'DOGE.DOGE')],
        watching,
        reloaded
      )
    ).toEqual(['LTC', 'DOGE'])
    expect(newlyCompletedDestinationChains([row('a', true, 'LTC.LTC')], watching, reloaded)).toEqual([])
  })

  it('skips a destination that is not a wallet chain', () => {
    const watching = new Set<string>(['a'])
    const reloaded = new Set<string>()
    expect(newlyCompletedDestinationChains([row('a', true, 'FOO.BAR')], watching, reloaded)).toEqual([])
  })
})
