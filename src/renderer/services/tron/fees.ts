import * as RD from '@devexperts/remote-data-ts'
import { TRONChain } from '@xchainjs/xchain-tron'
import { Address } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { triggerStream } from '../../helpers/stateHelper'
import { FeesLD, FeesService } from '../clients'
import { appWalletService } from '../wallet/appWallet'
import { Client$ } from './types'

/**
 * TRON `FeesService`.
 *
 * Unlike most chains, TRON fees are dynamic and sender-dependent (bandwidth,
 * energy and a one-time account-activation fee), so `getFees` needs a sender
 * address. The generic `clients/fees.ts` derives that address from the keystore
 * phrase via `client.getAddressAsync()` — which throws `"Phrase must be
 * provided"` for phrase-less wallets (Vultisig, standalone Ledger), tearing
 * down the whole `fees$` stream and leaving the swap fee unresolved (the Swap
 * button then stays disabled).
 *
 * Instead we resolve the sender in a wallet-type-aware way: prefer the
 * wallet-derived address from `appWalletService.getAddressForChain$` (populated
 * for Vultisig / standalone Ledger; `O.none` for keystore) and only fall back
 * to `client.getAddressAsync()` for keystore wallets. Any lookup failure
 * degrades to `RD.failure` rather than killing the stream.
 */
export const createFeesService = (client$: Client$): FeesService => {
  const { stream$: reloadFees$, trigger: reloadFees } = triggerStream()

  // Derived address for phrase-less modes (Vultisig / standalone Ledger).
  // `O.none` in keystore mode, where the client derives it from the phrase.
  const walletAddress$ = appWalletService.getAddressForChain$(TRONChain)

  const fees$ = (): FeesLD =>
    Rx.combineLatest([reloadFees$, client$, walletAddress$]).pipe(
      RxOp.switchMap(([_, oClient, oWalletAddress]) =>
        FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.failure(new Error('Client not found'))),
            (client) =>
              FP.pipe(
                oWalletAddress,
                O.fold(
                  // Keystore: derive from the phrase via the client
                  () => Rx.defer(() => Rx.from(client.getAddressAsync())),
                  // Vultisig / standalone Ledger: use the already-derived address
                  (address: Address) => Rx.of(address)
                ),
                RxOp.switchMap((sender: Address) => Rx.from(client.getFees({ sender })).pipe(RxOp.map(RD.success))),
                RxOp.catchError((error) => Rx.of(RD.failure(error)))
              )
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )

  return {
    fees$,
    reloadFees
  }
}
