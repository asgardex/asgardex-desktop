import * as RD from '@devexperts/remote-data-ts'
import { option as O } from 'fp-ts'
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs'
import { vi } from 'vitest'

import { WalletType } from '../../../shared/wallet/types'

vi.mock('../storage/userChainTokens', () => ({
  getUserAssetsByChain$: () => new BehaviorSubject([]),
  addAsset: () => {},
  removeAsset: () => {}
}))
vi.mock('../app/service', async () => {
  const { BehaviorSubject } = await import('rxjs')
  return { network$: new BehaviorSubject('mainnet') }
})

const { createTransactionService, XMR_SEND_DISABLED_MSG } = await import('./transaction')

const params = {
  walletType: WalletType.Keystore,
  recipient: '4Abc',
  amount: { amount: () => 1 },
  asset: { chain: 'XMR', symbol: 'XMR', ticker: 'XMR', type: 0 },
  memo: '',
  walletAccount: 0,
  walletIndex: 0,
  hdMode: 'default'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

const setup = () => {
  const client = {
    transfer: vi.fn(() => Promise.resolve('hash')),
    broadcastTx: vi.fn(() => Promise.resolve('hash')),
    getTransactions: vi.fn(() => Promise.resolve({ total: 0, txs: [] })),
    getTransactionData: vi.fn()
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client$ = new BehaviorSubject<O.Option<any>>(O.some(client))
  return { client, service: createTransactionService(client$) }
}

describe('services/monero/transaction (watch-only)', () => {
  it('sendTx always fails with an explanatory error and never touches the client', async () => {
    const { client, service } = setup()
    const result = await firstValueFrom(service.sendTx(params) as Observable<RD.RemoteData<{ msg: string }, string>>)
    expect(RD.isFailure(result)).toBe(true)
    expect(RD.isFailure(result) && result.error.msg).toBe(XMR_SEND_DISABLED_MSG)
    expect(client.transfer).not.toHaveBeenCalled()
    expect(client.broadcastTx).not.toHaveBeenCalled()
  })

  it('subscribeTx stores the failure and never touches the client', async () => {
    const { client, service } = setup()
    const states: RD.RemoteData<{ msg: string }, string>[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = (service.txRD$ as Observable<any>).subscribe((s) => states.push(s))
    service.subscribeTx(params)
    expect(RD.isFailure(states[states.length - 1])).toBe(true)
    service.resetTx()
    expect(RD.isInitial(states[states.length - 1])).toBe(true)
    expect(client.transfer).not.toHaveBeenCalled()
    sub.unsubscribe()
  })

  it('does not expose sending through other members', () => {
    const { service } = setup()
    expect(Object.keys(service).sort()).toEqual(
      ['resetTx', 'sendTx', 'subscribeTx', 'tx$', 'txRD$', 'txStatus$', 'txs$'].sort()
    )
  })
})
