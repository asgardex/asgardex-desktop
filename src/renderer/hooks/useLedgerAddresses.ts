import * as RD from '@devexperts/remote-data-ts'
import { function as FP } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import { INITIAL_LEDGER_ADDRESSES } from '../services/wallet/const'
import { LedgerAddresses, LedgerAddressesRD } from '../services/wallet/types'
import { useWalletContext } from 'contexts/WalletContext'

export const useLedgerAddresses = (): {
  ledgerAddressesPersistentRD: LedgerAddressesRD
  reloadPersistentLedgerAddresses: FP.Lazy<void>
  ledgerAddresses: LedgerAddresses
} => {
  const { reloadPersistentLedgerAddresses, persistentLedgerAddresses$, ledgerAddresses$ } = useWalletContext()

  const ledgerAddressesPersistentRD = useObservableState(persistentLedgerAddresses$, RD.initial)
  const ledgerAddresses = useObservableState(ledgerAddresses$, INITIAL_LEDGER_ADDRESSES)

  return { ledgerAddressesPersistentRD, ledgerAddresses, reloadPersistentLedgerAddresses }
}
