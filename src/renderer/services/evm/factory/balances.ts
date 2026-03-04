import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { Chain, AnyAsset } from '@xchainjs/xchain-util'
import { array as A, function as FP } from 'fp-ts'
import { of } from 'rxjs'
import { switchMap } from 'rxjs/operators'

import { HDMode, WalletType } from '../../../../shared/wallet/types'
import { liveData } from '../../../helpers/rx/liveData'
import { observableState } from '../../../helpers/stateHelper'
import * as C from '../../clients'
import { createEnhancedClient$ } from '../../clients'
import { getUserAssetsByChain$ } from '../../storage/userChainTokens'
import { isKeystoreReloadTrigger, WalletBalance } from '../../wallet/types'
import { Client$ } from '../types'

export type EvmBalancesConfig = {
  chain: Chain
  assetsFallback: AnyAsset[]
  assetsTestnet: AnyAsset[]
  balanceTransform?: (balance: WalletBalance) => WalletBalance
}

export const createEvmBalancesService = (config: EvmBalancesConfig, client$: Client$, readOnlyClient$: Client$) => {
  const { chain, assetsFallback, assetsTestnet, balanceTransform } = config

  const enhancedClient$ = createEnhancedClient$(client$, readOnlyClient$)

  const { get$: reloadBalances$, set: setReloadBalances } = observableState<boolean>(false)
  const { get$: reloadLedgerBalances$, set: setReloadLedgerBalances } = observableState<boolean>(false)

  const resetReloadBalances = (walletType: WalletType) => {
    if (isKeystoreReloadTrigger(walletType)) {
      setReloadBalances(false)
    } else {
      setReloadLedgerBalances(false)
    }
  }

  const reloadBalances = (walletType: WalletType) => {
    if (isKeystoreReloadTrigger(walletType)) {
      setReloadBalances(true)
    } else {
      setReloadLedgerBalances(true)
    }
  }

  const balances$: ({
    walletType,
    network,
    walletAccount,
    walletIndex,
    hdMode
  }: {
    walletType: WalletType
    network: Network
    walletAccount: number
    walletIndex: number
    hdMode: HDMode
  }) => C.WalletBalancesLD = ({ walletType, walletAccount, walletIndex, hdMode }) => {
    const trigger$ = isKeystoreReloadTrigger(walletType) ? reloadBalances$ : reloadLedgerBalances$

    const base$ = FP.pipe(
      getUserAssetsByChain$(chain),
      switchMap((assets) => {
        return C.balances$({
          client$: enhancedClient$,
          trigger$,
          assets: assets,
          walletType,
          walletAccount,
          walletIndex,
          hdMode,
          walletBalanceType: 'all'
        })
      }),
      switchMap((balanceResult) => {
        if (RD.isFailure(balanceResult)) {
          return C.balances$({
            client$: enhancedClient$,
            trigger$,
            assets: assetsFallback,
            walletType,
            walletAccount,
            walletIndex,
            hdMode,
            walletBalanceType: 'all'
          })
        }
        return of(balanceResult)
      })
    )

    if (balanceTransform) {
      return FP.pipe(base$, liveData.map(FP.flow(A.map(balanceTransform))))
    }

    return base$
  }

  const getBalanceByAddress$ = (network: Network) => {
    const assets = network === Network.Testnet ? assetsTestnet : assetsFallback
    return C.balancesByAddress$({
      client$: enhancedClient$,
      trigger$: reloadLedgerBalances$,
      assets,
      walletBalanceType: 'all'
    })
  }

  return { reloadBalances, balances$, reloadBalances$, resetReloadBalances, getBalanceByAddress$, enhancedClient$ }
}
