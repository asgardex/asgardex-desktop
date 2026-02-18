import { UtxoError } from '@xchainjs/xchain-utxo'

export const getUtxoErrorMessage = (error: unknown): string | undefined => {
  if (UtxoError.isUtxoError(error)) {
    return error.getUserFriendlyMessage()
  }
  return undefined
}
