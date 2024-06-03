import { AssetAVAX } from '@xchainjs/xchain-avax'
import { Network } from '@xchainjs/xchain-client'
import { Asset } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { AvaxAssetsTestnet } from '../../const'
import { observableState } from '../../helpers/stateHelper'
import { AVAX_TOKEN_WHITELIST } from '../../types/generated/thorchain/avaxerc20whitelist'
import * as C from '../clients'
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
    const assets: Asset[] | undefined = network === Network.Testnet ? AvaxAssetsTestnet : undefined

    return network === Network.Mainnet
      ? FP.pipe(
          AVAX_TOKEN_WHITELIST,
          A.filter(({ asset }) => !asset.synth),
          A.map(({ asset }) => asset),
          (whitelistedAssets) => [AssetAVAX, ...whitelistedAssets]
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
    })
  )
}

// State of balances loaded by Client and Address
const getBalanceByAddress$ = (network: Network) => {
  const assets: Asset[] | undefined = network === Network.Testnet ? AvaxAssetsTestnet : undefined
  return C.balancesByAddress$({ client$, trigger$: reloadBalances$, assets, walletBalanceType: 'all' })
}

export { reloadBalances, balances$, reloadBalances$, resetReloadBalances, getBalanceByAddress$ }
