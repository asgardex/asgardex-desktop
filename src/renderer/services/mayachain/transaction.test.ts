import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao, Client } from '@xchainjs/xchain-mayachain'
import { baseAmount } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'
import { describe, expect, it, vi } from 'vitest'

import { WalletType } from '../../../shared/wallet/types'
import { DEFAULT_CLIENT_URL } from '../thorchain/const'
import { ErrorId } from '../wallet/types'
import { createTransactionService } from './transaction'

describe('services/mayachain/transaction depositTx', () => {
  const network$ = Rx.of(Network.Mainnet)
  const clientUrl$ = Rx.of(DEFAULT_CLIENT_URL)

  const resolveDeposit = (client: Client) => {
    const { sendPoolTx$ } = createTransactionService(Rx.of(O.some(client)), network$, clientUrl$)
    return Rx.firstValueFrom(
      sendPoolTx$({
        walletType: WalletType.Keystore,
        walletAccount: 0,
        walletIndex: 0,
        hdMode: 'default',
        asset: AssetCacao,
        amount: baseAmount(1_00000000),
        memo: 'SWAP:BTC.BTC'
      }).pipe(
        RxOp.filter((rd) => !RD.isPending(rd)),
        RxOp.take(1)
      )
    )
  }

  it('does not retry client.deposit after an RPC-style failure', async () => {
    const deposit = vi.fn().mockRejectedValue(new Error('request timed out'))
    const client = { deposit } as unknown as Client

    vi.useFakeTimers()
    const resultPromise = resolveDeposit(client)
    await vi.runAllTimersAsync()
    const result = await resultPromise
    vi.useRealTimers()

    expect(deposit).toHaveBeenCalledTimes(1)
    expect(RD.isFailure(result)).toBe(true)
    if (RD.isFailure(result)) {
      expect(result.error.errorId).toBe(ErrorId.SEND_TX)
      expect(result.error.msg).toMatch(/timed out/i)
    }
  })

  it('returns success when deposit broadcasts once', async () => {
    const deposit = vi.fn().mockResolvedValue('txhash-once')
    const client = { deposit } as unknown as Client

    const result = await resolveDeposit(client)

    expect(deposit).toHaveBeenCalledTimes(1)
    expect(result).toEqual(RD.success('txhash-once'))
  })
})
