import { function as FP, option as O } from 'fp-ts'
import * as IO from 'io-ts'
import * as PR from 'io-ts/lib/PathReporter'

export const optionFromNullableString = O.fromPredicate<string | undefined | null, string>((s): s is string => !!s)

export const integerFromNullableString = (s?: string | null): O.Option<number> =>
  FP.pipe(s, optionFromNullableString, O.map(parseInt), O.chain(O.fromPredicate((v) => !isNaN(v))))

export const naturalNumberFromNullableString = (s?: string | null): O.Option<number> =>
  FP.pipe(s, integerFromNullableString, O.chain(O.fromPredicate((v) => v >= 0)))

export const mapIOErrors = (errors: IO.Errors) => new Error(PR.failure(errors).join('\n'))
