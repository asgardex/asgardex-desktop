import * as RD from '@devexperts/remote-data-ts'
import * as Rx from 'rxjs'
import { Observable, Subscription } from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { EnabledChain } from '../../../shared/utils/chain'
import { logger } from '../../helpers/logger'
import { userChains$, userChainsLoaded$ } from '../storage/userChains'

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)))

const isRemoteTag = (value: unknown, tag: string): boolean =>
  typeof value === 'object' && value !== null && '_tag' in value && (value as { _tag: string })._tag === tag

/**
 * A rejected import must not error the stream. `RD.initial` placeholders (client,
 * balance, fee, tx) become a failure those screens already fold. An existing
 * `RD.failure` (a disabled send or tx) keeps its error id and reports the load
 * error. Anything else keeps the empty value.
 */
const moduleFailure = <T>(fallback: T, chain: string, error: unknown): T => {
  const message = `Failed to load ${chain}: ${toError(error).message}`
  if (isRemoteTag(fallback, 'RemoteInitial')) {
    // Error for client and fee streams, plus the `msg` / `errorId` balance and tx views read.
    return RD.failure(Object.assign(new Error(message), { errorId: 'GET_BALANCES', msg: message })) as T
  }
  if (isRemoteTag(fallback, 'RemoteFailure')) {
    const current = (fallback as RD.RemoteFailure<unknown>).error
    if (typeof current === 'object' && current !== null) {
      return RD.failure({ ...current, msg: message }) as T
    }
  }
  return fallback
}

const loadModule = <M, T>(
  chain: string,
  load: () => Promise<M>,
  pick: (mod: M) => Observable<T>,
  fallback: T
): Observable<T> =>
  Rx.from(
    load().then(
      (mod) => ({ ok: true as const, mod }),
      (error: unknown) => {
        logger.error(`failed to load ${chain}`, error)
        return { ok: false as const, error }
      }
    )
  ).pipe(
    RxOp.switchMap((result) => (result.ok ? pick(result.mod) : Rx.of(moduleFailure(fallback, chain, result.error))))
  )

/** A cached loader. `peek` is synchronous once `load` has resolved, so hot streams can replay in the subscribe turn. */
export type ChainLoader<T> = (() => Promise<T>) & { peek: () => T | undefined }

const resolved = new Map<string, unknown>()
const loaders = new Map<string, Promise<unknown>>()

export const loadChainModule = <T>(key: string, load: () => Promise<T>): ChainLoader<T> => {
  const loader = (() => {
    const done = resolved.get(key) as T | undefined
    if (done) return Promise.resolve(done)
    const existing = loaders.get(key) as Promise<T> | undefined
    if (existing) return existing
    const pending = load().then(
      (mod) => {
        resolved.set(key, mod)
        loaders.delete(key)
        return mod
      },
      (error) => {
        loaders.delete(key)
        throw error
      }
    )
    loaders.set(key, pending)
    return pending
  }) as ChainLoader<T>
  loader.peek = () => resolved.get(key) as T | undefined
  return loader
}

/**
 * Long-lived stream. Emits `empty` until `enabledChains` includes the chain, then the real module stream.
 * A later enable still loads. Membership changes restart the inner stream; identical lists do not.
 */
export const followChain = <M, T>(
  chain: EnabledChain,
  load: ChainLoader<M>,
  pick: (mod: M) => Observable<T>,
  empty: T
): Observable<T> =>
  userChains$.pipe(
    RxOp.map((chains) => chains.includes(chain)),
    RxOp.distinctUntilChanged(),
    RxOp.switchMap((on) => {
      if (!on) return Rx.of(empty)
      // A resolved module must be subscribed in this turn. `Rx.from(promise)` always
      // waits a microtask, and ImportPhrase treats that extra pending frame as a stuck lock.
      const ready = load.peek()
      if (ready) return pick(ready)
      // Failure stays a value, so this subscription can retry on the next enable.
      return loadModule(chain, load, pick, empty)
    }),
    RxOp.shareReplay({ bufferSize: 1, refCount: true })
  )

/**
 * One-shot. Waits until chain storage has settled, then either runs the module or emits `disabled`.
 * Completes when the inner observable completes, so sends and tx lookups do not stay open.
 */
export const onceChain = <M, T>(
  chain: EnabledChain,
  load: () => Promise<M>,
  pick: (mod: M) => Observable<T>,
  disabled: T
): Observable<T> =>
  Rx.combineLatest([userChains$, userChainsLoaded$]).pipe(
    RxOp.filter(([, loaded]) => loaded),
    RxOp.take(1),
    RxOp.switchMap(([chains]) => (chains.includes(chain) ? loadModule(chain, load, pick, disabled) : Rx.of(disabled)))
  )

/** Fire-and-forget after storage settles. No-op when the chain is disabled. */
export const runChain = <M>(chain: EnabledChain, load: () => Promise<M>, run: (mod: M) => void): void => {
  Rx.combineLatest([userChains$, userChainsLoaded$])
    .pipe(
      RxOp.filter(([, loaded]) => loaded),
      RxOp.take(1)
    )
    .subscribe(([chains]) => {
      if (!chains.includes(chain)) return
      void load()
        .then((mod) => run(mod))
        .catch((error: unknown) => {
          logger.error(`failed to load ${chain}`, error)
        })
    })
}

export const subscribeChain = <M, A>(
  chain: EnabledChain,
  load: () => Promise<M>,
  subscribe: (mod: M, arg: A) => Subscription,
  arg: A
): Subscription => {
  const subscription = new Subscription()
  const gate = Rx.combineLatest([userChains$, userChainsLoaded$])
    .pipe(
      RxOp.filter(([, loaded]) => loaded),
      RxOp.take(1)
    )
    .subscribe(([chains]) => {
      if (!chains.includes(chain)) return
      void load()
        .then((mod) => {
          if (subscription.closed) return
          subscription.add(subscribe(mod, arg))
        })
        .catch((error: unknown) => {
          logger.error(`failed to load ${chain}`, error)
        })
    })
  subscription.add(gate)
  return subscription
}

export const disabledSend = (chain: string) =>
  RD.failure({ errorId: 'SEND_TX' as const, msg: `${chain} is not enabled` })

export const disabledTx = (chain: string) => RD.failure({ errorId: 'GET_TX' as const, msg: `${chain} is not enabled` })

export const disabledTxs = (chain: string) =>
  RD.failure({ errorId: 'GET_ASSET_TXS' as const, msg: `${chain} is not enabled` })
