import * as RD from '@devexperts/remote-data-ts'
import { apply, array as A, option as O } from 'fp-ts'

const { sequenceS, sequenceT } = apply

/**
 * Sequence
 */

export const sequenceTOption = sequenceT(O.Apply)
export const sequenceTOptionFromArray = A.sequence(O.Applicative)
export const sequenceSOption = sequenceS(O.Applicative)

export const sequenceTRD = sequenceT(RD.remoteData)
