import { describe, expect, it } from 'vitest'

import { newlyCompletedDestinationRefreshes, type TrackerLedger, type TrackerRow } from './trackerBalance'

const row = (
  id: string,
  isComplete: boolean,
  toAsset: string,
  ledger: TrackerLedger = 'thor',
  fromAsset = 'BTC.BTC'
): TrackerRow => ({
  id,
  isComplete,
  fromAsset,
  toAsset,
  ledger
})

describe('newlyCompletedDestinationRefreshes', () => {
  it('reloads the destination chain when a watched swap completes', () => {
    const watching = new Set<string>()
    const reloaded = new Set<string>()
    expect(newlyCompletedDestinationRefreshes([row('a', false, 'LTC.LTC')], watching, reloaded)).toEqual([])
    expect(newlyCompletedDestinationRefreshes([row('a', true, 'LTC.LTC')], watching, reloaded)).toEqual([
      { kind: 'chain', chain: 'LTC' }
    ])
  })

  it('ignores a swap that is already complete the first time it appears', () => {
    const watching = new Set<string>()
    const reloaded = new Set<string>()
    expect(newlyCompletedDestinationRefreshes([row('old', true, 'LTC.LTC')], watching, reloaded)).toEqual([])
    expect(newlyCompletedDestinationRefreshes([row('old', true, 'LTC.LTC')], watching, reloaded)).toEqual([])
  })

  it('reloads each destination chain once when several swaps finish together', () => {
    const watching = new Set<string>(['a', 'b', 'c'])
    const reloaded = new Set<string>()
    expect(
      newlyCompletedDestinationRefreshes(
        [row('a', true, 'LTC.LTC'), row('b', true, 'LTC.LTC'), row('c', true, 'DOGE.DOGE')],
        watching,
        reloaded
      )
    ).toEqual([
      { kind: 'chain', chain: 'LTC' },
      { kind: 'chain', chain: 'DOGE' }
    ])
    expect(newlyCompletedDestinationRefreshes([row('a', true, 'LTC.LTC')], watching, reloaded)).toEqual([])
  })

  it('skips a destination that is not a wallet chain', () => {
    const watching = new Set<string>(['a'])
    const reloaded = new Set<string>()
    expect(newlyCompletedDestinationRefreshes([row('a', true, 'FOO.BAR')], watching, reloaded)).toEqual([])
  })

  it('reloads the THORChain trade account for a trade-asset destination, not the L1 named in the asset', () => {
    const watching = new Set<string>(['a'])
    const reloaded = new Set<string>()
    expect(
      newlyCompletedDestinationRefreshes(
        [row('a', true, 'ETH~USDC-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', 'thor')],
        watching,
        reloaded
      )
    ).toEqual([{ kind: 'thorTrade' }])
  })

  it('reloads the MAYAChain trade account when the Maya tracker completes a trade-asset swap', () => {
    const watching = new Set<string>(['a'])
    const reloaded = new Set<string>()
    expect(newlyCompletedDestinationRefreshes([row('a', true, 'ETH~ETH', 'maya')], watching, reloaded)).toEqual([
      { kind: 'mayaTrade' }
    ])
  })

  it('reloads the trade account once when two trade-asset swaps finish together', () => {
    const watching = new Set<string>(['a', 'b'])
    const reloaded = new Set<string>()
    expect(
      newlyCompletedDestinationRefreshes(
        [row('a', true, 'ETH~ETH', 'thor'), row('b', true, 'BTC~BTC', 'thor')],
        watching,
        reloaded
      )
    ).toEqual([{ kind: 'thorTrade' }])
  })

  it('reloads a native destination chain beside a trade-asset destination', () => {
    const watching = new Set<string>(['a', 'b'])
    const reloaded = new Set<string>()
    expect(
      newlyCompletedDestinationRefreshes(
        [row('a', true, 'ETH~ETH', 'thor'), row('b', true, 'THOR.RUNE', 'thor')],
        watching,
        reloaded
      )
    ).toEqual([{ kind: 'thorTrade' }, { kind: 'chain', chain: 'THOR' }])
  })

  it('keeps an L1 tracker on the chain named in the asset', () => {
    const watching = new Set<string>(['a'])
    const reloaded = new Set<string>()
    expect(newlyCompletedDestinationRefreshes([row('a', true, 'ETH.ETH', 'l1')], watching, reloaded)).toEqual([
      { kind: 'chain', chain: 'ETH' }
    ])
  })

  it('reloads the spent THORChain trade account when a trade asset is sold for an L1', () => {
    const watching = new Set<string>(['a'])
    const reloaded = new Set<string>()
    expect(
      newlyCompletedDestinationRefreshes(
        [row('a', true, 'LTC.LTC', 'thor', 'ETH~USDC-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')],
        watching,
        reloaded
      )
    ).toEqual([{ kind: 'chain', chain: 'LTC' }, { kind: 'thorTrade' }])
  })

  it('reloads the spent MAYAChain trade account when a trade asset is sold for an L1', () => {
    const watching = new Set<string>(['a'])
    const reloaded = new Set<string>()
    expect(
      newlyCompletedDestinationRefreshes([row('a', true, 'BTC.BTC', 'maya', 'ETH~ETH')], watching, reloaded)
    ).toEqual([{ kind: 'chain', chain: 'BTC' }, { kind: 'mayaTrade' }])
  })

  it('fetches the trade account once when both legs are trade assets', () => {
    const watching = new Set<string>(['a'])
    const reloaded = new Set<string>()
    expect(
      newlyCompletedDestinationRefreshes([row('a', true, 'BTC~BTC', 'thor', 'ETH~USDC')], watching, reloaded)
    ).toEqual([{ kind: 'thorTrade' }])
  })

  it('leaves a spent L1 chain alone when the received asset is a trade asset', () => {
    const watching = new Set<string>(['a'])
    const reloaded = new Set<string>()
    expect(
      newlyCompletedDestinationRefreshes([row('a', true, 'ETH~USDC', 'thor', 'LTC.LTC')], watching, reloaded)
    ).toEqual([{ kind: 'thorTrade' }])
  })
})
