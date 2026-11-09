import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { option as O } from 'fp-ts'
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs'
import { vi } from 'vitest'

import { acknowledgeXmrReceive, isXmrReceiveAcknowledged, xmrAckVersion$ } from './ack'
import { ViewOnlyXmrClient } from './client'
import { createClientState$, createPendingAck$, createViewKeys$ } from './clientState'
import { DEFAULT_XMR_CONNECTION_CONFIG, KeyValueStorage } from './config'

// BIP-39 test vector. NEVER use for funds.
const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const memoryStorage = (): KeyValueStorage => {
  const data: Record<string, string> = {}
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) }
}

/** Latest synchronously available value (the state stream emits `initial` first, then the derived state) */
const latest = <A>(obs: Observable<A>): A => {
  let value: A | undefined
  const sub = obs.subscribe((v) => (value = v))
  sub.unsubscribe()
  return value as A
}

const setup = (phrase: O.Option<string> = O.some(PHRASE), acked = false, enabled = true) => {
  const phrase$ = new BehaviorSubject<O.Option<string>>(phrase)
  const network$ = new BehaviorSubject<Network>(Network.Mainnet)
  const ackVersion$ = new BehaviorSubject(0)
  const enabled$ = new BehaviorSubject(enabled)
  const state = { acked }
  const isAcknowledged = () => state.acked
  const viewKeys$ = createViewKeys$({ phrase$, network$ })
  const clientState$ = createClientState$({
    viewKeys$,
    config$: new BehaviorSubject(DEFAULT_XMR_CONNECTION_CONFIG),
    ackVersion$,
    enabled$,
    isAcknowledged
  })
  const pendingAck$ = createPendingAck$({ viewKeys$, ackVersion$, enabled$, isAcknowledged })
  return { phrase$, network$, ackVersion$, enabled$, state, viewKeys$, clientState$, pendingAck$ }
}

describe('services/monero opt-in / receive-only acknowledgement', () => {
  const fetchSpy = vi.fn(() => Promise.reject(new Error('no network access expected')))
  beforeEach(() => {
    fetchSpy.mockClear()
    vi.stubGlobal('fetch', fetchSpy)
  })
  afterEach(() => vi.unstubAllGlobals())

  describe('opt-in: XMR not enabled by the user', () => {
    it('no client (no address, no balance, no node access) and no acknowledgement is asked, even with a wallet', async () => {
      const s = setup(O.some(PHRASE), true, false)
      expect(RD.isInitial(latest(s.clientState$))).toBe(true)
      expect(latest(s.pendingAck$)).toEqual(O.none)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('enabling XMR asks for the acknowledgement first; disabling it again removes the client', async () => {
      const s = setup(O.some(PHRASE), false, false)
      expect(latest(s.pendingAck$)).toEqual(O.none)
      s.enabled$.next(true)
      expect(O.isSome(latest(s.pendingAck$))).toBe(true)
      expect(RD.isInitial(latest(s.clientState$))).toBe(true)

      s.state.acked = true
      s.ackVersion$.next(1)
      expect(RD.isSuccess(latest(s.clientState$))).toBe(true)

      s.enabled$.next(false)
      expect(RD.isInitial(latest(s.clientState$))).toBe(true)
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe('no network access before the user acts', () => {
    it('deriving keys, creating the client state and the pending-ack stream never call fetch', async () => {
      const s = setup(O.some(PHRASE), true)
      await firstValueFrom(s.viewKeys$)
      await firstValueFrom(s.clientState$)
      await firstValueFrom(s.pendingAck$)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('after the acknowledgement the client exists, but still nothing is requested until balances are loaded', async () => {
      const s = setup(O.some(PHRASE), true)
      const state = latest(s.clientState$)
      expect(RD.isSuccess(state)).toBe(true)
      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })

  describe('receive-only acknowledgement gates the address and the client', () => {
    it('no wallet -> initial, nothing pending', async () => {
      const s = setup(O.none)
      expect(RD.isInitial(await firstValueFrom(s.clientState$))).toBe(true)
      expect(await firstValueFrom(s.pendingAck$)).toEqual(O.none)
    })

    it('wallet but not acknowledged -> no client (so no address, no balance) and an acknowledgement is pending', async () => {
      const s = setup(O.some(PHRASE), false)
      expect(RD.isInitial(await firstValueFrom(s.clientState$))).toBe(true)
      const pending = await firstValueFrom(s.pendingAck$)
      expect(O.isSome(pending)).toBe(true)
    })

    it('acknowledged -> a view-only client with the address', async () => {
      const s = setup(O.some(PHRASE), false)
      const states: Array<RD.RemoteData<Error, ViewOnlyXmrClient>> = []
      s.clientState$.subscribe((v) => states.push(v))
      expect(RD.isInitial(states[states.length - 1])).toBe(true)

      s.state.acked = true
      s.ackVersion$.next(1)

      const last = states[states.length - 1]
      expect(RD.isSuccess(last)).toBe(true)
      if (RD.isSuccess(last)) {
        expect(last.value).toBeInstanceOf(ViewOnlyXmrClient)
        expect(last.value.getAddress(0).startsWith('4')).toBe(true)
      }
      expect(await firstValueFrom(s.pendingAck$)).toEqual(O.none)
    })

    it('locking the wallet removes the client again', async () => {
      const s = setup(O.some(PHRASE), true)
      expect(RD.isSuccess(latest(s.clientState$))).toBe(true)
      s.phrase$.next(O.none)
      expect(RD.isInitial(latest(s.clientState$))).toBe(true)
    })
  })

  describe('acknowledgement storage', () => {
    it('is stored per network + address and bumps the version stream', async () => {
      const storage = memoryStorage()
      expect(isXmrReceiveAcknowledged(Network.Mainnet, '4A', storage)).toBe(false)
      const before = await firstValueFrom(xmrAckVersion$)
      acknowledgeXmrReceive(Network.Mainnet, '4A', storage)
      expect(isXmrReceiveAcknowledged(Network.Mainnet, '4A', storage)).toBe(true)
      expect(isXmrReceiveAcknowledged(Network.Mainnet, '4B', storage)).toBe(false)
      expect(isXmrReceiveAcknowledged(Network.Stagenet, '4A', storage)).toBe(false)
      expect(await firstValueFrom(xmrAckVersion$)).toBe(before + 1)
    })
  })
})
