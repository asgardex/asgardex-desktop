import * as RD from '@devexperts/remote-data-ts'
import { BehaviorSubject, firstValueFrom, of, Subject } from 'rxjs'
import { toArray } from 'rxjs/operators'
import { describe, expect, it } from 'vitest'

import { preserveSuccess, preserveSuccessUntil } from './preserveSuccess'

describe('preserveSuccess', () => {
  it('keeps the last success while a reload is pending', async () => {
    const error = new Error('failed')
    const emitted = await firstValueFrom(
      of(RD.pending, RD.success('a'), RD.pending, RD.success('b'), RD.failure(error)).pipe(preserveSuccess, toArray())
    )

    expect(emitted).toEqual([RD.pending, RD.success('a'), RD.success('b'), RD.failure(error)])
  })

  it('lets a pending through again after a failure', async () => {
    const emitted = await firstValueFrom(
      of(RD.success(1), RD.failure(new Error('x')), RD.pending, RD.success(2)).pipe(preserveSuccess, toArray())
    )

    expect(emitted.map((value) => value._tag)).toEqual([
      'RemoteSuccess',
      'RemoteFailure',
      'RemotePending',
      'RemoteSuccess'
    ])
  })
})

describe('preserveSuccessUntil', () => {
  it('drops the held success when the network changes, then accepts the next pending', () => {
    const reset$ = new BehaviorSubject('mainnet')
    const source$ = new Subject<RD.RemoteData<Error, string>>()
    const emitted: RD.RemoteData<Error, string>[] = []
    const subscription = source$.pipe(preserveSuccessUntil(reset$)).subscribe((value) => emitted.push(value))

    source$.next(RD.pending)
    source$.next(RD.success('mainnet-vault'))
    source$.next(RD.pending)
    reset$.next('stagenet')
    source$.next(RD.pending)
    source$.next(RD.success('stagenet-vault'))
    subscription.unsubscribe()

    expect(emitted).toEqual([RD.pending, RD.success('mainnet-vault'), RD.pending, RD.success('stagenet-vault')])
  })
})
