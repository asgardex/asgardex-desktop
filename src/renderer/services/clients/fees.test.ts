import * as RD from '@devexperts/remote-data-ts'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { FeeType, singleFee, XChainClient } from '@xchainjs/xchain-client'
import { baseAmount } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { createFeesService } from './fees'
import { XChainClient$ } from './types'

const FEES = singleFee(FeeType.FlatFee, baseAmount(1000))

// Collect the pending emission + the first resolved (non-pending) emission.
const resolve = (client$: XChainClient$) => {
  const { fees$ } = createFeesService({ client$, chain: BTCChain })
  return Rx.firstValueFrom(
    fees$().pipe(
      RxOp.filter((rd) => !RD.isPending(rd)),
      RxOp.take(1)
    )
  )
}

describe('services/clients/fees', () => {
  it('resolves fees for a keystore client (address derived, passed as sender)', async () => {
    const getFees = vi.fn().mockResolvedValue(FEES)
    const client = {
      getAddressAsync: vi.fn().mockResolvedValue('addr-1'),
      getFees
    } as unknown as XChainClient

    const result = await resolve(Rx.of(O.some(client)))

    expect(result).toEqual(RD.success(FEES))
    expect(getFees).toHaveBeenCalledWith({ sender: 'addr-1' })
  })

  it('falls back to a sender-less getFees when the client has no phrase (XRP-like)', async () => {
    // Phrase-less read-only client (Vultisig / standalone Ledger): getAddressAsync
    // throws, but getFees does not need a sender and still returns a real fee.
    const getFees = vi.fn().mockResolvedValue(FEES)
    const client = {
      getAddressAsync: vi.fn().mockRejectedValue(new Error('Phrase must be provided')),
      getFees
    } as unknown as XChainClient

    const result = await resolve(Rx.of(O.some(client)))

    expect(result).toEqual(RD.success(FEES))
    // called with no sender, NOT with { sender: ... }
    expect(getFees).toHaveBeenCalledWith()
  })

  it('degrades to RD.failure (not stuck pending) when the fee itself needs a sender (TRON-like)', async () => {
    // Phrase-less client AND a fee that cannot be computed without a signer:
    // must surface a Failure — never leave the stream hanging on `pending`.
    const client = {
      getAddressAsync: vi.fn().mockRejectedValue(new Error('Phrase must be provided')),
      getFees: vi.fn().mockRejectedValue(new Error('Params need to be passed'))
    } as unknown as XChainClient

    const result = await resolve(Rx.of(O.some(client)))

    expect(RD.isFailure(result)).toBe(true)
  })

  it('emits RD.failure when no client is available', async () => {
    const result = await resolve(Rx.of(O.none))
    expect(RD.isFailure(result)).toBe(true)
  })

  it('starts with RD.pending', async () => {
    const client = {
      getAddressAsync: vi.fn().mockResolvedValue('addr-1'),
      getFees: vi.fn().mockResolvedValue(FEES)
    } as unknown as XChainClient
    const { fees$ } = createFeesService({ client$: Rx.of(O.some(client)), chain: BTCChain })
    const first = await Rx.firstValueFrom(fees$())
    expect(RD.isPending(first)).toBe(true)
  })
})
