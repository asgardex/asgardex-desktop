import { THORChain } from '@xchainjs/xchain-thorchain'
import { assetFromStringEx } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SwapFeesParams } from '../types'

const poolInboundFee$ = vi.fn()

vi.mock('./common', () => ({
  poolInboundFee$: (...args: unknown[]) => {
    poolInboundFee$(...args)
    return Rx.of({ _tag: 'RemoteSuccess', value: { asset: {}, amount: {} } })
  },
  poolOutboundFee$: () => Rx.of({ _tag: 'RemoteSuccess', value: { asset: {}, amount: {} } })
}))
vi.mock('../../mayachain', () => ({ reloadFees: vi.fn() }))
vi.mock('../../thorchain', () => ({ reloadFees: vi.fn(), reloadInboundAddresses: vi.fn() }))

import { reloadSwapFees, swapFees$ } from './swap'

const BTC = assetFromStringEx('BTC.BTC')
const ETH = assetFromStringEx('ETH.ETH')
const params: SwapFeesParams = { inAsset: BTC, outAsset: ETH, memo: 'm', sender: 'bc1', inboundProtocol: THORChain }

describe('swapFees$ reload dedupe', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    poolInboundFee$.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits a reload with the same params after re-entering the page', () => {
    const initial: SwapFeesParams = { inAsset: BTC, outAsset: ETH, memo: 'm' }

    const first = swapFees$(initial).subscribe()
    vi.advanceTimersByTime(400)
    reloadSwapFees(params)
    vi.advanceTimersByTime(400)
    expect(poolInboundFee$).toHaveBeenLastCalledWith(BTC, 'm', 'bc1', THORChain, undefined, undefined)
    first.unsubscribe()

    poolInboundFee$.mockClear()
    const second = swapFees$(initial).subscribe()
    vi.advanceTimersByTime(400)
    expect(poolInboundFee$).toHaveBeenLastCalledWith(BTC, 'm', undefined, undefined, undefined, undefined)
    reloadSwapFees(params) // equal to the previous page's state, must still be emitted
    vi.advanceTimersByTime(400)
    expect(poolInboundFee$).toHaveBeenLastCalledWith(BTC, 'm', 'bc1', THORChain, undefined, undefined)
    second.unsubscribe()
  })

  it('re-estimates when MAX is toggled and passes sendMax through', () => {
    const sub = swapFees$(params).subscribe()
    vi.advanceTimersByTime(400)
    reloadSwapFees({ ...params, sendMax: true })
    vi.advanceTimersByTime(400)
    expect(poolInboundFee$).toHaveBeenLastCalledWith(BTC, 'm', 'bc1', THORChain, undefined, true)
    reloadSwapFees({ ...params, sendMax: undefined })
    vi.advanceTimersByTime(400)
    expect(poolInboundFee$).toHaveBeenLastCalledWith(BTC, 'm', 'bc1', THORChain, undefined, undefined)
    sub.unsubscribe()
  })
})
