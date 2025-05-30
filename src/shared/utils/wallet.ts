import { array as A, function as FP, nonEmptyArray as NEA, option as O, string as S } from 'fp-ts'

/**
 * Helper transform a derivationPath from string to an array
 *
 * Example:
 * const a = toDerivationPathArray("44'/330'/0'/0/", "1")
 * console.log(a) // [44,330,0,0,1]
 *
 */
export const toDerivationPathArray = (
  derivationPath: string,
  walletIndex: number
): O.Option<NEA.NonEmptyArray<number>> =>
  FP.pipe(
    derivationPath,
    S.replace(/'/g, ''),
    S.split('/'),
    NEA.fromReadonlyNonEmptyArray,
    NEA.map(parseInt),
    A.append(walletIndex),
    // Validation: Accept numbers only
    NEA.filter((v: unknown) => !Number.isNaN(v)),
    // Validation: length must be 5
    O.chain(O.fromPredicate((v) => v.length === 5))
  )

export const defaultWalletName = (id: number) => `wallet-${id}`
