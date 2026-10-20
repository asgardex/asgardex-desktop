import { option as O } from 'fp-ts'
import { describe, expect, it } from 'vitest'

import { swapTrackVisible } from './trackSwap'

const visible = (overrides: Partial<Parameters<typeof swapTrackVisible>[0]> = {}) =>
  swapTrackVisible({
    tradeAssetSwap: false,
    protocol: O.some('Thorchain'),
    channelId: O.none,
    hasHash: true,
    settled: true,
    ...overrides
  })

describe('swapTrackVisible', () => {
  it('hides track when both legs are trade assets', () => {
    expect(visible({ tradeAssetSwap: true })).toBe(false)
  })

  it('shows track for a settled L1 THORChain or MAYAChain swap', () => {
    expect(visible()).toBe(true)
    expect(visible({ protocol: O.some('Mayachain') })).toBe(true)
  })

  it('hides track until the swap has a hash', () => {
    expect(visible({ hasHash: false, settled: false })).toBe(false)
  })

  it('hides track when the protocol has no tracker', () => {
    expect(visible({ protocol: O.some('OneClick') })).toBe(false)
    expect(visible({ protocol: O.none })).toBe(false)
  })

  it('shows a Chainflip track link only once the channel id exists', () => {
    expect(visible({ protocol: O.some('Chainflip'), channelId: O.none })).toBe(false)
    expect(visible({ protocol: O.some('Chainflip'), channelId: O.some('99') })).toBe(true)
  })
})
