import * as RD from '@devexperts/remote-data-ts'
import { FeeType, singleFee } from '@xchainjs/xchain-client'
import { AssetTRX, TRONChain } from '@xchainjs/xchain-tron'
import { AssetType, baseAmount } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { createFeesService } from './fees'
import { Client$ } from './types'

const FEES = singleFee(FeeType.FlatFee, baseAmount(7_800_000, 6))

const usdt = {
  chain: TRONChain,
  symbol: 'USDT-TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  ticker: 'USDT',
  type: AssetType.TOKEN
}

const inbound = 'TInboundAddress'

const firstResolved = (
  client$: Client$,
  params: Parameters<ReturnType<typeof createFeesService>['poolInTxFees$']>[0]
) => {
  const { poolInTxFees$ } = createFeesService(client$)
  return Rx.firstValueFrom(
    poolInTxFees$(params).pipe(
      RxOp.filter((rd) => !RD.isPending(rd)),
      RxOp.take(1)
    )
  )
}

describe('tron pool inbound fees', () => {
  it('passes the asset, amount, recipient, and memo into getFees', async () => {
    const getFees = vi.fn().mockResolvedValue(FEES)
    const amount = baseAmount(1, 6)

    const result = await firstResolved(Rx.of(O.some({ getFees })) as Client$, {
      asset: usdt,
      amount,
      recipient: inbound,
      memo: '=:r:thor1abc:dx:0'
    })

    expect(result).toEqual(RD.success(FEES))
    expect(getFees).toHaveBeenCalledWith({
      asset: usdt,
      amount,
      recipient: inbound,
      memo: '=:r:thor1abc:dx:0'
    })
  })

  it('passes a native TRX asset through unchanged', async () => {
    const getFees = vi.fn().mockResolvedValue(FEES)
    const amount = baseAmount(1, 6)

    await firstResolved(Rx.of(O.some({ getFees })) as Client$, {
      asset: AssetTRX,
      amount,
      recipient: inbound,
      memo: '=:THOR.RUNE:thor1abc'
    })

    expect(getFees).toHaveBeenCalledWith({
      asset: AssetTRX,
      amount,
      recipient: inbound,
      memo: '=:THOR.RUNE:thor1abc'
    })
  })

  it('fails instead of staying pending when getFees rejects', async () => {
    const getFees = vi.fn().mockRejectedValue(new Error('Phrase must be provided'))

    const result = await firstResolved(Rx.of(O.some({ getFees })) as Client$, {
      asset: usdt,
      amount: baseAmount(1, 6),
      recipient: inbound,
      memo: '=:r:thor1abc'
    })

    expect(RD.isFailure(result)).toBe(true)
  })

  it('fails when no client is available', async () => {
    const result = await firstResolved(Rx.of(O.none) as Client$, {
      asset: AssetTRX,
      amount: baseAmount(1, 6),
      recipient: inbound
    })

    expect(RD.isFailure(result)).toBe(true)
  })
})
