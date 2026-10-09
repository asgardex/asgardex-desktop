import * as RD from '@devexperts/remote-data-ts'
import { option as O } from 'fp-ts'

import { BTCChain } from '../../../shared/utils/chainIds'
import {
  disabledSend,
  disabledTx,
  disabledTxs,
  followChain,
  loadChainModule,
  onceChain,
  runChain,
  subscribeChain
} from './lazyChain'

type BitcoinModule = typeof import('../bitcoin')

const load = loadChainModule('bitcoin', () => import('../bitcoin'))

const follow = <T>(pick: (mod: BitcoinModule) => import('rxjs').Observable<T>, empty: T) =>
  followChain(BTCChain, load, pick, empty)

const once = <T>(pick: (mod: BitcoinModule) => import('rxjs').Observable<T>, disabled: T) =>
  onceChain(BTCChain, load, pick, disabled)

export const address$ = follow((m) => m.address$, O.none) as BitcoinModule['address$']
export const addressUI$ = follow((m) => m.addressUI$, O.none) as BitcoinModule['addressUI$']
export const addressTR$ = follow((m) => m.addressTR$, O.none) as BitcoinModule['addressTR$']
export const addressUITR$ = follow((m) => m.addressUITR$, O.none) as BitcoinModule['addressUITR$']
export const client$ = follow((m) => m.client$, O.none) as BitcoinModule['client$']
export const clientState$ = follow((m) => m.clientState$, RD.initial) as BitcoinModule['clientState$']
export const explorerUrl$ = follow((m) => m.explorerUrl$, O.none) as BitcoinModule['explorerUrl$']
export const combinedClient$ = follow((m) => m.combinedClient$, O.none) as BitcoinModule['combinedClient$']
export const reloadBalances$ = follow((m) => m.reloadBalances$, false) as BitcoinModule['reloadBalances$']
export const txRD$ = follow((m) => m.txRD$, RD.initial) as BitcoinModule['txRD$']

export const balances$: BitcoinModule['balances$'] = (params) =>
  follow((m) => m.balances$(params), RD.initial) as ReturnType<BitcoinModule['balances$']>

export const getBalanceByAddress$: BitcoinModule['getBalanceByAddress$'] = (walletBalanceType) => (params) =>
  follow((m) => m.getBalanceByAddress$(walletBalanceType)(params), RD.initial) as ReturnType<
    ReturnType<BitcoinModule['getBalanceByAddress$']>
  >

export const fees$: BitcoinModule['fees$'] = () =>
  follow((m) => m.fees$(), RD.initial) as ReturnType<BitcoinModule['fees$']>

export const feesWithRates$: BitcoinModule['feesWithRates$'] = (address, memo) =>
  follow((m) => m.feesWithRates$(address, memo), RD.initial) as ReturnType<BitcoinModule['feesWithRates$']>

export const sendTx: BitcoinModule['sendTx'] = (params) =>
  once((m) => m.sendTx(params), disabledSend(BTCChain) as never) as ReturnType<BitcoinModule['sendTx']>

export const txs$: BitcoinModule['txs$'] = (params) =>
  once((m) => m.txs$(params), disabledTxs(BTCChain) as never) as ReturnType<BitcoinModule['txs$']>

export const tx$: BitcoinModule['tx$'] = (txHash) =>
  once((m) => m.tx$(txHash), disabledTx(BTCChain) as never) as ReturnType<BitcoinModule['tx$']>

export const txStatus$: BitcoinModule['txStatus$'] = (txHash, assetAddress) =>
  once((m) => m.txStatus$(txHash, assetAddress), disabledTx(BTCChain) as never) as ReturnType<
    BitcoinModule['txStatus$']
  >

export const reloadBalances: BitcoinModule['reloadBalances'] = (walletType) => {
  runChain(BTCChain, load, (m) => m.reloadBalances(walletType))
}

export const resetReloadBalances: BitcoinModule['resetReloadBalances'] = (walletType) => {
  runChain(BTCChain, load, (m) => m.resetReloadBalances(walletType))
}

export const reloadFees: BitcoinModule['reloadFees'] = () => {
  runChain(BTCChain, load, (m) => m.reloadFees())
}

export const reloadFeesWithRates: BitcoinModule['reloadFeesWithRates'] = (memo) => {
  runChain(BTCChain, load, (m) => m.reloadFeesWithRates(memo))
}

export const resetTx: BitcoinModule['resetTx'] = () => {
  runChain(BTCChain, load, (m) => m.resetTx())
}

export const subscribeTx: BitcoinModule['subscribeTx'] = (params) =>
  subscribeChain(BTCChain, load, (m, arg) => m.subscribeTx(arg), params)
