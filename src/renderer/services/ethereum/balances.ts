import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { TokenAsset } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import { of } from 'rxjs'
import { switchMap } from 'rxjs/operators'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { ETHAssetsFallBack, ETHAssetsTestnet } from '../../const'
import { observableState } from '../../helpers/stateHelper'
import * as C from '../clients'
import { getUserAssetsByChain$ } from '../storage/userChainTokens'
import { client$ } from './common'

/**
 * `ObservableState` to reload `Balances`
 * Sometimes we need to have a way to understand if it simple "load" or "reload" action
 * e.g. @see src/renderer/services/wallet/balances.ts:getChainBalance$
 */
const { get$: reloadBalances$, set: setReloadBalances } = observableState<boolean>(false)
const { get$: reloadLedgerBalances$, set: setReloadLedgerBalances } = observableState<boolean>(false)

const resetReloadBalances = (walletType: WalletType) => {
  if (walletType === 'keystore') {
    setReloadBalances(false)
  } else {
    setReloadLedgerBalances(false)
  }
}

const reloadBalances = (walletType: WalletType) => {
  if (walletType === 'keystore') {
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
  return FP.pipe(
    getUserAssetsByChain$(ETHChain),
    switchMap((assets) => {
      return C.balances$({
        client$,
        trigger$: reloadBalances$,
        assets: assets,
        walletType,
        walletAccount,
        walletIndex,
        hdMode,
        walletBalanceType: 'all'
      })
    }),
    switchMap((balanceResult) =>
      RD.isFailure(balanceResult)
        ? C.balances$({
            client$,
            trigger$: reloadBalances$,
            assets: ETHAssetsFallBack,
            walletType,
            walletAccount,
            walletIndex,
            hdMode,
            walletBalanceType: 'all'
          })
        : of(balanceResult)
    )
  )
}

// State of balances loaded by Client and Address
const getBalanceByAddress$ = (network: Network) => {
  const assets: TokenAsset[] | undefined = network === Network.Testnet ? ETHAssetsTestnet : ETHAssetsFallBack
  return C.balancesByAddress$({ client$, trigger$: reloadLedgerBalances$, assets, walletBalanceType: 'all' })
}

export { reloadBalances, balances$, reloadBalances$, resetReloadBalances, getBalanceByAddress$ }
