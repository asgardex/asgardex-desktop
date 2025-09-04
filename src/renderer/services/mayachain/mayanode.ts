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
  Saver,
  LiquidityProvider,
  PoolsApi,
  PoolsResponse,
  TradeAccountResponse,
  TradeAccountApi
} from '@xchainjs/xchain-mayanode'
import { SaversApi } from '@xchainjs/xchain-thornode'
import {
  Address,
  AnyAsset,
  assetFromString,
  assetFromStringEx,
  assetToString,
  baseAmount,
  bnOrZero
} from '@xchainjs/xchain-util'
import { AxiosResponse } from 'axios'
import BigNumber from 'bignumber.js'
import { array as A, function as FP, number as N, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { isSupportedChain } from '../../../shared/utils/chain'
import { WalletType } from '../../../shared/wallet/types'
import { Protocol } from '../../components/uielements/protocolSwitch/types'
import { ZERO_BASE_AMOUNT } from '../../const'
import { sequenceTOption } from '../../helpers/fpHelpers'
import { LiveData, liveData } from '../../helpers/rx/liveData'
import { triggerStream } from '../../helpers/stateHelper'
import { Network$ } from '../app/types'
import {
  LiquidityProvidersLD,
  LiquidityProvider as LiquidityProvidersMaya,
  NodeStatusEnum,
  LiquidityProviderForPool,
  LiquidityProviderForPoolLD,
  MayanodePoolsLD,
  MayanodePools,
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
  SaverProvider,
  TradeAccountLD,
  TradeAccount
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
   * Gets inbound addresses once and share result by next subscription
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
        A.map(
          ({ bond, reward, status, node_address, bond_providers, bond_address, signer_membership, pub_key_set }) => {
            return {
              address: node_address,
              pubKeySet: pub_key_set,
              bond: baseAmount(bond, CACAO_DECIMAL),
              award: baseAmount(reward, CACAO_DECIMAL),
              status: status as NodeStatusEnum,
              nodeOperatorAddress: bond_address,
              bondProviders: {
                nodeOperatorFee: baseAmount(bond_providers.node_operator_fee, CACAO_DECIMAL),
                providers: Array.isArray(bond_providers.providers)
                  ? bond_providers.providers.map((provider) => ({
                      bondAddress: provider.bond_address,
                      bonded: provider.bonded,
                      pools: Object.entries(provider.pools).map(([pool, amount]) => {
                        const asset = assetFromStringEx(pool)
                        return {
                          asset,
                          units: Number(amount)
                        }
                      })
                    }))
                  : []
              },
              signMembership: signer_membership
            }
          }
        )
      )
    ),
    RxOp.startWith(RD.initial),
    RxOp.shareReplay(1),
    RxOp.catchError((e: Error) => {
      console.error('Error fetching node infos:', e)
      return Rx.of(RD.failure(e))
    })
  )

  const apiGetLiquidityProvider$ = (asset: AnyAsset, address: Address): LiveData<Error, LiquidityProvider> =>
    FP.pipe(
      mayanodeUrl$,
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(
            new LiquidityProvidersApi(getMayanodeAPIConfiguration(basePath)).liquidityProvider(
              assetToString(asset),
              address
            )
          ),
          RxOp.map((response: AxiosResponse<LiquidityProvider>) => RD.success(response.data)), // Extract data from AxiosResponse
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      )
    )
  const { stream$: reloadLiquidityProvider$, trigger: reloadLiquidityProvider } = triggerStream()

  const getLiquidityProvider = (asset: AnyAsset, address: Address): LiquidityProviderForPoolLD =>
    FP.pipe(
      reloadLiquidityProvider$,
      RxOp.debounceTime(300),
      RxOp.switchMap((_) => apiGetLiquidityProvider$(asset, address)),
      liveData.map((provider): LiquidityProviderForPool => {
        return {
          asset: assetFromStringEx(provider.asset),
          cacaoAddress: O.fromNullable(provider.cacao_address),
          lastAddHeight: O.fromNullable(provider.last_add_height),
          assetAddress: O.fromNullable(provider.asset_address),
          lastWithdrawHeight: O.fromNullable(provider.last_withdraw_height),
          units: provider.units || '0',
          pendingCacao: baseAmount(bnOrZero(provider.pending_cacao)),
          pendingAsset: baseAmount(bnOrZero(provider.pending_asset)),
          cacaoDepositValue: baseAmount(bnOrZero(provider.cacao_deposit_value)),
          assetDepositValue: baseAmount(bnOrZero(provider.asset_deposit_value)),
          withdrawCounter: provider.withdraw_counter || '0',
          bondedNodes: provider.bonded_nodes,
          cacaoRedeemValue: baseAmount(bnOrZero(provider.cacao_redeem_value)),
          assetRedeemValue: baseAmount(bnOrZero(provider.asset_redeem_value))
        }
      }),
      RxOp.catchError(
        (): LiquidityProviderForPoolLD =>
          Rx.of(RD.failure(Error(`Failed to load info for ${assetToString(asset)} pool`)))
      ),
      RxOp.startWith(RD.pending)
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
        A.map((provider): LiquidityProvidersMaya => {
          const oAsset = O.fromNullable(assetFromString(provider.asset))
          const pendingDexAsset = FP.pipe(
            /* 1e10 decimal by default at MAYAChain */
            baseAmount(bnOrZero(provider.pending_cacao), CACAO_DECIMAL),
            O.fromPredicate((v) => v.gt(ZERO_BASE_AMOUNT)),
            O.map((amount1e8) => ({
              asset: AssetCacao,
              amount1e8
            }))
          )
          const oPendingAssetAmount = FP.pipe(
            /* 1e10 decimal by default at MAYAChain */
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
          if ('data' in response) {
            const responseData = response.data
            if (responseData && typeof responseData === 'object') {
              const result: Mimir = {}
              for (const [key, value] of Object.entries(responseData)) {
                const numberValue = Number(value)
                if (!isNaN(numberValue)) {
                  result[key] = numberValue
                } else {
                  return RD.failure(new Error(`Invalid value for key ${key}: ${value}`))
                }
              }
              return RD.success(result as Mimir)
            } else {
              return RD.failure(new Error('Unexpected response format: responseData is not an object'))
            }
          } else {
            return RD.failure(new Error('Response is not an AxiosResponse'))
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
          /* 1e8 decimal by default, which is default decimal for ALL accepts at MAYAChain  */
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

  const apiGetMayanodePools$ = (): LiveData<Error, PoolsResponse> =>
    FP.pipe(
      mayanodeUrl$,
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(new PoolsApi(getMayanodeAPIConfiguration(basePath)).pools()),
          RxOp.map((response: AxiosResponse<PoolsResponse>) => RD.success(response.data)), // Extract data from AxiosResponse
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      ),
      RxOp.startWith(RD.pending)
    )

  const { stream$: reloadMayanodePools$, trigger: reloadMayanodePools } = triggerStream()

  const getMayanodePools = (): MayanodePoolsLD =>
    FP.pipe(
      reloadMayanodePools$,
      RxOp.debounceTime(300),
      RxOp.switchMap((_) => apiGetMayanodePools$()),
      liveData.map(
        // transform pools
        (pools): MayanodePools => {
          // Assuming pools is an array of raw pool data from the API
          return pools.map((pool) => {
            return {
              balanceCacao: baseAmount(pool.balance_cacao, CACAO_DECIMAL),
              balanceAsset: baseAmount(pool.balance_asset),
              asset: assetFromStringEx(pool.asset),
              lpUnits: new BigNumber(pool.LP_units),
              poolUnits: new BigNumber(pool.pool_units),
              status: pool.status,
              decimals: pool.decimals,
              synthUnits: pool.synth_units,
              synthSupply: pool.synth_supply,
              pendingCacaoInbound: baseAmount(pool.pending_inbound_cacao, CACAO_DECIMAL),
              pendingAssetInbound: baseAmount(pool.pending_inbound_asset),
              saversUnits: pool.savers_units,
              synthMintPaused: pool.synth_mint_paused,
              bondable: pool.bondable
            }
          })
        }
      ),
      RxOp.catchError((): MayanodePoolsLD => Rx.of(RD.failure(Error(`Failed to load mayanodePools`)))),
      RxOp.startWith(RD.pending)
    )

  const apiGetTradeAccount$ = (address: Address): LiveData<Error, TradeAccountResponse[]> =>
    FP.pipe(
      mayanodeUrl$, // Fetch the base URL
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(new TradeAccountApi(getMayanodeAPIConfiguration(basePath)).tradeAccount(address)), // Call the API
          RxOp.map(
            (response: AxiosResponse<TradeAccountResponse>) =>
              RD.success(Array.isArray(response.data) ? response.data : [response.data]) // Handle single object as array
          ),
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e))) // Handle errors
        )
      ),
      RxOp.startWith(RD.pending) // Start with pending state
    )

  const { stream$: reloadTradeAccount$, trigger: reloadTradeAccount } = triggerStream()

  const getTradeAccount$ = (address: Address, walletType: WalletType): TradeAccountLD =>
    FP.pipe(
      reloadTradeAccount$,
      RxOp.debounceTime(300),
      RxOp.switchMap((_) => apiGetTradeAccount$(address)),
      liveData.map((tradeAccounts) =>
        tradeAccounts.map((tradeAccount): TradeAccount => {
          const { owner, units, asset, last_add_height, last_withdraw_height } = tradeAccount
          /* 1e10 decimal by default, which is default decimal for ALL assets at MAYChain  */
          const tradeAssetUnits = baseAmount(units)
          return {
            owner,
            asset: assetFromStringEx(asset),
            units: tradeAssetUnits,
            lastAddHeight: FP.pipe(last_add_height, O.fromPredicate(N.isNumber)),
            lastWithdrawHeight: FP.pipe(last_withdraw_height, O.fromPredicate(N.isNumber)),
            walletType,
            protocol: Protocol.MAYAChain
          }
        })
      ),
      RxOp.catchError((): TradeAccountLD => Rx.of(RD.failure(Error(`Failed to load info for ${address} owner`)))),
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
    getLiquidityProvider,
    reloadLiquidityProvider,
    getLiquidityProviders,
    reloadLiquidityProviders,
    getSaverProvider$,
    reloadSaverProvider,
    getMayanodePools,
    reloadMayanodePools,
    getTradeAccount$,
    reloadTradeAccount
  }
}
