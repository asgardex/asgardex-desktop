import * as RD from '@devexperts/remote-data-ts'
import { option as O } from 'fp-ts'
import { BehaviorSubject, of } from 'rxjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BTCChain } from '../../../shared/utils/chainIds'
import { logger } from '../../helpers/logger'
import { userChains$, userChainsLoaded$ } from '../storage/userChains'
import { disabledSend, followChain, loadChainModule, onceChain, runChain, subscribeChain } from './lazyChain'

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

  it('emits a failure value when the import rejects, and retries on the next enable', async () => {
    const load = vi
      .fn<() => Promise<{ state$: ReturnType<typeof of> }>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ state$: of(RD.success(true)) })
    const loader = loadChainModule('btc-reject-retry', load)
    chains$.next([BTCChain])

    const seen: Array<RD.RemoteData<Error, boolean>> = []
    const errors: unknown[] = []
    const state$ = followChain(BTCChain, loader, (mod) => mod.state$, RD.initial)
    const sub = state$.subscribe({
      next: (value) => seen.push(value),
      error: (error) => errors.push(error)
    })

    await vi.waitFor(() => expect(seen.some(RD.isFailure)).toBe(true))
    expect(errors).toEqual([])
    const failure = seen.find(RD.isFailure)
    expect(failure && RD.isFailure(failure) ? failure.error.message : '').toContain('Failed to load BTC: boom')
    expect(failure && RD.isFailure(failure) ? (failure.error as { msg?: string }).msg : '').toContain(
      'Failed to load BTC: boom'
    )

    chains$.next([])
    chains$.next([BTCChain])

    await vi.waitFor(() => expect(seen.at(-1)).toEqual(RD.success(true)))
    expect(load).toHaveBeenCalledTimes(2)
    expect(errors).toEqual([])
    sub.unsubscribe()
  })

  it('retries a rejected import when the stream is subscribed again', async () => {
    const load = vi
      .fn<() => Promise<{ state$: ReturnType<typeof of> }>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ state$: of(RD.success(true)) })
    const loader = loadChainModule('btc-resubscribe', load)
    chains$.next([BTCChain])
    const state$ = followChain(BTCChain, loader, (mod) => mod.state$, RD.initial)

    const first: Array<RD.RemoteData<Error, boolean>> = []
    const sub = state$.subscribe((value) => first.push(value))
    await vi.waitFor(() => expect(first.some(RD.isFailure)).toBe(true))
    sub.unsubscribe()

    const second: Array<RD.RemoteData<Error, boolean>> = []
    const sub2 = state$.subscribe((value) => second.push(value))
    await vi.waitFor(() => expect(second.at(-1)).toEqual(RD.success(true)))
    expect(load).toHaveBeenCalledTimes(2)
    sub2.unsubscribe()
  })

  it('keeps a non-remote empty value when the import rejects', async () => {
    chains$.next([BTCChain])
    const seen: Array<O.Option<string>> = []
    const errors: unknown[] = []
    const sub = followChain(
      BTCChain,
      loadChainModule('btc-option-empty', () => Promise.reject(new Error('boom'))),
      (mod: { address$: ReturnType<typeof of> }) => mod.address$,
      O.none
    ).subscribe({
      next: (value) => seen.push(value),
      error: (error) => errors.push(error)
    })

    await vi.waitFor(() => expect(seen).toEqual([O.none]))
    expect(errors).toEqual([])
    sub.unsubscribe()
  })
})

describe('onceChain', () => {
  beforeEach(() => {
    chains$.next([BTCChain])
    loaded$.next(true)
  })

  it('emits a load failure instead of the disabled-chain message when the import rejects', async () => {
    const seen: Array<RD.RemoteData<{ errorId: string; msg: string }, boolean>> = []
    const errors: unknown[] = []
    const sub = onceChain(
      BTCChain,
      () => Promise.reject(new Error('boom')),
      () => of(RD.success(true)),
      disabledSend(BTCChain)
    ).subscribe({
      next: (value) => seen.push(value),
      error: (error) => errors.push(error)
    })

    await vi.waitFor(() => expect(seen).toHaveLength(1))
    expect(errors).toEqual([])
    expect(RD.isFailure(seen[0])).toBe(true)
    if (RD.isFailure(seen[0])) {
      expect(seen[0].error.errorId).toBe('SEND_TX')
      expect(seen[0].error.msg).toBe('Failed to load BTC: boom')
    }
    sub.unsubscribe()
  })
})

describe('runChain and subscribeChain', () => {
  beforeEach(() => {
    chains$.next([BTCChain])
    loaded$.next(true)
    vi.spyOn(logger, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs a rejected import from runChain instead of leaving an unhandled rejection', async () => {
    runChain(
      BTCChain,
      () => Promise.reject(new Error('boom')),
      () => undefined
    )
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalledWith('failed to load BTC', expect.any(Error)))
  })

  it('logs a rejected import from subscribeChain and does not subscribe', async () => {
    const subscribe = vi.fn()
    const subscription = subscribeChain(BTCChain, () => Promise.reject(new Error('boom')), subscribe, undefined)
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalledWith('failed to load BTC', expect.any(Error)))
    expect(subscribe).not.toHaveBeenCalled()
    subscription.unsubscribe()
  })
})
