import * as RD from '@devexperts/remote-data-ts'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { BCHChain } from '@xchainjs/xchain-bitcoincash'
import { DASHChain } from '@xchainjs/xchain-dash'
import { DOGEChain } from '@xchainjs/xchain-doge'
import { LTCChain } from '@xchainjs/xchain-litecoin'
import { Address, Chain } from '@xchainjs/xchain-util'
import { Client as UTXOClient } from '@xchainjs/xchain-utxo'
import type { UTXO } from '@xchainjs/xchain-utxo-providers'
import { ZECChain } from '@xchainjs/xchain-zcash'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { LiveData } from '../../helpers/rx/liveData'
import * as BTC from '../bitcoin'
import * as BCH from '../bitcoincash'
import * as DASH from '../dash'
import * as DOGE from '../doge'
import * as LTC from '../litecoin'
import * as ZEC from '../zcash'

export type UTXOsRD = RD.RemoteData<Error, UTXO[]>
export type UTXOsLD = LiveData<Error, UTXO[]>

/**
 * Fetch UTXOs for a given address using the chain client's getUTXOs method
 */
const getUTXOs$ = (client$: Rx.Observable<O.Option<UTXOClient>>, address: Address): UTXOsLD =>
  FP.pipe(
    client$,
    RxOp.switchMap(
      O.fold<UTXOClient, UTXOsLD>(
        () => Rx.of(RD.initial),
        (client) =>
          FP.pipe(
            Rx.from(client.getUTXOs(address, false)),
            RxOp.map((utxos) => RD.success(utxos)),
            RxOp.catchError((e: Error) => Rx.of(RD.failure(e))),
            RxOp.startWith(RD.pending)
          )
      )
    )
  )

/**
 * Router: fetch UTXOs by chain
 */
export const utxosByChain$ = (chain: Chain, address: Address): UTXOsLD => {
  switch (chain) {
    case BTCChain:
      return getUTXOs$(BTC.combinedClient$, address)
    case LTCChain:
      return getUTXOs$(LTC.combinedClient$, address)
    case DOGEChain:
      return getUTXOs$(DOGE.combinedClient$, address)
    case BCHChain:
      return getUTXOs$(BCH.combinedClient$, address)
    case DASHChain:
      return getUTXOs$(DASH.combinedClient$, address)
    case ZECChain:
      return getUTXOs$(ZEC.combinedClient$, address)
    default:
      return Rx.of(RD.failure(new Error(`${chain} is not a UTXO chain`)))
  }
}
