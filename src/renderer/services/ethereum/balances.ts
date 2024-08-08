import { Network } from '@xchainjs/xchain-client'
import { Asset } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import { of, from } from 'rxjs'
import { map, switchMap, tap, catchError } from 'rxjs/operators'

import { etherscanApiKey } from '../../../shared/api/etherscan'
import { HDMode, WalletType } from '../../../shared/wallet/types'
import { ETHAssetsTestnet } from '../../const'
import { validAssetForETH } from '../../helpers/assetHelper'
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

const fetchBalanceFromEtherscan = (address: string) => {
  const url = `https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${etherscanApiKey}`
  return fetch(url)
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        throw new Error(data.error.message)
      }
      return data.result
    })
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
  const assets: Asset[] | undefined = network === Network.Testnet ? ETHAssetsTestnet : undefined
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
    switchMap((balances) =>
      from(fetchBalanceFromEtherscan('0xf155e9cdd77a5d77073ab43d17f661507c08e23d')).pipe(
        tap((data) => {
          console.log('Balance from Etherscan API:', data)
        }),
        catchError((error) => {
          console.error('Error fetching balance from Etherscan API:', error)
          return of(null) // Return a default value or handle the error as needed
        }),
        map((etherscanBalance) => {
          console.log(balances)
          console.log(etherscanBalance)
          // Here you can merge or use the etherscanBalance with your balances if needed
          return balances
        })
      )
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
