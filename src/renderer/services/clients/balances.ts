import * as RD from '@devexperts/remote-data-ts'
import { Balance, XChainClient } from '@xchainjs/xchain-client'
import { Address, AnyAsset } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'
import { catchError, startWith, map, shareReplay, debounceTime } from 'rxjs/operators'

import { HDMode, WalletBalanceType, WalletType } from '../../../shared/wallet/types'
import { liveData } from '../../helpers/rx/liveData'
import { replaceSymbol } from '../bsc/balances'
import { userAssets$ } from '../storage/userChainTokens'
import { ApiError, ErrorId, WalletBalance } from '../wallet/types'
import { WalletBalancesLD, XChainClient$ } from './types'

// Currently we have two parameters only for `getBalance` in XChainClient defined,
// but `xchain-btc` has recently added a third parameter `confirmedOnly` and XChainClient needs to be changed in the future,
// @see `xchain-btc` PR 490 https://github.com/xchainjs/xchainjs-lib/pull/490/files#diff-8fc736951c0a12557cfeea25b9e6671889c2bd252e728501d7bd6c914e6cf5b8R105-R107
// TEmproary workaround: Override `XChainClient` interface here
export interface XChainClientOverride extends XChainClient {
  getBalance(address: Address, assets?: AnyAsset[], confirmedOnly?: boolean): Promise<Balance[]>
}
/**
 * Observable to request balances by given `XChainClient` and `Address` (optional)
 * `Balances` are mapped into `WalletBalances`
 *
 * If `address` is not set, it tries to get `Address` of `Client` (which can fail).
 *
 * Empty list of balances returned by client will be ignored and not part of `WalletBalances`
 *
 */
const loadBalances$ = <C extends XChainClientOverride>({
  client,
  walletType,
  address,
  assets,
  walletAccount,
  walletIndex,
  hdMode,
  walletBalanceType
}: {
  client: C
  walletType: WalletType
  address?: Address
  assets?: AnyAsset[]
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
  walletBalanceType: WalletBalanceType
}): WalletBalancesLD =>
  FP.pipe(
    address,
    O.fromNullable,
    O.fold(
      // If `address` is not available, get it asynchronously using `getAddressAsync`
      () =>
        Rx.from(client.getAddressAsync(walletIndex)).pipe(
          RxOp.switchMap((walletAddress) =>
            Rx.from(client.getBalance(walletAddress, assets, walletBalanceType === 'confirmed')).pipe(
              map(RD.success),
              liveData.map(
                A.map((balance) => ({
                  ...balance,
                  walletType,
                  walletAddress,
                  walletAccount,
                  walletIndex,
                  hdMode
                }))
              ),
              catchError((error: Error) =>
                Rx.of(RD.failure<ApiError>({ errorId: ErrorId.GET_BALANCES, msg: error.message || 'Unknown error' }))
              ),
              startWith(RD.pending)
            )
          ),
          catchError((error: Error) =>
            Rx.of(RD.failure<ApiError>({ errorId: ErrorId.GET_BALANCES, msg: error.message || 'Unknown error' }))
          ),
          startWith(RD.pending)
        ),
      // If `address` is already provided, use it directly
      (walletAddress) =>
        Rx.from(client.getBalance(walletAddress, assets, walletBalanceType === 'confirmed')).pipe(
          map(RD.success),
          liveData.map(
            A.map((balance) => ({
              ...balance,
              walletType,
              walletAddress,
              walletAccount,
              walletIndex,
              hdMode
            }))
          ),
          catchError((error: Error) =>
            Rx.of(RD.failure<ApiError>({ errorId: ErrorId.GET_BALANCES, msg: error.message || 'Unknown error' }))
          ),
          startWith(RD.pending)
        )
    )
  )

type Balances$ = ({
  walletType,
  client$,
  trigger$,
  assets,
  walletAccount,
  walletIndex,
  hdMode,
  walletBalanceType
}: {
  walletType: WalletType
  client$: XChainClient$
  trigger$: Rx.Observable<boolean>
  assets?: AnyAsset[]
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
  walletBalanceType: WalletBalanceType
}) => WalletBalancesLD
/**
 * State of `Balances` loaded by given `XChainClient`
 * It will be reloaded by a next value of given `TriggerStream$`
 *
 * `Balances` is loaded by first subscription only, all other subscriber will use same state.
 * To reload `Balances`, trigger a next value to `trigger$` stream
 *
 * If a client is not available (e.g. by removing keystore), it returns an `initial` state
 */
export const balances$: Balances$ = ({
  walletType,
  client$,
  trigger$,
  assets,
  walletAccount,
  walletIndex,
  hdMode,
  walletBalanceType
}) =>
  Rx.combineLatest([trigger$.pipe(debounceTime(300)), client$]).pipe(
    RxOp.switchMap(([_, oClient]) => {
      return FP.pipe(
        oClient,
        O.fold(
          // if a client is not available, "reset" state to "initial"
          () => Rx.of(RD.initial),
          // or start request and return state
          (client) =>
            loadBalances$({
              walletType,
              client,
              assets,
              walletAccount,
              walletIndex,
              hdMode,
              walletBalanceType
            })
        )
      )
    })
  )

type BalancesByAddress$ = ({
  client$,
  trigger$,
  assets,
  walletBalanceType
}: {
  client$: XChainClient$
  trigger$: Rx.Observable<boolean>
  assets?: AnyAsset[]
  walletBalanceType: WalletBalanceType
}) => ({
  address,
  walletType,
  walletAccount,
  walletIndex,
  hdMode
}: {
  address: string
  walletType: WalletType
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
}) => WalletBalancesLD

export const balancesByAddress$: BalancesByAddress$ =
  ({ client$, trigger$, walletBalanceType }) =>
  ({ address, walletType, walletAccount, walletIndex, hdMode }) =>
    Rx.combineLatest([trigger$.pipe(RxOp.debounceTime(300)), client$]).pipe(
      RxOp.mergeMap(([_, oClient]) => {
        return FP.pipe(
          oClient,
          O.fold(
            () => Rx.of(RD.initial),
            (client) =>
              FP.pipe(
                userAssets$,
                RxOp.switchMap((assets) => {
                  // Filter the assets by the client's chain
                  const filteredAssets = assets.filter((asset) => asset.chain === client.getAssetInfo().asset.chain)
                  return loadBalances$({
                    client,
                    address,
                    walletType,
                    assets: filteredAssets, // Use filtered assets
                    walletAccount,
                    walletIndex,
                    walletBalanceType,
                    hdMode
                  }).pipe(
                    liveData.map(
                      FP.flow(
                        A.map((balance: WalletBalance) => {
                          return {
                            ...balance,
                            asset: replaceSymbol(balance.asset)
                          }
                        })
                      )
                    )
                  )
                })
              )
          )
        )
      }),
      shareReplay(1)
    )
