import * as RD from '@devexperts/remote-data-ts'
import { BehaviorSubject } from 'rxjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BTCChain } from '../../../shared/utils/chainIds'
import { userChains$, userChainsLoaded$ } from '../storage/userChains'
import { followChain, loadChainModule } from './lazyChain'

vi.mock('../storage/userChains', async () => {
  const { BehaviorSubject } = await import('rxjs')
  return {
    userChains$: new BehaviorSubject<string[]>([]),
    userChainsLoaded$: new BehaviorSubject(false)
  }
})

const chains$ = userChains$ as BehaviorSubject<string[]>
const loaded$ = userChainsLoaded$ as BehaviorSubject<boolean>

describe('followChain', () => {
  beforeEach(() => {
    chains$.next([])
    loaded$.next(true)
  })

  it('replays an already loaded module in the subscribe turn', async () => {
    const state$ = new BehaviorSubject(RD.success(true))
    const load = loadChainModule('btc-sync-test', async () => ({ state$ }))
    await load()

    chains$.next([BTCChain])
    const seen: Array<RD.RemoteData<never, boolean>> = []
    const sub = followChain(BTCChain, load, (mod) => mod.state$, RD.initial).subscribe((value) => seen.push(value))

    expect(seen).toEqual([RD.success(true)])
    sub.unsubscribe()
  })
})
