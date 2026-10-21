import { useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { function as FP, option as O } from 'fp-ts'

export type LastSuccessOptions = {
  resetOnFailure?: boolean
}

const keepAll = (): boolean => true

export const useLastSuccess = <E, A>(
  rd: RD.RemoteData<E, A>,
  keep: (a: A) => boolean = keepAll,
  { resetOnFailure = false }: LastSuccessOptions = {}
): O.Option<A> => {
  const [stored, setStored] = useState<O.Option<A>>(O.none)

  const kept = RD.isSuccess(rd) && keep(rd.value)
  const reset = resetOnFailure && RD.isFailure(rd)

  useEffect(() => {
    if (kept && RD.isSuccess(rd)) {
      const value = rd.value
      setStored((prev) => (O.isSome(prev) && prev.value === value ? prev : O.some(value)))
    } else if (reset) {
      setStored(O.none)
    }
  }, [rd, kept, reset])

  if (kept && RD.isSuccess(rd)) return O.some(rd.value)
  if (reset) return O.none
  return stored
}

export const useLastSuccessRD = <E, A>(rd: RD.RemoteData<E, A>): RD.RemoteData<E, A> => {
  const last = useLastSuccess(rd)
  return useMemo(
    () =>
      RD.isPending(rd)
        ? FP.pipe(
            last,
            O.fold(
              () => rd,
              (value) => RD.success(value)
            )
          )
        : rd,
    [rd, last]
  )
}
