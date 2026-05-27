import { useCallback } from 'react'

import { Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import * as RxOp from 'rxjs/operators'

import { KeystoreId } from '../../shared/api/types'
import { HDMode, WalletAddress } from '../../shared/wallet/types'
import { useWalletContext } from '../contexts/WalletContext'
import { LedgerAddress } from '../services/wallet/types'
import { ledgerAddressToWalletAddress } from '../services/wallet/util'
import { useNetwork } from './useNetwork'

/**
 * `useLedger(chain, id)` — operates on the single Ledger entry for the chain.
 * `useLedger(chain, id, hdMode)` — scopes to the entry matching that derivation,
 * required for chains that can hold multiple Ledger addresses (BTC: P2WPKH / P2TR).
 *
 * `addAddress` / `verifyAddress` always take `hdMode` explicitly; `scopedHdMode`
 * only affects which existing entry is fetched (`address`) and which is removed.
 */
export const useLedger = (chain: Chain, id: KeystoreId, scopedHdMode?: HDMode) => {
  const { network } = useNetwork()

  const { addLedgerAddress$, getLedgerAddress$, verifyLedgerAddress$, removeLedgerAddress } = useWalletContext()

  const verifyAddress = useCallback(
    (walletAccount: number, walletIndex: number, hdMode: HDMode) =>
      verifyLedgerAddress$({ chain, network, walletAccount, walletIndex, hdMode }),
    [chain, verifyLedgerAddress$, network]
  )
  const removeAddress = useCallback(
    () => removeLedgerAddress({ id, chain, network, hdMode: scopedHdMode }),
    [removeLedgerAddress, chain, network, id, scopedHdMode]
  )
  const [address] = useObservableState(
    () =>
      FP.pipe(
        getLedgerAddress$(chain, scopedHdMode),
        // LedgerAddress -> WalletAddress
        RxOp.map<O.Option<LedgerAddress>, O.Option<WalletAddress>>(FP.flow(O.map(ledgerAddressToWalletAddress))),
        RxOp.shareReplay(1)
      ),
    O.none
  )

  const addAddress = useCallback(
    (walletAccount: number, walletIndex: number, hdMode: HDMode) =>
      addLedgerAddress$({ id, chain, network, walletAccount, walletIndex, hdMode }),
    [addLedgerAddress$, chain, id, network]
  )

  return {
    addAddress,
    verifyAddress,
    removeAddress,
    address
  }
}
