import * as RD from '@devexperts/remote-data-ts'
import { AssetCacao, CACAO_DECIMAL } from '@xchainjs/xchain-mayachain'
import {
  Configuration,
  MimirApi,
  NetworkApi,
  Node,
  NodesApi,
  NodesResponse,
  LastBlockResponse,
  ConstantsResponse,
  InboundAddressesResponse,
  LiquidityProvidersApi,
  LiquidityProviderSummary,
  LiquidityProvidersResponse,
  Saver
} from '@xchainjs/xchain-mayanode'
import { SaversApi } from '@xchainjs/xchain-thornode'
import { Address, AnyAsset, assetFromString, assetToString, baseAmount, bnOrZero } from '@xchainjs/xchain-util'
import { AxiosResponse } from 'axios'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as N from 'fp-ts/lib/number'
import * as O from 'fp-ts/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isSupportedChain } from '../../../shared/utils/chain'
import { WalletType } from '../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../const'
import { sequenceTOption } from '../../helpers/fpHelpers'
import { LiveData, liveData } from '../../helpers/rx/liveData'
import { triggerStream } from '../../helpers/stateHelper'
import { Network$ } from '../app/types'
import { LiquidityProvidersLD, LiquidityProvider as LiquidityProviderMaya, NodeStatusEnum } from '../thorchain/types'
import {
  Mimir,
  MimirLD,
  MayanodeApiUrlLD,
  NodeInfosLD,
  NodeInfos,
  ClientUrl$,
  InboundAddressesLD,
  MayachainConstantsLD,
  MayachainLastblockLD,
  InboundAddresses,
  InboundAddress,
  SaverProviderLD,
  SaverProvider
} from './types'

const height: number | undefined = undefined

export const getMayanodeAPIConfiguration = (basePath: string): Configuration => {
  return new Configuration({ basePath })
}

export const createMayanodeService$ = (network$: Network$, clientUrl$: ClientUrl$) => {
  // `TriggerStream` to reload MAYANode url
  const { stream$: reloadMayanodeUrl$, trigger: reloadMayanodeUrl } = triggerStream()

  /**
   * Mayanode url
   */
  const mayanodeUrl$: MayanodeApiUrlLD = Rx.combineLatest([network$, clientUrl$, reloadMayanodeUrl$]).pipe(
    RxOp.map(([network, url, _]) => RD.success(`${url[network].node}`)),
    RxOp.shareReplay(1)
  )

  const apiGetNodeInfos$ = () =>
    FP.pipe(
      mayanodeUrl$,
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(new NodesApi(getMayanodeAPIConfiguration(basePath)).nodes(height)),
          RxOp.map((response: AxiosResponse<NodesResponse, unknown>) => RD.success(response.data)), // Extract nodes from AxiosResponse
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      ),
      RxOp.startWith(RD.pending)
    )

  const loadInboundAddresses$ = (): InboundAddressesLD =>
    FP.pipe(
      mayanodeUrl$,
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(new NetworkApi(getMayanodeAPIConfiguration(basePath)).inboundAddresses()),
          RxOp.map((response: AxiosResponse<InboundAddressesResponse, InboundAddress>) => {
            const data: InboundAddresses = response.data.map((item) => ({
              chain: item.chain || '', // provide a default value if chain is undefined
              address: item.address || '',
              router: item.router || '',
              global_trading_paused: item.global_trading_paused,
              chain_trading_paused: item.chain_trading_paused,
              chain_lp_actions_paused: item.chain_lp_actions_paused,
              outbound_fee: item.outbound_fee,
              halted: item.halted || false // provide a default value if halted is undefined
            }))
            return RD.success(data)
          }),
          liveData.map(
            FP.flow(
              A.filterMap(({ chain, address, ...rest }) =>
                // validate chain
                chain !== undefined &&
                isSupportedChain(chain) &&
                // address is required
                !!address
                  ? O.some({ chain, address, ...rest })
                  : O.none
              )
            )
          ),
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      ),
      RxOp.startWith(RD.pending)
    )

  // Trigger to reload pool addresses (`inbound_addresses`)
  const { stream$: reloadInboundAddresses$, trigger: reloadInboundAddresses } = triggerStream()
  const inboundAddressesInterval$ = Rx.timer(0 /* no delay for first value */, 5 * 60 * 1000 /* delay of 5 min  */)

  /**
   * Get's inbound addresses once and share result by next subscription
   *
   * It will be updated using a timer defined in `inboundAddressesInterval`
   * or by reloading of data possible by `reloadInboundAddresses`
   */
  const inboundAddressesShared$: InboundAddressesLD = FP.pipe(
    Rx.combineLatest([reloadInboundAddresses$, inboundAddressesInterval$]),
    // debounce it, reloadInboundAddresses might be called by UI many times
    RxOp.debounceTime(300),
    RxOp.switchMap((_) => loadInboundAddresses$()),
    RxOp.shareReplay(1)
  )

  /**
   * Get `MayachainConstants` data from Midgard
   */
  const apiGetMayachainConstants$ = FP.pipe(
    mayanodeUrl$,
    liveData.chain((basePath) =>
      FP.pipe(
        Rx.from(new NetworkApi(getMayanodeAPIConfiguration(basePath)).constants()),
        RxOp.map((response: AxiosResponse<ConstantsResponse>) => RD.success(response.data)), // Extract data from AxiosResponse
        RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
      )
    )
  )

  const { stream$: reloadMayachainConstants$, trigger: reloadMayachainConstants } = triggerStream()

  /**
   * Provides data of `MayachainConstants`
   */
  const mayachainConstantsState$: MayachainConstantsLD = FP.pipe(
    reloadMayachainConstants$,
    RxOp.debounceTime(300),
    RxOp.switchMap(() => apiGetMayachainConstants$),
    RxOp.startWith(RD.pending),
    RxOp.shareReplay(1),
    RxOp.catchError(() => Rx.of(RD.failure(Error('Failed to load MAYAChain constants'))))
  )

  /**
   * Api call to `lastblock` endpoint
   */
  const apiGetMayachainLastblock$ = FP.pipe(
    mayanodeUrl$,
    liveData.chain((basePath) =>
      FP.pipe(
        Rx.from(new NetworkApi(getMayanodeAPIConfiguration(basePath)).lastblock()),
        RxOp.map((response: AxiosResponse<LastBlockResponse>) => RD.success(response.data)), // Extract data from AxiosResponse
        RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
      )
    )
  )

  // `TriggerStream` to reload data of `MayachainLastblock`
  const { stream$: reloadMayachainLastblock$, trigger: reloadMayachainLastblock } = triggerStream()

  /**
   * Loads data of `lastblock`
   */
  const loadMayachainLastblock$ = () =>
    apiGetMayachainLastblock$.pipe(
      // catch any errors if there any
      RxOp.catchError((error: Error) => Rx.of(RD.failure(error))),
      RxOp.startWith(RD.pending)
    )

  const loadMayachainLastblockInterval$ = Rx.timer(0 /* no delay for first value */, 15 * 1000 /* every 15 sec  */)

  /**
   * State of `MayachainLastblock`, it will be loaded data by first subscription only
   */
  const mayachainLastblockState$: MayachainLastblockLD = FP.pipe(
    Rx.combineLatest([reloadMayachainLastblock$, loadMayachainLastblockInterval$]),
    // start request
    RxOp.switchMap((_) => loadMayachainLastblock$()),
    // cache it to avoid reloading data by every subscription
    RxOp.shareReplay(1)
  )

  const { stream$: reloadNodeInfos$, trigger: reloadNodeInfos } = triggerStream()

  const getNodeInfos$: NodeInfosLD = FP.pipe(
    reloadNodeInfos$,
    RxOp.debounceTime(300),
    RxOp.switchMap(apiGetNodeInfos$),
    liveData.map<Node[], NodeInfos>((nodes) =>
      FP.pipe(
        nodes,
        A.map(({ bond, reward, status, node_address, bond_providers, bond_address, signer_membership }) => {
          return {
            address: node_address,
            bond: baseAmount(bond, CACAO_DECIMAL),
            award: baseAmount(reward, CACAO_DECIMAL),
            status: status as NodeStatusEnum,
            nodeOperatorAddress: bond_address,
            bondProviders: {
              nodeOperatorFee: baseAmount(bond_providers.node_operator_fee, CACAO_DECIMAL),
              providers: Array.isArray(bond_providers.providers)
                ? bond_providers.providers.map((provider) => ({
                    bondAddress: provider.bond_address,
                    bond: baseAmount(provider.reward, CACAO_DECIMAL)
                  }))
                : []
            },
            signMembership: signer_membership
          }
        })
      )
    ),
    RxOp.startWith(RD.initial),
    RxOp.shareReplay(1),
    RxOp.catchError((e: Error) => {
      console.error('Error fetching node infos:', e)
      return Rx.of(RD.failure(e))
    })
  )

  const apiGetLiquidityProviders$ = (asset: AnyAsset): LiveData<Error, LiquidityProviderSummary[]> =>
    FP.pipe(
      mayanodeUrl$,
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(
            new LiquidityProvidersApi(getMayanodeAPIConfiguration(basePath)).liquidityProviders(assetToString(asset))
          ),
          RxOp.map((response: AxiosResponse<LiquidityProvidersResponse>) => RD.success(response.data)), // Extract data from AxiosResponse
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      )
    )
  const { stream$: reloadLiquidityProviders$, trigger: reloadLiquidityProviders } = triggerStream()

  const getLiquidityProviders = (asset: AnyAsset): LiquidityProvidersLD =>
    FP.pipe(
      reloadLiquidityProviders$,
      RxOp.debounceTime(300),
      RxOp.switchMap((_) => apiGetLiquidityProviders$(asset)),
      liveData.map(
        A.map((provider): LiquidityProviderMaya => {
          const oAsset = O.fromNullable(assetFromString(provider.asset))
          const pendingDexAsset = FP.pipe(
            /* 1e8 decimal by default at MAYAChain */
            baseAmount(bnOrZero(provider.pending_cacao), CACAO_DECIMAL),
            O.fromPredicate((v) => v.gt(ZERO_BASE_AMOUNT)),
            O.map((amount1e8) => ({
              asset: AssetCacao,
              amount1e8
            }))
          )
          const oPendingAssetAmount = FP.pipe(
            /* 1e8 decimal by default at MAYAChain */
            baseAmount(bnOrZero(provider.pending_asset), CACAO_DECIMAL),
            O.fromPredicate((v) => v.gt(ZERO_BASE_AMOUNT))
          )
          const pendingAsset = FP.pipe(
            sequenceTOption(oAsset, oPendingAssetAmount),
            O.map(([asset, amount1e8]) => ({ asset, amount1e8 }))
          )

          return {
            dexAssetAddress: O.fromNullable(provider.cacao_address),
            assetAddress: O.fromNullable(provider.asset_address),
            pendingDexAsset,
            pendingAsset
          }
        })
      ),
      RxOp.catchError(
        (): LiquidityProvidersLD => Rx.of(RD.failure(Error(`Failed to load info for ${assetToString(asset)} pool`)))
      ),
      RxOp.startWith(RD.pending)
    )

  const apiGetMimir$: MimirLD = FP.pipe(
    mayanodeUrl$,
    liveData.chain((basePath) =>
      FP.pipe(
        Rx.from(
          height !== undefined
            ? new MimirApi(getMayanodeAPIConfiguration(basePath)).mimir(height)
            : new MimirApi(getMayanodeAPIConfiguration(basePath)).mimir()
        ),
        RxOp.catchError((e) => Rx.of(RD.failure(Error(`Failed loading mimir: ${JSON.stringify(e)}`)))),
        RxOp.map((response) => {
          if (typeof response === 'object' && response !== null) {
            const result: Mimir = {}
            for (const [key, value] of Object.entries(response)) {
              const numberValue = Number(value)
              if (isNaN(numberValue)) {
                return RD.failure(new Error(`Invalid value for key "${key}": ${value} cannot be converted to a number`))
              }
              result[key] = numberValue
            }
            return RD.success(result as Mimir)
          } else {
            return RD.failure(new Error('Unexpected response format: response is not a valid object'))
          }
        })
      )
    )
  )

  const { stream$: reloadMimir$, trigger: reloadMimir } = triggerStream()

  const mimirInterval$ = Rx.timer(0 /* no delay for first value */, 5 * 60 * 1000 /* others are delayed by 5 min  */)

  const mimir$: MimirLD = FP.pipe(
    Rx.combineLatest([reloadMimir$, mimirInterval$]),
    RxOp.debounceTime(300),
    RxOp.switchMap(() => apiGetMimir$),
    RxOp.startWith(RD.pending),
    RxOp.shareReplay(1)
  )

  const apiGetSaverProvider$ = (asset: AnyAsset, address: Address): LiveData<Error, Saver> =>
    FP.pipe(
      mayanodeUrl$,
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(new SaversApi(getMayanodeAPIConfiguration(basePath)).saver(assetToString(asset), address)),
          RxOp.map((response: AxiosResponse<Saver>) => RD.success(response.data)), // Extract data from AxiosResponse
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      ),
      RxOp.startWith(RD.pending)
    )

  const { stream$: reloadSaverProvider$, trigger: reloadSaverProvider } = triggerStream()

  const getSaverProvider$ = (asset: AnyAsset, address: Address, walletType?: WalletType): SaverProviderLD =>
    FP.pipe(
      reloadSaverProvider$,
      RxOp.debounceTime(300),
      RxOp.switchMap((_) => apiGetSaverProvider$(asset, address)),
      liveData.map(
        // transform Saver -> SaverProvider
        (provider): SaverProvider => {
          const { asset_deposit_value, asset_redeem_value, growth_pct, last_add_height, last_withdraw_height } =
            provider
          /* 1e8 decimal by default, which is default decimal for ALL accets at MAYAChain  */
          const depositValue = baseAmount(asset_deposit_value, CACAO_DECIMAL)
          const redeemValue = baseAmount(asset_redeem_value, CACAO_DECIMAL)
          const growthPercent = bnOrZero(growth_pct)
          const addHeight = FP.pipe(last_add_height, O.fromPredicate(N.isNumber))
          const withdrawHeight = FP.pipe(last_withdraw_height, O.fromPredicate(N.isNumber))
          return {
            address: provider.asset_address,
            depositValue,
            redeemValue,
            growthPercent,
            addHeight,
            withdrawHeight,
            walletType
          }
        }
      ),
      RxOp.catchError(
        (): SaverProviderLD => Rx.of(RD.failure(Error(`Failed to load info for ${assetToString(asset)} saver`)))
      ),
      RxOp.startWith(RD.pending)
    )

  return {
    mayanodeUrl$,
    reloadMayanodeUrl,
    getNodeInfos$,
    reloadNodeInfos,
    reloadMayachainConstants,
    mayachainConstantsState$,
    mayachainLastblockState$,
    reloadMayachainLastblock,
    inboundAddressesShared$,
    reloadInboundAddresses,
    loadInboundAddresses$,
    mimir$,
    reloadMimir,
    getLiquidityProviders,
    reloadLiquidityProviders,
    getSaverProvider$,
    reloadSaverProvider
  }
}
