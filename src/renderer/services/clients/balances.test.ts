/**
 * `balancesByAddress$` (Ledger / Vultisig balances of every chain): only the latest load counts.
 */
import * as RD from '@devexperts/remote-data-ts'
import { baseAmount } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'
import { BehaviorSubject } from 'rxjs'
import { vi } from 'vitest'

import { WalletType } from '../../../shared/wallet/types'

const userAssets = vi.hoisted(() => ({ subject: undefined as unknown as { next: (v: unknown[]) => void } }))
vi.mock('../storage/userChainTokens', async () => {
  const { BehaviorSubject } = await import('rxjs')
  const subject = new BehaviorSubject<unknown[]>([])
  userAssets.subject = subject
  return { getUserAssetsByChain$: () => subject, addAsset: () => {}, removeAsset: () => {} }
})
vi.mock('../app/service', async () => {
  const { BehaviorSubject } = await import('rxjs')
  return { network$: new BehaviorSubject('mainnet') }
})

const { balancesByAddress$ } = await import('./balances')

const RUNE = { chain: 'THOR', symbol: 'RUNE', ticker: 'RUNE', type: 0 }

type Pending = { resolve: (amount: number) => void }
const fakeClient = (name: string) => {
  const pending: Pending[] = []
  const client = {
    name,
    pending,
    getAssetInfo: () => ({ asset: RUNE }),
    getBalance: vi.fn(
      () =>
        new Promise((resolve) => {
          pending.push({ resolve: (amount) => resolve([{ asset: RUNE, amount: baseAmount(amount) }]) })
        })
    )
  }
  return client
}

const amountOf = (rd: RD.RemoteData<unknown, Array<{ amount: { amount: () => { toNumber: () => number } } }>>) =>
  RD.isSuccess(rd) ? rd.value[0].amount.amount().toNumber() : rd._tag

const setup = (client: ReturnType<typeof fakeClient>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client$ = new BehaviorSubject<O.Option<any>>(O.some(client))
  const trigger$ = new BehaviorSubject(false)
  const states: Array<number | string> = []
  const sub = balancesByAddress$({ client$, trigger$, walletBalanceType: 'all' })({
    address: 'thor1x',
    walletType: WalletType.Ledger,
    walletAccount: 0,
    walletIndex: 0,
    hdMode: 'default'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }).subscribe((rd) => states.push(amountOf(rd as any)))
  return { client$, trigger$, states, sub }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('services/clients/balances balancesByAddress$', () => {
  it('a late result of an earlier client does not overwrite the current one', async () => {
    const c1 = fakeClient('c1')
    const c2 = fakeClient('c2')
    const { client$, states, sub } = setup(c1)
    await vi.advanceTimersByTimeAsync(300) // trigger debounce
    expect(c1.getBalance).toHaveBeenCalledTimes(1)

    client$.next(O.some(c2)) // e.g. rebuilt client
    await vi.advanceTimersByTimeAsync(300)
    expect(c2.getBalance).toHaveBeenCalledTimes(1)
    c2.pending[0].resolve(2)
    await vi.advanceTimersByTimeAsync(0)
    expect(states[states.length - 1]).toBe(2)

    c1.pending[0].resolve(1) // earlier client answers late
    await vi.advanceTimersByTimeAsync(0)
    // before (`mergeMap`): 1
    expect(states[states.length - 1]).toBe(2)
    sub.unsubscribe()
  })

  it('a late result of an earlier reload does not overwrite a newer one', async () => {
    const c = fakeClient('c')
    const { trigger$, states, sub } = setup(c)
    await vi.advanceTimersByTimeAsync(300)
    c.pending[0].resolve(1)
    await vi.advanceTimersByTimeAsync(0)
    trigger$.next(true)
    await vi.advanceTimersByTimeAsync(300)
    trigger$.next(true)
    await vi.advanceTimersByTimeAsync(300)
    expect(c.getBalance).toHaveBeenCalledTimes(3)
    c.pending[2].resolve(3)
    await vi.advanceTimersByTimeAsync(0)
    c.pending[1].resolve(2) // earlier reload answers late
    await vi.advanceTimersByTimeAsync(0)
    // before (`mergeMap`): 2
    expect(states[states.length - 1]).toBe(3)
    sub.unsubscribe()
  })

  it('a token change after several reloads sends one request', async () => {
    const c = fakeClient('c')
    const { trigger$, sub } = setup(c)
    await vi.advanceTimersByTimeAsync(300)
    for (let i = 0; i < 3; i++) {
      trigger$.next(true)
      await vi.advanceTimersByTimeAsync(300)
    }
    c.pending.forEach((p) => p.resolve(1))
    await vi.advanceTimersByTimeAsync(0)
    expect(c.getBalance).toHaveBeenCalledTimes(4)

    userAssets.subject.next([{ chain: 'THOR', symbol: 'TCY', ticker: 'TCY', type: 0 }])
    await vi.advanceTimersByTimeAsync(0)
    // before (`mergeMap`): 4 (every earlier load was still subscribed to the user assets)
    expect(c.getBalance).toHaveBeenCalledTimes(5)
    sub.unsubscribe()
  })
})
