import { Network } from '@xchainjs/xchain-client'
import { Asset } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { AvaxAssetsTestnet } from '../../const'
import { validAssetForAVAX } from '../../helpers/assetHelper'
import { liveData } from '../../helpers/rx/liveData'
import { observableState } from '../../helpers/stateHelper'
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
  const assets: Asset[] | undefined = network === Network.Testnet ? AvaxAssetsTestnet : undefined
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
    // Filter assets based on AVAXERC20Whitelist (mainnet only)
    liveData.map(FP.flow(A.filter(({ asset }) => validAssetForAVAX(asset, network))))
  )
}

// State of balances loaded by Client and Address
const getBalanceByAddress$ = (network: Network) => {
  const assets: Asset[] | undefined = network === Network.Testnet ? AvaxAssetsTestnet : undefined
  return C.balancesByAddress$({ client$, trigger$: reloadBalances$, assets, walletBalanceType: 'all' })
}

export { reloadBalances, balances$, reloadBalances$, resetReloadBalances, getBalanceByAddress$ }
