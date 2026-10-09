import * as RD from '@devexperts/remote-data-ts'
import { option as O } from 'fp-ts'

import { ZECChain } from '../../../shared/utils/chainIds'
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

type ZcashModule = typeof import('../zcash')

const load = loadChainModule('zcash', () => import('../zcash'))

const follow = <T>(pick: (mod: ZcashModule) => import('rxjs').Observable<T>, empty: T) =>
  followChain(ZECChain, load, pick, empty)

const once = <T>(pick: (mod: ZcashModule) => import('rxjs').Observable<T>, disabled: T) =>
  onceChain(ZECChain, load, pick, disabled)

export const address$ = follow((m) => m.address$, O.none) as ZcashModule['address$']
export const addressUI$ = follow((m) => m.addressUI$, O.none) as ZcashModule['addressUI$']
export const client$ = follow((m) => m.client$, O.none) as ZcashModule['client$']
export const clientState$ = follow((m) => m.clientState$, RD.initial) as ZcashModule['clientState$']
export const explorerUrl$ = follow((m) => m.explorerUrl$, O.none) as ZcashModule['explorerUrl$']
export const combinedClient$ = follow((m) => m.combinedClient$, O.none) as ZcashModule['combinedClient$']
export const reloadBalances$ = follow((m) => m.reloadBalances$, false) as ZcashModule['reloadBalances$']
export const txRD$ = follow((m) => m.txRD$, RD.initial) as ZcashModule['txRD$']

export const balances$: ZcashModule['balances$'] = (params) =>
  follow((m) => m.balances$(params), RD.initial) as ReturnType<ZcashModule['balances$']>

export const getBalanceByAddress$: ZcashModule['getBalanceByAddress$'] = (walletBalanceType) => (params) =>
  follow((m) => m.getBalanceByAddress$(walletBalanceType)(params), RD.initial) as ReturnType<
    ReturnType<ZcashModule['getBalanceByAddress$']>
  >

export const fees$: ZcashModule['fees$'] = () =>
  follow((m) => m.fees$(), RD.initial) as ReturnType<ZcashModule['fees$']>

export const feesWithRates$: ZcashModule['feesWithRates$'] = (address, memo) =>
  follow((m) => m.feesWithRates$(address, memo), RD.initial) as ReturnType<ZcashModule['feesWithRates$']>

export const sendTx: ZcashModule['sendTx'] = (params) =>
  once((m) => m.sendTx(params), disabledSend(ZECChain) as never) as ReturnType<ZcashModule['sendTx']>

export const txs$: ZcashModule['txs$'] = (params) =>
  once((m) => m.txs$(params), disabledTxs(ZECChain) as never) as ReturnType<ZcashModule['txs$']>

export const tx$: ZcashModule['tx$'] = (txHash) =>
  once((m) => m.tx$(txHash), disabledTx(ZECChain) as never) as ReturnType<ZcashModule['tx$']>

export const txStatus$: ZcashModule['txStatus$'] = (txHash, assetAddress) =>
  once((m) => m.txStatus$(txHash, assetAddress), disabledTx(ZECChain) as never) as ReturnType<ZcashModule['txStatus$']>

export const reloadBalances: ZcashModule['reloadBalances'] = (walletType) => {
  runChain(ZECChain, load, (m) => m.reloadBalances(walletType))
}

export const resetReloadBalances: ZcashModule['resetReloadBalances'] = (walletType) => {
  runChain(ZECChain, load, (m) => m.resetReloadBalances(walletType))
}

export const reloadFees: ZcashModule['reloadFees'] = () => {
  runChain(ZECChain, load, (m) => m.reloadFees())
}

export const reloadFeesWithRates: ZcashModule['reloadFeesWithRates'] = (memo) => {
  runChain(ZECChain, load, (m) => m.reloadFeesWithRates(memo))
}

export const resetTx: ZcashModule['resetTx'] = () => {
  runChain(ZECChain, load, (m) => m.resetTx())
}

export const subscribeTx: ZcashModule['subscribeTx'] = (params) =>
  subscribeChain(ZECChain, load, (m, arg) => m.subscribeTx(arg), params)
