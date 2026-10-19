import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import * as RxOp from 'rxjs/operators'

import { useThorchainContext } from '../contexts/ThorchainContext'

export const useThorchainHeight = (): O.Option<number> => {
  const { thorchainLastblockState$ } = useThorchainContext()

  const height$ = useMemo(
    () =>
      thorchainLastblockState$.pipe(
        RxOp.map((lastblockRD) =>
          FP.pipe(
            lastblockRD,
            RD.toOption,
            O.chain((lastblocks) => O.fromNullable(lastblocks.find((block) => block.thorchain))),
            O.map(({ thorchain }) => thorchain),
            O.filter((height) => Number.isFinite(height) && height > 0)
          )
        ),
        RxOp.filter(O.isSome),
        RxOp.distinctUntilChanged((a, b) => a.value === b.value)
      ),
    [thorchainLastblockState$]
  )

  return useObservableState<O.Option<number>>(height$, O.none)
}
