import { LedgerErrorType } from '@xchainjs/ledger-thorchain'

import { LedgerErrorId } from '../../../../shared/api/types'

// TODO(@veado) Get path by using `xchain-thorchain`
export const getDerivationPath = (walletIndex: number) => [44, 931, 0, 0, walletIndex]

export const fromLedgerErrorType = (error: number): LedgerErrorId => {
  switch (error) {
    case LedgerErrorType.DeviceIsBusy:
      return LedgerErrorId.ALREADY_IN_USE
    case LedgerErrorType.SignVerifyError:
      return LedgerErrorId.SIGN_FAILED
    case LedgerErrorType.AppDoesNotSeemToBeOpen:
      return LedgerErrorId.NO_APP
    case LedgerErrorType.DataIsInvalid:
    case LedgerErrorType.EmptyBuffer:
    case LedgerErrorType.WrongLength:
    case LedgerErrorType.OutputBufferTooSmall:
      return LedgerErrorId.INVALID_DATA
    case LedgerErrorType.TransactionRejected:
      return LedgerErrorId.REJECTED
    case LedgerErrorType.BadKeyHandle:
      return LedgerErrorId.INVALID_PUBKEY
    case LedgerErrorType.UnknownResponse:
      return LedgerErrorId.INVALID_RESPONSE
    case LedgerErrorType.U2FTimeout:
    case LedgerErrorType.Timeout:
      return LedgerErrorId.TIMEOUT
    default:
      return LedgerErrorId.UNKNOWN
  }
}
