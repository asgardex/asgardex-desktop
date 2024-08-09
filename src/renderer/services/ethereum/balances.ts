import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { Asset } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import { of } from 'rxjs'
import { switchMap } from 'rxjs/operators'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { ETHAssetsTestnet } from '../../const'
import { validAssetForETH } from '../../helpers/assetHelper'
import { liveData } from '../../helpers/rx/liveData'
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
  // Use userAssets$ directly for the assets
  return FP.pipe(
    userAssets$, // Directly use userAssets$
    switchMap((assets) =>
      C.balances$({
        client$,
        trigger$: reloadBalances$,
        assets,
        walletType,
        walletAccount,
        walletIndex,
        hdMode,
        walletBalanceType: 'all'
      })
    ),
    switchMap((balanceResult) =>
      // Check if the balance call failed
      RD.isFailure(balanceResult)
        ? C.balances$({
            client$,
            trigger$: reloadBalances$,
            assets: [], // Retry with an empty asset list or handle the error accordingly
            walletType,
            walletAccount,
            walletIndex,
            hdMode,
            walletBalanceType: 'all'
          })
        : of(balanceResult)
    ),
    liveData.map(FP.flow(A.filter(({ asset }) => validAssetForETH(asset, network))))
  )
}

// State of balances loaded by Client and Address
const getBalanceByAddress$ = (network: Network) => {
  const assets: Asset[] | undefined = network === Network.Testnet ? ETHAssetsTestnet : undefined
  return C.balancesByAddress$({ client$, trigger$: reloadBalances$, assets, walletBalanceType: 'all' })
}

export { reloadBalances, balances$, reloadBalances$, resetReloadBalances, getBalanceByAddress$ }
