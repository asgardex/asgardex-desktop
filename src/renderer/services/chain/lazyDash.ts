import * as RD from '@devexperts/remote-data-ts'
import { option as O } from 'fp-ts'

import { DASHChain } from '../../../shared/utils/chainIds'
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

type DashModule = typeof import('../dash')

const load = loadChainModule('dash', () => import('../dash'))

const follow = <T>(pick: (mod: DashModule) => import('rxjs').Observable<T>, empty: T) =>
  followChain(DASHChain, load, pick, empty)

const once = <T>(pick: (mod: DashModule) => import('rxjs').Observable<T>, disabled: T) =>
  onceChain(DASHChain, load, pick, disabled)

export const address$ = follow((m) => m.address$, O.none) as DashModule['address$']
export const addressUI$ = follow((m) => m.addressUI$, O.none) as DashModule['addressUI$']
export const client$ = follow((m) => m.client$, O.none) as DashModule['client$']
export const clientState$ = follow((m) => m.clientState$, RD.initial) as DashModule['clientState$']
export const explorerUrl$ = follow((m) => m.explorerUrl$, O.none) as DashModule['explorerUrl$']
export const combinedClient$ = follow((m) => m.combinedClient$, O.none) as DashModule['combinedClient$']
export const reloadBalances$ = follow((m) => m.reloadBalances$, false) as DashModule['reloadBalances$']
export const txRD$ = follow((m) => m.txRD$, RD.initial) as DashModule['txRD$']
export const getBalanceByAddress$: DashModule['getBalanceByAddress$'] = (params) =>
  follow((m) => m.getBalanceByAddress$(params), RD.initial) as ReturnType<DashModule['getBalanceByAddress$']>

export const balances$: DashModule['balances$'] = (params) =>
  follow((m) => m.balances$(params), RD.initial) as ReturnType<DashModule['balances$']>

export const fees$: DashModule['fees$'] = () => follow((m) => m.fees$(), RD.initial) as ReturnType<DashModule['fees$']>

export const feesWithRates$: DashModule['feesWithRates$'] = (address, memo) =>
  follow((m) => m.feesWithRates$(address, memo), RD.initial) as ReturnType<DashModule['feesWithRates$']>

export const sendTx: DashModule['sendTx'] = (params) =>
  once((m) => m.sendTx(params), disabledSend(DASHChain) as never) as ReturnType<DashModule['sendTx']>

export const txs$: DashModule['txs$'] = (params) =>
  once((m) => m.txs$(params), disabledTxs(DASHChain) as never) as ReturnType<DashModule['txs$']>

export const tx$: DashModule['tx$'] = (txHash) =>
  once((m) => m.tx$(txHash), disabledTx(DASHChain) as never) as ReturnType<DashModule['tx$']>

export const txStatus$: DashModule['txStatus$'] = (txHash, assetAddress) =>
  once((m) => m.txStatus$(txHash, assetAddress), disabledTx(DASHChain) as never) as ReturnType<DashModule['txStatus$']>

export const reloadBalances: DashModule['reloadBalances'] = (walletType) => {
  runChain(DASHChain, load, (m) => m.reloadBalances(walletType))
}

export const resetReloadBalances: DashModule['resetReloadBalances'] = (walletType) => {
  runChain(DASHChain, load, (m) => m.resetReloadBalances(walletType))
}

export const reloadFees: DashModule['reloadFees'] = () => {
  runChain(DASHChain, load, (m) => m.reloadFees())
}

export const reloadFeesWithRates: DashModule['reloadFeesWithRates'] = (memo) => {
  runChain(DASHChain, load, (m) => m.reloadFeesWithRates(memo))
}

export const resetTx: DashModule['resetTx'] = () => {
  runChain(DASHChain, load, (m) => m.resetTx())
}

export const subscribeTx: DashModule['subscribeTx'] = (params) =>
  subscribeChain(DASHChain, load, (m, arg) => m.subscribeTx(arg), params)
