import * as RD from '@devexperts/remote-data-ts'
import { option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

/**
 * Dynamic import boundary for the Radix wallet client.
 * A static import of `@xchainjs/xchain-radix` or `services/radix` pulls the
 * Radix Engine Toolkit wasm into the initial renderer script. Callers in the
 * startup graph use these wrappers. The chunk loads when a subscriber connects
 * (an enabled XRD wallet, or an XRD receive/send/import screen).
 */
type RadixModule = typeof import('./index')

let radixModule: Promise<RadixModule> | undefined

export const loadRadix = (): Promise<RadixModule> => {
  if (!radixModule) {
    radixModule = import('./index')
  }
  return radixModule
}

const service$ = Rx.defer(() => Rx.from(loadRadix())).pipe(RxOp.shareReplay({ bufferSize: 1, refCount: false }))

const bind$ = <A>(pick: (service: RadixModule) => Rx.Observable<A>): Rx.Observable<A> =>
  service$.pipe(RxOp.switchMap(pick))

// Placeholder emissions let combineLatest of every chain proceed while the chunk loads.
export const radixAddress$ = bind$((service) => service.address$).pipe(RxOp.startWith(O.none))
export const radixAddressUI$ = bind$((service) => service.addressUI$).pipe(RxOp.startWith(O.none))
export const radixClient$ = bind$((service) => service.client$).pipe(RxOp.startWith(O.none))
export const radixClientState$ = bind$((service) => service.clientState$).pipe(RxOp.startWith(RD.pending))
export const radixExplorerUrl$ = bind$((service) => service.explorerUrl$).pipe(RxOp.startWith(O.none))
export const radixReloadBalances$ = bind$((service) => service.reloadBalances$).pipe(RxOp.startWith(false))
export const radixTxRD$ = bind$((service) => service.txRD$)

export const radixBalances$: RadixModule['balances$'] = (params) => bind$((service) => service.balances$(params))

export const radixTxs$: RadixModule['txs$'] = (params) => bind$((service) => service.txs$(params))

export const radixFees$: RadixModule['fees$'] = () =>
  bind$((service) => service.fees$()).pipe(RxOp.startWith(RD.pending))

export const radixSendTx: RadixModule['sendTx'] = (params) => bind$((service) => service.sendTx(params))

export const radixSendPoolTx$: RadixModule['sendPoolTx$'] = (params) => bind$((service) => service.sendPoolTx$(params))

export const radixTxStatus$: RadixModule['txStatus$'] = (txHash, assetAddress) =>
  bind$((service) => service.txStatus$(txHash, assetAddress))

export const radixGetBalanceByAddress$: RadixModule['getBalanceByAddress$'] = (params) =>
  bind$((service) => service.getBalanceByAddress$(params))

const whenLoaded = (run: (service: RadixModule) => void): void => {
  void loadRadix().then(run)
}

export const reloadRadixBalances: RadixModule['reloadBalances'] = (walletType) => {
  whenLoaded((service) => service.reloadBalances(walletType))
}

export const resetReloadRadixBalances: RadixModule['resetReloadBalances'] = (walletType) => {
  whenLoaded((service) => service.resetReloadBalances(walletType))
}

export const reloadRadixFees: RadixModule['reloadFees'] = () => {
  whenLoaded((service) => service.reloadFees())
}

export const resetRadixTx: RadixModule['resetTx'] = () => {
  whenLoaded((service) => service.resetTx())
}

export const subscribeRadixTx: RadixModule['subscribeTx'] = (params) => {
  const outer = new Rx.Subscription()
  void loadRadix().then((service) => {
    if (outer.closed) return
    outer.add(service.subscribeTx(params))
  })
  return outer
}
