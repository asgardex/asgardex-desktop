import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { TRONChain } from '@xchainjs/xchain-tron'
import { TokenAsset } from '@xchainjs/xchain-util'
import { function as FP } from 'fp-ts'
import { of } from 'rxjs'
import { switchMap } from 'rxjs/operators'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { TRONAssetsFallBack } from '../../const'
import { observableState } from '../../helpers/stateHelper'
import * as C from '../clients'
import { createEnhancedClient$ } from '../clients'
import { getUserAssetsByChain$ } from '../storage/userChainTokens'
import { isKeystoreReloadTrigger } from '../wallet/types'
import { client$, readOnlyClient$ } from './common'

/**
 * Enhanced client that switches between keystore and read-only client for standalone ledger mode
 */
const enhancedClient$ = createEnhancedClient$(client$, readOnlyClient$)

/**
 * `ObservableState` to reload `Balances`
 * Sometimes we need to have a way to understand if it simple "load" or "reload" action
 * e.g. @see src/renderer/services/wallet/balances.ts:getChainBalance$
 */
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
  // Select trigger based on wallet type
  const trigger$ = isKeystoreReloadTrigger(walletType) ? reloadBalances$ : reloadLedgerBalances$

  return FP.pipe(
    getUserAssetsByChain$(TRONChain),
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
    switchMap((balanceResult) =>
      RD.isFailure(balanceResult)
        ? C.balances$({
            client$: enhancedClient$,
            trigger$,
            assets: TRONAssetsFallBack,
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
const getBalanceByAddress$ = (_network: Network) => {
  // Note: Currently using same assets for all networks
  // TODO: Add testnet-specific assets when available
  const assets: TokenAsset[] = TRONAssetsFallBack

  return C.balancesByAddress$({
    client$: enhancedClient$,
    trigger$: reloadLedgerBalances$,
    assets,
    walletBalanceType: 'all'
  })
}

export { reloadBalances, balances$, reloadBalances$, resetReloadBalances, getBalanceByAddress$, enhancedClient$ }
