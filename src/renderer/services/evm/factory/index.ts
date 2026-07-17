import { Network } from '@xchainjs/xchain-client'
import { Address, AnyAsset, Chain } from '@xchainjs/xchain-util'
import * as Rx from 'rxjs'

import { ApiUrls } from '../../../../shared/api/types'
import { KeystoreChainHDSettings } from '../../../../shared/wallet/types'
import { Network$ } from '../../app/types'
import { WalletBalance } from '../../wallet/types'
import { Client$, TxParams } from '../types'

import { createEvmBalancesService } from './balances'
import { createEvmCommonService } from './common'
import { createEvmFeesService } from './fees'
import { createEvmTransactionService } from './transaction'

export type EvmChainConfig = {
  chain: Chain
  chainName: string
  gasAssetDecimal: number
  isChainAsset: (asset: AnyAsset) => boolean
  createClientParams: (rpcUrl: string, network: Network) => Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ClientClass: new (params: any) => any
  rpc$: Rx.Observable<ApiUrls>
  hdSettings$?: Rx.Observable<KeystoreChainHDSettings>
  apiKey?: string
  addressInWhitelist: (addr: Address) => boolean
  assetsFallback: AnyAsset[]
  assetsTestnet: AnyAsset[]
  defaultGasLimit: number
  useEstimateGasLimit?: boolean
  balanceTransform?: (balance: WalletBalance) => WalletBalance
  initialReloadFeesParams?: TxParams
}

export const createEvmChainService = (config: EvmChainConfig) => {
  const { client$, clientState$, readOnlyClient$, address$, addressUI$, explorerUrl$ } = createEvmCommonService(config)

  const { reloadBalances, balances$, reloadBalances$, resetReloadBalances, getBalanceByAddress$, enhancedClient$ } =
    createEvmBalancesService(
      {
        chain: config.chain,
        assetsFallback: config.assetsFallback,
        assetsTestnet: config.assetsTestnet,
        balanceTransform: config.balanceTransform
      },
      client$,
      readOnlyClient$
    )

  const createTransactionService = (
    txClient$: Client$,
    network$: Network$,
    evmRpc$: Rx.Observable<ApiUrls>,
    gasMultiplier$?: Rx.Observable<number>,
    txReadOnlyClient$?: Client$
  ) =>
    createEvmTransactionService(
      {
        chain: config.chain,
        chainName: config.chainName,
        apiKey: config.apiKey,
        addressInWhitelist: config.addressInWhitelist,
        defaultGasLimit: config.defaultGasLimit,
        useEstimateGasLimit: config.useEstimateGasLimit
      },
      txClient$,
      network$,
      evmRpc$,
      gasMultiplier$,
      txReadOnlyClient$
    )

  const createFeesService = (feesClient$: Client$, gasMultiplier$?: Rx.Observable<number>) =>
    createEvmFeesService(
      {
        chain: config.chain,
        gasAssetDecimal: config.gasAssetDecimal,
        isChainAsset: config.isChainAsset,
        initialReloadFeesParams: config.initialReloadFeesParams
      },
      feesClient$,
      gasMultiplier$
    )

  return {
    client$,
    clientState$,
    readOnlyClient$,
    address$,
    addressUI$,
    explorerUrl$,
    reloadBalances,
    balances$,
    reloadBalances$,
    resetReloadBalances,
    getBalanceByAddress$,
    enhancedClient$,
    createTransactionService,
    createFeesService
  }
}
