import { Address, Chain } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { WalletAddress, WalletType } from '../../../shared/wallet/types'
import { removeAddressPrefix } from '../../helpers/addressHelper'
import { WalletAddress$, XChainClient$ } from '../clients/types'
import { appWalletService } from '../wallet/appWallet'
import { isStandaloneLedgerMode } from '../wallet/types'

export const addressUI$: (client$: XChainClient$, chain: Chain) => WalletAddress$ = (client$, chain) =>
  Rx.combineLatest([client$, appWalletService.appWalletState$]).pipe(
    RxOp.switchMap(([oClient, appWalletState]) => {
      // Check if we're in standalone ledger mode and have an address for this chain
      if (appWalletState && isStandaloneLedgerMode(appWalletState)) {
        const standaloneLedgerState = appWalletState
        const standaloneLedgerAddress =
          standaloneLedgerState.address && standaloneLedgerState.address.chain === chain
            ? standaloneLedgerState.address
            : undefined

        if (standaloneLedgerAddress) {
          // Return standalone ledger address with full WalletAddress data
          return Rx.of<O.Option<WalletAddress>>(
            O.some({
              address: standaloneLedgerAddress.address,
              chain: standaloneLedgerAddress.chain,
              type: standaloneLedgerAddress.type, // This should be WalletType.Ledger
              walletAccount: standaloneLedgerAddress.walletAccount,
              walletIndex: standaloneLedgerAddress.walletIndex,
              hdMode: standaloneLedgerAddress.hdMode
            })
          )
        }
      }

      // Fall back to client address (keystore mode)
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
