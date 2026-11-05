// Halt inputs are keyed by network: nothing held for the previous network may be published after a switch.
import * as RD from '@devexperts/remote-data-ts'
import * as Rx from 'rxjs'
import { describe, expect, it, vi } from 'vitest'

import { INBOUND_HOLD } from '../../services/haltStatusHold'
import { failIfHeightStalled } from './failIfHeightStalled'
import { holdLastKnown } from './holdLastKnown'
import { ResetKey } from './resetKey'

type Halt = { halted: boolean }
type In<A> = RD.RemoteData<Error, A>

const setup = <A>(op: (key: ResetKey, now: () => number) => Rx.OperatorFunction<In<A>, In<A>>) => {
  let network = 'mainnet'
  let time = 0
  const changes$ = new Rx.Subject<string>()
  const source$ = new Rx.Subject<In<A>>()
  const out: In<A>[] = []
  const sub = source$.pipe(op({ get: () => network, changes$ }, () => time)).subscribe((v) => out.push(v))
  // like the app: state is updated first, upstream (preserveSuccessUntil) reacts before we see `changes$`
  const switchNetwork = (n: string, upstreamFirst?: In<A>) => {
    network = n
    if (upstreamFirst) source$.next(upstreamFirst)
    changes$.next(n)
  }
  const tick = (ms: number) => {
    time += ms
    changes$.next(network) // re-evaluation without a key change
  }
  return { source$, out, switchNetwork, tick, unsubscribe: () => sub.unsubscribe() }
}

const hold = (key: ResetKey, now: () => number) =>
  holdLastKnown<Halt>({
    maxAgeMs: 15 * 60000,
    maxFailures: 2,
    pendingTimeoutMs: 15000,
    now,
    resetKey: key,
    tickMs: 1e9
  })

describe('helpers/rx network keyed hold', () => {
  it('switching from halted to healthy: no stale halt and no stale "not halted" until the new network loads', () => {
    const { source$, out, switchNetwork, tick } = setup(hold)
    source$.next(RD.success({ halted: true }))
    expect(out.at(-1)).toEqual(RD.success({ halted: true }))
    const before = out.length

    switchNetwork('stagenet', RD.pending)
    const afterSwitch = out.slice(before)
    expect(afterSwitch.every(RD.isPending)).toBe(true)
    expect(afterSwitch.length).toBeGreaterThan(0)

    // nothing loaded within 15s -> unknown (Failure), never the old value
    tick(16000)
    expect(RD.isFailure(out.at(-1)!)).toBe(true)
    expect(out.slice(before).some(RD.isSuccess)).toBe(false)

    source$.next(RD.success({ halted: false }))
    expect(out.at(-1)).toEqual(RD.success({ halted: false }))
  })

  it('switching from healthy to halted: the previous "not halted" is never published after the switch', () => {
    const { source$, out, switchNetwork, tick } = setup(hold)
    source$.next(RD.success({ halted: false }))
    const before = out.length

    // upstream emits Pending / Failure for the new network before our key tick arrives
    switchNetwork('stagenet', RD.failure(new Error('timeout')))
    source$.next(RD.pending)
    tick(1000)
    expect(out.slice(before).some(RD.isSuccess)).toBe(false)

    source$.next(RD.success({ halted: true }))
    expect(out.at(-1)).toEqual(RD.success({ halted: true }))

    // and back: the stagenet halt does not leak into mainnet
    const back = out.length
    switchNetwork('mainnet', RD.pending)
    tick(16000)
    expect(out.slice(back).some(RD.isSuccess)).toBe(false)
    expect(RD.isFailure(out.at(-1)!)).toBe(true)
  })

  it('the stall max height resets on a switch', () => {
    const stall = (key: ResetKey, now: () => number) =>
      failIfHeightStalled<number>({ getHeight: (h) => h, stallMs: 5 * 60000, now, resetKey: key, tickMs: 1e9 })
    const { source$, out, switchNetwork, tick } = setup<number>(stall)
    source$.next(RD.success(20_000_000)) // mainnet height
    tick(1000)

    switchNetwork('stagenet', RD.pending)
    expect(RD.isPending(out.at(-1)!)).toBe(true)
    // a much lower stagenet height must count as fresh, not as "stalled below the max"
    source$.next(RD.success(500))
    expect(out.at(-1)).toEqual(RD.success(500))
    tick(4 * 60000)
    source$.next(RD.success(501))
    tick(2 * 60000) // 6 min since 500, 2 min since 501 -> still fresh
    expect(out.at(-1)).toEqual(RD.success(501))
    tick(4 * 60000) // 501 stuck > 5 min -> stalled
    expect(RD.isFailure(out.at(-1)!)).toBe(true)
  })

  it.each([
    ['upstream before changes$', true],
    ['changes$ before upstream', false]
  ])('hook order hold -> stall: no stale height after a switch, %s', (_, upstreamFirst) => {
    const op = (key: ResetKey, now: () => number) => (src: Rx.Observable<In<number>>) =>
      src.pipe(
        holdLastKnown<number>({
          maxAgeMs: 10 * 60000,
          maxFailures: 2,
          pendingTimeoutMs: 15000,
          now,
          resetKey: key,
          tickMs: 1e9
        }),
        failIfHeightStalled<number>({ getHeight: (h) => h, stallMs: 5 * 60000, now, resetKey: key, tickMs: 1e9 })
      )
    const { source$, out, switchNetwork, tick } = setup<number>(op)
    source$.next(RD.success(20_000_000))
    const before = out.length
    if (upstreamFirst) switchNetwork('stagenet', RD.pending)
    else {
      switchNetwork('stagenet')
      source$.next(RD.pending)
    }
    expect(out.slice(before).some(RD.isSuccess)).toBe(false)
    tick(16000)
    expect(RD.isFailure(out.at(-1)!)).toBe(true)
    source$.next(RD.success(500))
    expect(out.at(-1)).toEqual(RD.success(500))
  })
})

describe('services/haltStatusHold INBOUND_HOLD', () => {
  it('a held Success followed by Pending past the max age becomes unknown', () => {
    let time = 0
    const source$ = new Rx.Subject<In<string[]>>()
    const out: In<string[]>[] = []
    vi.useFakeTimers() // before subscribing: the re-check interval must run on fake timers
    source$
      .pipe(holdLastKnown<string[]>({ ...INBOUND_HOLD, resetKey: undefined, now: () => time, tickMs: 1000 }))
      .subscribe((v) => out.push(v))
    try {
      source$.next(RD.success([]))
      source$.next(RD.pending) // reload hangs
      time = 14 * 60000
      vi.advanceTimersByTime(1000)
      expect(out.at(-1)).toEqual(RD.success([])) // still within the max age
      time = 15 * 60000 + 1000
      vi.advanceTimersByTime(1000)
      expect(RD.isFailure(out.at(-1)!)).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
