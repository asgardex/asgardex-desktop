import { Address, Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { WalletAddress, WalletType } from '../../../shared/wallet/types'
import { removeAddressPrefix } from '../../helpers/addressHelper'
import { WalletAddress$, XChainClient$ } from '../clients/types'
import { appWalletService } from '../wallet/appWallet'
import { isStandaloneLedgerMode } from '../wallet/types'

/**
 * Unified address resolution (Phase 5C)
 *
 * Uses appWalletService unified methods - ONE call to know wallet state.
 * No scattered mode checks - the service handles routing internally.
 *
 * Flow:
 * 1. Try getAddressForChain$ (handles Vultisig and Ledger)
 * 2. If O.none (Keystore mode), fall back to xchainjs client
 */
export const addressUI$: (client$: XChainClient$, chain: Chain) => WalletAddress$ = (client$, chain) =>
  Rx.combineLatest([client$, appWalletService.getAddressForChain$(chain), appWalletService.appWalletState$]).pipe(
    RxOp.switchMap(([oClient, unifiedAddress, appState]) => {
      // If unified method returned an address (Vultisig or Ledger mode)
      if (O.isSome(unifiedAddress)) {
        const walletType = appWalletService.getCurrentWalletType()

        // In Ledger standalone mode, preserve the full WalletAddress metadata
        // (walletAccount, walletIndex, hdMode) from the state
        if (isStandaloneLedgerMode(appState) && appState.address) {
          return Rx.of<O.Option<WalletAddress>>(O.some(appState.address))
        }

        return Rx.of<O.Option<WalletAddress>>(
          O.some({
            address: unifiedAddress.value,
            chain,
            type: walletType,
            walletAccount: 0,
            walletIndex: 0,
            hdMode: 'default'
          })
        )
      }

      // Keystore mode - use xchainjs client to derive address from phrase
      return FP.pipe(
        oClient,
        O.fold(
          () => Rx.of<O.Option<WalletAddress>>(O.none),
          (client) =>
            Rx.from(client.getAddressAsync(0)).pipe(
              RxOp.map(
                (address: Address): O.Option<WalletAddress> =>
                  O.some({
                    address,
                    chain,
                    type: WalletType.Keystore,
                    walletAccount: 0,
                    walletIndex: 0,
                    hdMode: 'default'
                  })
              ),
              RxOp.catchError(() => Rx.of<O.Option<WalletAddress>>(O.none))
            )
        )
      )
    }),
    RxOp.distinctUntilChanged((a, b) => {
      return O.getEq({
        equals: (x: WalletAddress, y: WalletAddress) =>
          x.address === y.address && x.type === y.type && x.chain === y.chain
      }).equals(a, b)
    }),
    RxOp.shareReplay(1)
  )

export const address$: (client$: XChainClient$, chain: Chain) => WalletAddress$ = (client$, chain) =>
  FP.pipe(
    addressUI$(client$, chain),
    RxOp.map(O.map((wAddress: WalletAddress) => ({ ...wAddress, address: removeAddressPrefix(wAddress.address) })))
  )
