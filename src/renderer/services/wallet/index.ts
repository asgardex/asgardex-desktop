import { Chain } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { WalletType } from '../../../shared/wallet/types'
import { network$ } from '../app/service'
import { userChains$ } from '../storage/userChains'
import { appWalletService } from './appWallet'
import { createBalancesService } from './balances'
import { setSelectedAsset, selectedAsset$, client$ } from './common'
import { keystoreService, removeKeystoreWallet } from './keystore'
import { createLedgerService } from './ledger'
import { getTxs$, loadTxs, explorerUrl$, resetTxsPage } from './transaction'
import { isStandaloneLedgerMode } from './types'

const {
  addLedgerAddress$,
  getLedgerAddress$,
  verifyLedgerAddress$,
  removeLedgerAddress,
  currentLedgerAddresses$: ledgerAddresses$,
  reloadPersistentLedgerAddresses,
  persistentLedgerAddresses$
} = createLedgerService({
  keystore$: keystoreService.keystoreState$,
  wallets$: keystoreService.keystoreWalletsUI$,
  network$
})

// Enhanced getLedgerAddress$ that also considers standalone ledger addresses
const enhancedGetLedgerAddress$ = (chain: Chain) => {
  return Rx.combineLatest([getLedgerAddress$(chain), appWalletService.appWalletState$, network$]).pipe(
    RxOp.map(([regularLedgerAddress, appWalletState, network]) => {
      // If we have a regular ledger address, return it
      if (regularLedgerAddress && O.isSome(regularLedgerAddress)) {
        return regularLedgerAddress
      }

      // If we're in standalone ledger mode, look for the single address
      if (appWalletState && 'mode' in appWalletState && appWalletState.mode === 'standalone-ledger') {
        const standaloneLedgerState = appWalletState
        const address = standaloneLedgerState.address

        if (address && address.chain === chain) {
          // Convert WalletAddress to LedgerAddress format
          return O.some({
            address: address.address,
            chain: address.chain,
            walletAccount: address.walletAccount,
            walletIndex: address.walletIndex,
            hdMode: address.hdMode,
            keystoreId: -1, // Use a special ID for standalone mode
            network: network,
            type: WalletType.Ledger as const
          })
        }
      }

      return O.none
    }),
    RxOp.distinctUntilChanged()
  )
}

const { reloadBalances, reloadBalancesByChain, balancesState$, chainBalances$ } = createBalancesService({
  keystore$: keystoreService.keystoreState$,
  network$,
  getLedgerAddress$: enhancedGetLedgerAddress$,
  userChains$,
  appWalletService,
  isStandaloneLedgerMode
})

/**
 * Exports all functions and observables needed at UI level (provided by `WalletContext`)
 */
export {
  client$,
  keystoreService,
  removeKeystoreWallet,
  setSelectedAsset,
  selectedAsset$,
  loadTxs,
  resetTxsPage,
  explorerUrl$,
  getTxs$,
  reloadBalances,
  reloadBalancesByChain,
  balancesState$,
  chainBalances$,
  ledgerAddresses$,
  addLedgerAddress$,
  verifyLedgerAddress$,
  removeLedgerAddress,
  reloadPersistentLedgerAddresses,
  persistentLedgerAddresses$,
  // New app wallet service exports
  appWalletService
}

// Override the getLedgerAddress$ export to use the enhanced version
export { enhancedGetLedgerAddress$ as getLedgerAddress$ }
