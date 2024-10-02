import { Address, Chain } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { WalletAddress } from '../../../shared/wallet/types'
import { removeAddressPrefix } from '../../helpers/addressHelper'
import { eqOString } from '../../helpers/fp/eq'
import { WalletAddress$, XChainClient$ } from '../clients/types'

export const addressUI$: (client$: XChainClient$, chain: Chain) => WalletAddress$ = (client$, chain) =>
  client$.pipe(
    RxOp.switchMap(
      O.fold(
        () => Rx.of<O.Option<Address>>(O.none),
        (client) =>
          Rx.from(client.getAddressAsync(0)).pipe(
            RxOp.map((address: Address): O.Option<Address> => O.some(address)),
            RxOp.catchError(() => Rx.of<O.Option<Address>>(O.none))
          )
      )
    ),
    RxOp.distinctUntilChanged(eqOString.equals),
    RxOp.map(
      FP.flow(
        O.map<Address, WalletAddress>((address) => ({
          address,
          chain,
          type: 'keystore',
          walletAccount: 0,
          walletIndex: 0,
          hdMode: 'default'
        }))
      )
    ),
    RxOp.shareReplay(1)
  )

export const address$: (client$: XChainClient$, chain: Chain) => WalletAddress$ = (client$, chain) =>
  FP.pipe(
    addressUI$(client$, chain),
    RxOp.map(O.map((wAddress: WalletAddress) => ({ ...wAddress, address: removeAddressPrefix(wAddress.address) })))
  )
