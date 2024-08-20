import * as RD from '@devexperts/remote-data-ts'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import { of } from 'rxjs'
import { switchMap } from 'rxjs/operators'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { BSCAssetsFallBack, BscAssetsTestnet } from '../../const'
import { liveData } from '../../helpers/rx/liveData'
import { observableState } from '../../helpers/stateHelper'
import * as C from '../clients'
import { userAssets$ } from '../storage/userChainTokens'
import { WalletBalance } from '../wallet/types'
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
// temporary fix
const targetSymbol = 'BSC-USD-0x55d398326f99059ff775485246999027b3197955'
const newSymbol = 'USDT-0x55d398326f99059fF775485246999027B3197955'
const newTicker = 'USDT'

export const replaceSymbol = (asset: AnyAsset): AnyAsset => {
  if (asset.symbol === targetSymbol) {
    return { ...asset, symbol: newSymbol, ticker: newTicker }
  }
  return asset
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
      const bscAssets = assets.filter((asset) => asset.chain === BSCChain)
      return C.balances$({
        client$,
        trigger$: reloadBalances$,
        assets: bscAssets,
        walletType,
        walletAccount,
        walletIndex,
        hdMode,
        walletBalanceType: 'all'
      })
    }),
    // Filter assets based on BSCERC20Whitelist (mainnet only)
    switchMap((balanceResult) => {
      // Check if the balance call failed
      if (RD.isFailure(balanceResult)) {
        // Retry with fallback assets
        return C.balances$({
          client$,
          trigger$: reloadBalances$,
          assets: BSCAssetsFallBack,
          walletType,
          walletAccount,
          walletIndex,
          hdMode,
          walletBalanceType: 'all'
        })
      }
      return of(balanceResult)
    }),
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
}

// State of balances loaded by Client and Address
const getBalanceByAddress$ = (network: Network) => {
  const assets: AnyAsset[] | undefined = network === Network.Testnet ? BscAssetsTestnet : undefined
  return C.balancesByAddress$({ client$, trigger$: reloadBalances$, assets, walletBalanceType: 'all' })
}

export { reloadBalances, balances$, reloadBalances$, resetReloadBalances, getBalanceByAddress$ }
