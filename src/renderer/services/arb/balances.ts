import * as RD from '@devexperts/remote-data-ts'
import { ARBChain, AssetAETH } from '@xchainjs/xchain-arbitrum'
import { Network } from '@xchainjs/xchain-client'
import { Asset } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/lib/function'
import { of } from 'rxjs'
import { switchMap } from 'rxjs/operators'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { ArbAssetsTestnet } from '../../const'
import { observableState } from '../../helpers/stateHelper'
import * as C from '../clients'
import { userAssets$ } from '../storage/userChainTokens'
import { client$ } from './common'
/**
 * `ObservableState` to reload `Balances`
 * Sometimes we need to have a way to understand if it simple "load" or "reload" action
 * e.g. @see src/renderer/services/wallet/balances.ts:getChainBalance$
 */
const { get$: reloadBalances$, set: setReloadBalances } = observableState<boolean>(false)

const resetReloadBalances = () => {
  setReloadBalances(false)
}

const reloadBalances = () => {
  setReloadBalances(true)
}

// State of balances loaded by Client
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
    userAssets$,
    switchMap((assets) => {
      const avaxAssets = assets.filter((asset) => asset.chain === ARBChain)
      return C.balances$({
        client$,
        trigger$: reloadBalances$,
        assets: avaxAssets,
        walletType,
        walletAccount,
        walletIndex,
        hdMode,
        walletBalanceType: 'all'
      })
    }),
    switchMap((balanceResult) => {
      // Check if the balance call failed
      if (RD.isFailure(balanceResult)) {
        // Retry with fallback assets
        return C.balances$({
          client$,
          trigger$: reloadBalances$,
          assets: [AssetAETH],
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
}

// State of balances loaded by Client and Address
const getBalanceByAddress$ = (network: Network) => {
  const assets: Asset[] | undefined = network === Network.Testnet ? ArbAssetsTestnet : undefined
  return C.balancesByAddress$({ client$, trigger$: reloadBalances$, assets, walletBalanceType: 'all' })
}

export { reloadBalances, balances$, reloadBalances$, resetReloadBalances, getBalanceByAddress$ }
