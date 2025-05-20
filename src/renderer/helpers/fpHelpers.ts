import * as RD from '@devexperts/remote-data-ts'
import type { function as F } from 'fp-ts'
import { apply } from 'fp-ts'
import { array as A } from 'fp-ts'
import { option as O } from 'fp-ts'

const { sequenceS, sequenceT } = apply

/**
 * Sequence
 */

export const sequenceTOption = sequenceT(O.Apply)
export const sequenceTOptionFromArray = A.sequence(O.Applicative)
export const sequenceSOption = sequenceS(O.Applicative)

export const sequenceTRD = sequenceT(RD.remoteData)
export const sequenceTRDFromArray = A.sequence(RD.remoteData)

type Lazy<T> = F.Lazy<T>

/**
 * Creation
 */
export const rdFromOption =
  <L, A>(onNone: Lazy<L>) =>
  (v: O.Option<A>) =>
    RD.fromOption(v, onNone)

export const rdAltOnPending =
  <L, A>(onPending: () => RD.RemoteData<L, A>) =>
  (rd: RD.RemoteData<L, A>): RD.RemoteData<L, A> => {
    if (RD.isPending(rd)) {
      return onPending()
    }
    return rd
  }
