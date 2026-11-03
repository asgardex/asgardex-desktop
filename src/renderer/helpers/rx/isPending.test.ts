import * as RD from '@devexperts/remote-data-ts'
import * as Rx from 'rxjs'

import { isPending$ } from './isPending'

describe('helpers/rx/isPending', () => {
  it('emits true while pending and false otherwise, without repeating values', () => {
    const source$ = new Rx.Subject<RD.RemoteData<Error, number>>()
    const result: boolean[] = []
    isPending$(source$).subscribe((v) => result.push(v))

    source$.next(RD.pending)
    source$.next(RD.pending)
    source$.next(RD.success(1))
    source$.next(RD.success(1))
    source$.next(RD.pending)
    source$.next(RD.failure(new Error('fail')))

    expect(result).toEqual([true, false, true, false])
  })

  it('replays the current value to late subscribers', () => {
    const source$ = new Rx.BehaviorSubject<RD.RemoteData<Error, number>>(RD.pending)
    const shared$ = isPending$(source$)
    shared$.subscribe()
    source$.next(RD.success(1))

    const late: boolean[] = []
    shared$.subscribe((v) => late.push(v))
    expect(late).toEqual([false])
  })
})
