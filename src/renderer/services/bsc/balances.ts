import { Network } from '@xchainjs/xchain-client'
import { Asset } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { BscAssetsTestnet } from '../../const'
import { validAssetForBSC } from '../../helpers/assetHelper'
import { liveData } from '../../helpers/rx/liveData'
import { observableState } from '../../helpers/stateHelper'
import * as C from '../clients'
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

const replaceSymbol = (asset: Asset): Asset => {
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
}) => C.WalletBalancesLD = ({ walletType, walletAccount, walletIndex, network, hdMode }) => {
  // For testnet we limit requests by using pre-defined assets only

  const assets: Asset[] | undefined = network === Network.Testnet ? BscAssetsTestnet : undefined

  return FP.pipe(
    C.balances$({
      client$,
      trigger$: reloadBalances$,
      assets,
      walletType,
      walletAccount,
      walletIndex,
      hdMode,
      walletBalanceType: 'all'
    }),
    // Filter assets based on BSCERC20Whitelist (mainnet only)
    // Filter assets based on BSCERC20Whitelist (mainnet only)
    liveData.map(FP.flow(A.filter(({ asset }) => validAssetForBSC(asset, network)))),
    liveData.map(
      FP.flow(
        A.map((balance: WalletBalance) => ({
          ...balance,
          asset: replaceSymbol(balance.asset)
        }))
      )
    )
  )
}

// State of balances loaded by Client and Address
const getBalanceByAddress$ = (network: Network) => {
  const assets: Asset[] | undefined = network === Network.Testnet ? BscAssetsTestnet : undefined
  return C.balancesByAddress$({ client$, trigger$: reloadBalances$, assets, walletBalanceType: 'all' })
}

export { reloadBalances, balances$, reloadBalances$, resetReloadBalances, getBalanceByAddress$ }
