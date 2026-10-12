import * as RD from '@devexperts/remote-data-ts'
import { option as O } from 'fp-ts'

import { RadixChain } from '../../../shared/utils/chainIds'
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

type RadixModule = typeof import('../radix')

const load = loadChainModule('radix', () => import('../radix'))

const follow = <T>(pick: (mod: RadixModule) => import('rxjs').Observable<T>, empty: T) =>
  followChain(RadixChain, load, pick, empty)

const once = <T>(pick: (mod: RadixModule) => import('rxjs').Observable<T>, disabled: T) =>
  onceChain(RadixChain, load, pick, disabled)

export const address$ = follow((m) => m.address$, O.none) as RadixModule['address$']
export const addressUI$ = follow((m) => m.addressUI$, O.none) as RadixModule['addressUI$']
export const client$ = follow((m) => m.client$, O.none) as RadixModule['client$']
export const clientState$ = follow((m) => m.clientState$, RD.initial) as RadixModule['clientState$']
export const explorerUrl$ = follow((m) => m.explorerUrl$, O.none) as RadixModule['explorerUrl$']
export const reloadBalances$ = follow((m) => m.reloadBalances$, false) as RadixModule['reloadBalances$']
export const txRD$ = follow((m) => m.txRD$, RD.initial) as RadixModule['txRD$']
export const getBalanceByAddress$: RadixModule['getBalanceByAddress$'] = (params) =>
  follow((m) => m.getBalanceByAddress$(params), RD.initial) as ReturnType<RadixModule['getBalanceByAddress$']>

export const balances$: RadixModule['balances$'] = (params) =>
  follow((m) => m.balances$(params), RD.initial) as ReturnType<RadixModule['balances$']>

export const fees$: RadixModule['fees$'] = () =>
  follow((m) => m.fees$(), RD.initial) as ReturnType<RadixModule['fees$']>

export const sendTx: RadixModule['sendTx'] = (params) =>
  once((m) => m.sendTx(params), disabledSend(RadixChain) as never) as ReturnType<RadixModule['sendTx']>

export const sendPoolTx$: RadixModule['sendPoolTx$'] = (params) =>
  once((m) => m.sendPoolTx$(params), disabledSend(RadixChain) as never) as ReturnType<RadixModule['sendPoolTx$']>

export const txs$: RadixModule['txs$'] = (params) =>
  once((m) => m.txs$(params), disabledTxs(RadixChain) as never) as ReturnType<RadixModule['txs$']>

export const tx$: RadixModule['tx$'] = (txHash) =>
  once((m) => m.tx$(txHash), disabledTx(RadixChain) as never) as ReturnType<RadixModule['tx$']>

export const txStatus$: RadixModule['txStatus$'] = (txHash, assetAddress) =>
  once((m) => m.txStatus$(txHash, assetAddress), disabledTx(RadixChain) as never) as ReturnType<
    RadixModule['txStatus$']
  >

export const reloadBalances: RadixModule['reloadBalances'] = (walletType) => {
  runChain(RadixChain, load, (m) => m.reloadBalances(walletType))
}

export const resetReloadBalances: RadixModule['resetReloadBalances'] = (walletType) => {
  runChain(RadixChain, load, (m) => m.resetReloadBalances(walletType))
}

export const reloadFees: RadixModule['reloadFees'] = () => {
  runChain(RadixChain, load, (m) => m.reloadFees())
}

export const resetTx: RadixModule['resetTx'] = () => {
  runChain(RadixChain, load, (m) => m.resetTx())
}

export const subscribeTx: RadixModule['subscribeTx'] = (params) =>
  subscribeChain(RadixChain, load, (m, arg) => m.subscribeTx(arg), params)
