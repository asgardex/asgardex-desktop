import { AssetBSC } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { Asset } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { BscAssetsTestnet } from '../../const'
import { liveData } from '../../helpers/rx/liveData'
import { observableState } from '../../helpers/stateHelper'
import { BSC_TOKEN_WHITELIST } from '../../types/generated/thorchain/bscerc20whitelist'
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
  walletIndex,
  hdMode
}: {
  walletType: WalletType
  network: Network
  walletIndex: number
  hdMode: HDMode
}) => C.WalletBalancesLD = ({ walletType, walletIndex, network, hdMode }) => {
  // For testnet we limit requests by using pre-defined assets only
  // For mainnet we use the whiteList assets to avoid calling balances on airdropped scam tokens.
  const getAssets = (network: Network): Asset[] | undefined => {
    const assets: Asset[] | undefined = network === Network.Testnet ? BscAssetsTestnet : undefined

    return network === Network.Mainnet
      ? FP.pipe(
          BSC_TOKEN_WHITELIST,
          A.filter(({ asset }) => !asset.synth),
          A.map(({ asset }) => asset),
          (whitelistedAssets) => [AssetBSC, ...whitelistedAssets]
        )
      : assets
  }
  const assets: Asset[] | undefined = getAssets(network)
  return FP.pipe(
    C.balances$({
      client$,
      trigger$: reloadBalances$,
      assets,
      walletType,
      walletIndex,
      hdMode,
      walletBalanceType: 'all'
    }),
    // Filter assets based on BSCERC20Whitelist (mainnet only)
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
