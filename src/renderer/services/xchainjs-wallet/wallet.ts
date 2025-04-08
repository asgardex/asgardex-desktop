import * as RD from '@devexperts/remote-data-ts'
import { Client as ArbClient } from '@xchainjs/xchain-arbitrum'
import { Client as AvaxClient } from '@xchainjs/xchain-avax'
import { Client as BaseClient } from '@xchainjs/xchain-base'
import { Client as BscClient } from '@xchainjs/xchain-bsc'
import { Client as EthClient } from '@xchainjs/xchain-ethereum'
import { Address, Chain } from '@xchainjs/xchain-util'
import { Wallet } from '@xchainjs/xchain-wallet'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { defaultArbParams } from '../../../shared/arb/const'
import { defaultAvaxParams } from '../../../shared/avax/const'
import { defaultBaseParams } from '../../../shared/base/const'
import { defaultBscParams } from '../../../shared/bsc/const'
import { defaultEthParams } from '../../../shared/ethereum/const'
import { isError } from '../../../shared/utils/guard'
import { WalletAddress, WalletType } from '../../../shared/wallet/types'
import { clientNetwork$ } from '../app/service'
import { WalletAddress$ } from '../clients'
import { Wallet$, WalletState, WalletState$ } from '../evm/types'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'

/**
 */
const walletState$: WalletState$ = FP.pipe(
  Rx.combineLatest([keystoreService.keystoreState$, clientNetwork$]),
  RxOp.switchMap(
    ([keystore, network]): WalletState$ =>
      Rx.of(
        FP.pipe(
          getPhrase(keystore),
          O.map<string, WalletState>((phrase) => {
            try {
              const wallet = new Wallet({
                ETH: new EthClient({
                  ...defaultEthParams,
                  phrase,
                  network
                }),
                BSC: new BscClient({
                  ...defaultBscParams,
                  phrase,
                  network
                }),
                AVAX: new AvaxClient({
                  ...defaultAvaxParams,
                  phrase,
                  network
                }),
                ARB: new ArbClient({
                  ...defaultArbParams,
                  phrase,
                  network
                }),
                BASE: new BaseClient({
                  ...defaultBaseParams,
                  phrase,
                  network
                })
              })
              return RD.success(wallet)
            } catch (error) {
              return RD.failure<Error>(isError(error) ? error : new Error('Failed to create wallet'))
            }
          }),
          // Set back to `initial` if no phrase is available (locked wallet)
          O.getOrElse<WalletState>(() => RD.initial)
        )
      ).pipe(RxOp.startWith(RD.pending))
  ),
  RxOp.startWith<WalletState>(RD.initial),
  RxOp.shareReplay(1)
)

const wallet$: Wallet$ = walletState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

const getAddress$ = (chain: Chain): WalletAddress$ =>
  FP.pipe(
    wallet$,
    RxOp.switchMap(
      O.fold(
        () => Rx.of<O.Option<WalletAddress>>(O.none),
        (wallet) =>
          Rx.from(wallet.getAddress(chain)).pipe(
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
  )

type ExplorerUrl$ = Rx.Observable<O.Option<string>>

const getExplorerAddressUrl$ = (chain: Chain, address: Address): ExplorerUrl$ =>
  wallet$.pipe(
    RxOp.switchMap(
      O.fold(
        () => Rx.of(O.none as O.Option<string>),
        (wallet) =>
          Rx.from(wallet.getExplorerAddressUrl(chain, address)).pipe(
            RxOp.map((url: string) => O.some(url)),
            RxOp.catchError(() => Rx.of(O.none as O.Option<string>))
          )
      )
    )
  )

export { wallet$, getAddress$, getExplorerAddressUrl$ }

// /**
//  * Current `Address` depending on selected network
//  */
// const address$: WalletAddress$ = C.address$(client$, ARBChain)

// /**
//  * Current `Address` depending on selected network
//  */
// const addressUI$: WalletAddress$ = C.addressUI$(client$, ARBChain)

// /**
//  * Explorer url depending on selected network
//  */
// const explorerUrl$: ExplorerUrl$ = C.explorerUrl$(client$)

// export { client$, clientState$, address$, addressUI$, explorerUrl$ }
