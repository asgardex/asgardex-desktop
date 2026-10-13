import * as RD from '@devexperts/remote-data-ts'
import { firstValueFrom, of } from 'rxjs'
import { toArray } from 'rxjs/operators'
import { describe, expect, it } from 'vitest'

import { preserveSuccess } from './preserveSuccess'

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
