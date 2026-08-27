import * as RD from '@devexperts/remote-data-ts'
import {
  Configuration,
  ConstantsResponse,
  LastBlockResponse,
  LiquidityProvidersApi,
  LiquidityProvidersResponse,
  LiquidityProviderSummary,
  MimirApi,
  NetworkApi,
  Node,
  NodesApi,
  NodesResponse,
  Saver,
  SaversApi,
  TransactionsApi,
  TxStagesResponse,
  PoolsApi,
  Pool,
  RUNEPoolApi,
  RUNEProvider,
  TradeAccountApi,
  TradeAccountResponse,
  TCYClaimersApi,
  TCYStakersApi,
  TCYStaker
} from '@xchainjs/xchain-thornode'
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
import { array as A, function as FP, number as N, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { getThornodeApiBaseUrls, requestThornodeApiBases } from '../../../shared/thorchain/const'
import { AssetRuneNative } from '../../../shared/utils/asset'
import { isSupportedChain } from '../../../shared/utils/chain'
import { isError } from '../../../shared/utils/guard'
import { WalletType } from '../../../shared/wallet/types'
import { Protocol } from '../../components/uielements/protocolSwitch/types'
import { ZERO_BASE_AMOUNT } from '../../const'
import { THORCHAIN_DECIMAL } from '../../helpers/assetHelper'
import { sequenceTOption } from '../../helpers/fpHelpers'
import { LiveData, liveData } from '../../helpers/rx/liveData'
import { triggerStream } from '../../helpers/stateHelper'
import { Network$ } from '../app/types'
import {
  Mimir,
  MimirLD,
  ThornodeApiUrlLD,
  LiquidityProvidersLD,
  NodeInfosLD,
  NodeInfos,
  ClientUrl$,
  InboundAddressesLD,
  ThorchainConstantsLD,
  ThorchainLastblockLD,
  SaverProviderLD,
  SaverProvider,
  InboundAddresses,
  TxStagesLD,
  TxStages,
  ThorchainPoolLD,
  ThorchainPool,
  NodeStatusEnum,
  RunePoolProviderLD,
  RunePoolProvider,
  TradeAccount,
  TradeAccountLD,
  LiquidityProvider,
  TcyClaimLD,
  TcyStakeLD,
  TcyStake,
  TcyClaim,
  ApiTcyClaimResponse
} from './types'

const height: number | undefined = undefined

export const getThornodeAPIConfiguration = (basePath: string): Configuration => {
  return new Configuration({ basePath })
}

export const createThornodeService$ = (network$: Network$, clientUrl$: ClientUrl$) => {
  // `TriggerStream` to reload THORNode url
  const { stream$: reloadThornodeUrl$, trigger: reloadThornodeUrl } = triggerStream()

  /**
   * Ordered REST bases: Liquify (keyed when set) → optional Asgardex API on mainnet.
   */
  const thornodeApiBaseUrls$: Rx.Observable<string[]> = Rx.combineLatest([
    network$,
    clientUrl$,
    reloadThornodeUrl$
  ]).pipe(
    RxOp.map(([network, url]) => getThornodeApiBaseUrls(url[network].node, network)),
    RxOp.distinctUntilChanged((a, b) => a.length === b.length && a.every((u, i) => u === b[i])),
    RxOp.shareReplay(1)
  )

  /**
   * Primary thornode URL (for UI / diagnostics). Requests use multi-base fallback.
   */
  const thornodeUrl$: ThornodeApiUrlLD = thornodeApiBaseUrls$.pipe(
    RxOp.map((urls) => (urls[0] ? RD.success(urls[0]) : RD.failure(new Error('No THORNode API URL configured')))),
    RxOp.shareReplay(1)
  )

  /** Run a THORNode REST call against each base until one succeeds. */
  const requestThornodeApi$ = <T>(request: (basePath: string) => Promise<T>): Rx.Observable<RD.RemoteData<Error, T>> =>
    thornodeApiBaseUrls$.pipe(
      RxOp.switchMap((urls) =>
        Rx.from(requestThornodeApiBases(urls, request)).pipe(
          RxOp.map((data) => RD.success(data)),
          RxOp.catchError((e: unknown) => Rx.of(RD.failure<Error>(isError(e) ? e : new Error(String(e))))),
          RxOp.startWith(RD.pending)
        )
      )
    )

  const apiGetNodeInfos$ = () =>
    requestThornodeApi$((basePath) =>
      new NodesApi(getThornodeAPIConfiguration(basePath))
        .nodes(height)
        .then((r: AxiosResponse<NodesResponse>) => r.data)
    )

  const loadInboundAddresses$ = (): InboundAddressesLD =>
    FP.pipe(
      requestThornodeApi$((basePath) =>
        new NetworkApi(getThornodeAPIConfiguration(basePath)).inboundAddresses().then((response) => {
          const data: InboundAddresses = response.data.map((item) => ({
            chain: item.chain || '',
            address: item.address || '',
            router: item.router || '',
            global_trading_paused: item.global_trading_paused,
            chain_trading_paused: item.chain_trading_paused,
            chain_lp_actions_paused: item.chain_lp_actions_paused,
            outbound_fee: item.outbound_fee,
            dust_threshold: item.dust_threshold,
            halted: item.halted || false,
            gas_rate: item.gas_rate,
            gas_rate_units: item.gas_rate_units,
            outbound_tx_size: item.outbound_tx_size
          }))
          return data
        })
      ),
      liveData.map(
        FP.flow(
          A.filterMap(({ chain, address, ...rest }) =>
            chain !== undefined && isSupportedChain(chain) && !!address ? O.some({ chain, address, ...rest }) : O.none
          )
        )
      )
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
   * Get `ThorchainConstants` data from THORNode
   */
  const apiGetThorchainConstants$ = requestThornodeApi$((basePath) =>
    new NetworkApi(getThornodeAPIConfiguration(basePath))
      .constants()
      .then((response: AxiosResponse<ConstantsResponse>) => response.data)
  )

  const { stream$: reloadThorchainConstants$, trigger: reloadThorchainConstants } = triggerStream()

  /**
   * Provides data of `ThorchainConstants`
   */
  const thorchainConstantsState$: ThorchainConstantsLD = FP.pipe(
    reloadThorchainConstants$,
    RxOp.debounceTime(300),
    RxOp.switchMap(() => apiGetThorchainConstants$),
    RxOp.startWith(RD.pending),
    RxOp.shareReplay(1),
    RxOp.catchError(() => Rx.of(RD.failure(Error('Failed to load THORChain constants'))))
  )

  /**
   * Api call to `lastblock` endpoint
   */
  const apiGetThorchainLastblock$ = requestThornodeApi$((basePath) =>
    new NetworkApi(getThornodeAPIConfiguration(basePath))
      .lastblock()
      .then((response: AxiosResponse<LastBlockResponse>) => response.data)
  )
  const { stream$: reloadTxStatus$, trigger: reloadTxStatus } = triggerStream()

  /**
   * Normalize transaction hash for Thornode API
   * Remove 0x prefix from EVM transaction hashes
   */
  const normalizeTxHash = (txHash: string): string => {
    // Remove 0x prefix for EVM chains (ETH, AVAX, BSC, ARB, BASE, etc.)
    return txHash.startsWith('0x') ? txHash.slice(2) : txHash
  }

  /**
   * Api call to `getTxStatus` endpoint
   */
  const apiGetTxStatus$ = (txHash: string) =>
    requestThornodeApi$((basePath) =>
      new TransactionsApi(getThornodeAPIConfiguration(basePath))
        .txStages(normalizeTxHash(txHash))
        .then((response: AxiosResponse<TxStagesResponse>) => response.data)
    )

  const getTxStatus$ = (txHash: string): TxStagesLD =>
    FP.pipe(
      reloadTxStatus$,
      RxOp.debounceTime(500),
      RxOp.switchMap((_) => apiGetTxStatus$(txHash)),
      liveData.map(
        // transform data -> TxStages
        (txStages): TxStages => {
          // Helper to safely convert to boolean - handles string "false"/"true" and actual booleans
          const toBoolean = (value: unknown): boolean => {
            if (typeof value === 'boolean') return value
            if (typeof value === 'string') return value.toLowerCase() === 'true'
            return Boolean(value)
          }

          return {
            inboundObserved: {
              finalCount: txStages.inbound_observed.final_count,
              completed: toBoolean(txStages.inbound_observed.completed)
            },
            inboundConfirmationCounted: {
              remainingConfirmationSeconds: txStages.inbound_confirmation_counted?.remaining_confirmation_seconds,
              completed: toBoolean(txStages.inbound_confirmation_counted?.completed)
            },
            inboundFinalised: {
              completed: toBoolean(txStages.inbound_finalised?.completed)
            },
            outBoundDelay: {
              remainDelaySeconds: txStages.outbound_delay?.remaining_delay_seconds,
              remainingDelayBlocks: txStages.outbound_delay?.remaining_delay_blocks,
              completed: txStages.outbound_delay?.completed
            },
            outboundSigned: {
              scheduledOutboundHeight: txStages.outbound_signed?.scheduled_outbound_height,
              blocksSinceScheduled: txStages.outbound_signed?.blocks_since_scheduled,
              completed: txStages.outbound_signed?.completed
            },
            swapStatus: {
              pending: txStages.swap_status?.pending,
              streaming: {
                interval: txStages.swap_status?.streaming?.interval,
                quantity: txStages.swap_status?.streaming?.quantity,
                count: txStages.swap_status?.streaming?.count
              }
            },
            swapFinalised: toBoolean(txStages.swap_finalised?.completed)
          }
        }
      ),
      RxOp.catchError((error: Error): TxStagesLD => {
        return Rx.of(RD.failure(Error(`Failed to load info for ${txHash}: ${error.message}`)))
      })
    )
  // `TriggerStream` to reload data of `ThorchainLastblock`
  const { stream$: reloadThorchainLastblock$, trigger: reloadThorchainLastblock } = triggerStream()

  /**
   * Loads data of `lastblock`
   */
  const loadThorchainLastblock$ = () =>
    apiGetThorchainLastblock$.pipe(
      // catch any errors if there any
      RxOp.catchError((error: Error) => Rx.of(RD.failure(error))),
      RxOp.startWith(RD.pending)
    )

  // 60s is enough for mimir halt height checks / pool maturity UI; cuts Liquify lastblock
  // traffic 4× vs 15s. Scheduled halt detection can lag by ~1 min at most (rare).
  const loadThorchainLastblockInterval$ = Rx.timer(0 /* no delay for first value */, 60 * 1000 /* every 60 sec  */)

  /**
   * State of `ThorchainLastblock`, it will be loaded data by first subscription only
   */
  const thorchainLastblockState$: ThorchainLastblockLD = FP.pipe(
    Rx.combineLatest([reloadThorchainLastblock$, loadThorchainLastblockInterval$]),
    // start request
    RxOp.switchMap((_) => loadThorchainLastblock$()),
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
          ({
            total_bond,
            current_award,
            status,
            node_address,
            bond_providers,
            signer_membership,
            node_operator_address,
            pub_key_set
          }) => ({
            address: node_address,
            pubKeySet: pub_key_set,
            bond: baseAmount(total_bond, THORCHAIN_DECIMAL),
            award: baseAmount(current_award, THORCHAIN_DECIMAL),
            nodeOperatorAddress: node_operator_address,
            status: status as NodeStatusEnum,
            bondProviders: {
              nodeOperatorFee: baseAmount(bond_providers.node_operator_fee, THORCHAIN_DECIMAL),
              providers: Array.isArray(bond_providers.providers)
                ? bond_providers.providers.map((provider) => ({
                    bondAddress: provider.bond_address ? provider.bond_address : '',
                    bond: baseAmount(provider.bond, THORCHAIN_DECIMAL)
                  }))
                : []
            },
            signMembership: signer_membership
          })
        )
      )
    ),
    RxOp.startWith(RD.initial),
    RxOp.shareReplay(1)
  )

  const apiGetLiquidityProviders$ = (asset: AnyAsset): LiveData<Error, LiquidityProviderSummary[]> =>
    requestThornodeApi$((basePath) =>
      new LiquidityProvidersApi(getThornodeAPIConfiguration(basePath))
        .liquidityProviders(assetToString(asset))
        .then((response: AxiosResponse<LiquidityProvidersResponse>) => response.data)
    )
  const { stream$: reloadLiquidityProviders$, trigger: reloadLiquidityProviders } = triggerStream()

  const getLiquidityProviders = (asset: AnyAsset): LiquidityProvidersLD =>
    FP.pipe(
      reloadLiquidityProviders$,
      RxOp.debounceTime(300),
      RxOp.switchMap((_) => apiGetLiquidityProviders$(asset)),
      liveData.map(
        A.map((provider): LiquidityProvider => {
          const oAsset = O.fromNullable(assetFromString(provider.asset))
          const pendingDexAsset = FP.pipe(
            /* 1e8 decimal by default at THORChain */
            baseAmount(bnOrZero(provider.pending_rune), THORCHAIN_DECIMAL),
            O.fromPredicate((v) => v.gt(ZERO_BASE_AMOUNT)),
            O.map((amount1e8) => ({
              asset: AssetRuneNative,
              amount1e8
            }))
          )
          const oPendingAssetAmount = FP.pipe(
            /* 1e8 decimal by default at THORChain */
            baseAmount(bnOrZero(provider.pending_asset), THORCHAIN_DECIMAL),
            O.fromPredicate((v) => v.gt(ZERO_BASE_AMOUNT))
          )
          const pendingAsset = FP.pipe(
            sequenceTOption(oAsset, oPendingAssetAmount),
            O.map(([asset, amount1e8]) => ({ asset, amount1e8 }))
          )

          return {
            dexAssetAddress: O.fromNullable(provider.rune_address),
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
  const apiGetTcyClaim$ = (address: Address): LiveData<Error, ApiTcyClaimResponse> =>
    requestThornodeApi$((basePath) =>
      new TCYClaimersApi(getThornodeAPIConfiguration(basePath))
        .tcyClaimer(address)
        .then((response: AxiosResponse<unknown>) => response.data as ApiTcyClaimResponse)
    )
  const { stream$: reloadTcyClaim$, trigger: reloadTcyClaim } = triggerStream()

  const getTcyClaim$ = (address: Address, walletType: WalletType): TcyClaimLD =>
    FP.pipe(
      reloadTcyClaim$,
      RxOp.debounceTime(300),
      RxOp.switchMap((_) =>
        apiGetTcyClaim$(address).pipe(
          liveData.map((response): TcyClaim[] =>
            response.tcy_claimer.map((item) => ({
              asset: assetFromStringEx(item.asset),
              amount: baseAmount(bnOrZero(item.amount), THORCHAIN_DECIMAL),
              walletType,
              l1Address: item.l1_address
            }))
          ),
          RxOp.catchError(
            (err: unknown): Rx.Observable<RD.RemoteData<Error, TcyClaim[]>> =>
              Rx.of(RD.failure(err instanceof Error ? err : new Error(`Unknown error for ${address}`)))
          )
        )
      ),
      RxOp.startWith(RD.pending)
    )
  const apiGetTcyStaker$ = (address: Address): LiveData<Error, TCYStaker> =>
    requestThornodeApi$((basePath) =>
      new TCYStakersApi(getThornodeAPIConfiguration(basePath))
        .tcyStaker(address)
        .then((response: AxiosResponse<TCYStaker>) => response.data)
    )
  const { stream$: reloadTcyStaker$, trigger: reloadTcyStaker } = triggerStream()

  const getTcyStaker$ = (address: Address): TcyStakeLD =>
    FP.pipe(
      reloadTcyStaker$,
      RxOp.debounceTime(300),
      RxOp.switchMap((_) => apiGetTcyStaker$(address)),
      liveData.map((claim): TcyStake => {
        const amount = baseAmount(bnOrZero(claim.amount), THORCHAIN_DECIMAL)
        const address = claim.address
        return { address, amount }
      }),
      RxOp.catchError((): TcyStakeLD => Rx.of(RD.failure(Error(`Failed to load claim info for ${address} `)))),
      RxOp.startWith(RD.pending)
    )

  const apiGetMimir$: MimirLD = FP.pipe(
    requestThornodeApi$(async (basePath) => {
      const response =
        height !== undefined
          ? await new MimirApi(getThornodeAPIConfiguration(basePath)).mimir(height)
          : await new MimirApi(getThornodeAPIConfiguration(basePath)).mimir()
      if (!('data' in response)) {
        throw new Error('Response is not an AxiosResponse')
      }
      const responseData = response.data
      if (!responseData || typeof responseData !== 'object') {
        throw new Error('Unexpected response format: responseData is not an object')
      }
      const result: Mimir = {}
      for (const [key, value] of Object.entries(responseData)) {
        const numberValue = Number(value)
        if (isNaN(numberValue)) {
          throw new Error(`Invalid value for key ${key}: ${value}`)
        }
        result[key] = numberValue
      }
      return result as Mimir
    }),
    RxOp.map((rd) => (RD.isFailure(rd) ? RD.failure(Error(`Failed loading mimir: ${JSON.stringify(rd.error)}`)) : rd))
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
    requestThornodeApi$((basePath) =>
      new SaversApi(getThornodeAPIConfiguration(basePath))
        .saver(assetToString(asset), address)
        .then((response: AxiosResponse<Saver>) => response.data)
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
          /* 1e8 decimal by default, which is default decimal for ALL accepts at THORChain  */
          const depositValue = baseAmount(asset_deposit_value, THORCHAIN_DECIMAL)
          const redeemValue = baseAmount(asset_redeem_value, THORCHAIN_DECIMAL)
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
  const apiGetRunePoolProvider$ = (address: Address): LiveData<Error, RUNEProvider> =>
    requestThornodeApi$((basePath) =>
      new RUNEPoolApi(getThornodeAPIConfiguration(basePath))
        .runeProvider(address)
        .then((response: AxiosResponse<RUNEProvider>) => response.data)
    )

  const { stream$: reloadRunePoolProvider$, trigger: reloadRunePoolProvider } = triggerStream()

  const getRunePoolProvider$ = (address: Address, walletType?: WalletType): RunePoolProviderLD =>
    FP.pipe(
      reloadRunePoolProvider$,
      RxOp.debounceTime(300),
      RxOp.switchMap((_) => apiGetRunePoolProvider$(address)),
      liveData.map(
        // transform RUNEPool -> RunepoolProvider
        (provider): RunePoolProvider => {
          const { value, pnl, deposit_amount, withdraw_amount, last_deposit_height, last_withdraw_height } = provider
          /* 1e8 decimal by default, which is default decimal for ALL accepts at THORChain  */
          const currentValue = baseAmount(value, THORCHAIN_DECIMAL)
          const depositAmount = baseAmount(deposit_amount, THORCHAIN_DECIMAL)
          const withdrawAmount = baseAmount(withdraw_amount, THORCHAIN_DECIMAL)
          const profitAndLoss = baseAmount(pnl, THORCHAIN_DECIMAL)
          const addHeight = FP.pipe(last_deposit_height, O.fromPredicate(N.isNumber))
          const withdrawHeight = FP.pipe(last_withdraw_height, O.fromPredicate(N.isNumber))
          return {
            address: provider.rune_address,
            value: currentValue,
            pnl: profitAndLoss,
            depositAmount,
            withdrawAmount,
            addHeight,
            withdrawHeight,
            walletType
          }
        }
      ),
      RxOp.catchError(
        (): RunePoolProviderLD => Rx.of(RD.failure(Error(`Failed to load info for ${address} provider`)))
      ),
      RxOp.startWith(RD.pending)
    )
  const apiGetThorchainPool$ = (asset: AnyAsset): LiveData<Error, Pool> =>
    requestThornodeApi$((basePath) =>
      new PoolsApi(getThornodeAPIConfiguration(basePath))
        .pool(assetToString(asset))
        .then((response: AxiosResponse<Pool>) => response.data)
    )
  const { stream$: reloadThorchainPool$, trigger: reloadThorchainPool } = triggerStream()

  /**
   * One-shot load of all THORNode pools (`GET /thorchain/pools`).
   * Used as Midgard `poolsState` fallback when Midgard is down.
   */
  const loadThorchainPools$ = (): LiveData<Error, Pool[]> =>
    requestThornodeApi$((basePath) =>
      new PoolsApi(getThornodeAPIConfiguration(basePath)).pools().then((response: AxiosResponse<Pool[]>) => {
        const data = response.data
        return Array.isArray(data) ? data : []
      })
    )

  const { stream$: reloadThorchainPools$, trigger: reloadThorchainPools } = triggerStream()

  const getThorchainPools$ = (): LiveData<Error, Pool[]> =>
    FP.pipe(
      reloadThorchainPools$,
      RxOp.debounceTime(300),
      RxOp.switchMap(() => loadThorchainPools$()),
      RxOp.catchError((): LiveData<Error, Pool[]> => Rx.of(RD.failure(Error('Failed to load THORNode pools')))),
      RxOp.startWith(RD.pending),
      RxOp.shareReplay(1)
    )

  const getThorchainPool$ = (asset: AnyAsset): ThorchainPoolLD =>
    FP.pipe(
      reloadThorchainPool$,
      RxOp.debounceTime(300),
      RxOp.switchMap((_) => apiGetThorchainPool$(asset)),
      liveData.map(
        // transform pool -> ThorchainPool
        (pool): ThorchainPool => {
          const {
            asset,
            short_code,
            status,
            decimals,
            pending_inbound_asset,
            pending_inbound_rune,
            balance_asset,
            balance_rune,
            pool_units,
            LP_units,
            synth_units,
            synth_supply,
            savers_depth,
            savers_units
          } = pool
          /* 1e8 decimal by default, which is default decimal for ALL accepts at THORChain  */
          const poolAsset = assetFromStringEx(asset)
          const shortCode = short_code ? short_code : ''
          const assetDecimal = Number(decimals)
          const pendingInboundAsset = baseAmount(pending_inbound_asset, THORCHAIN_DECIMAL)
          const pendingInboundRune = baseAmount(pending_inbound_rune, THORCHAIN_DECIMAL)
          const balanceAsset = baseAmount(balance_asset, THORCHAIN_DECIMAL)
          const balanceRune = baseAmount(balance_rune, THORCHAIN_DECIMAL)
          const synthSupply = baseAmount(synth_supply, THORCHAIN_DECIMAL)
          const saversDepth = baseAmount(savers_depth, THORCHAIN_DECIMAL)

          return {
            asset: poolAsset,
            shortCode,
            status: status,
            decimals: assetDecimal,
            pendingInboundAsset,
            pendingInboundRune,
            balanceAsset,
            balanceRune,
            poolUnits: pool_units,
            lpUnits: LP_units,
            synthUnits: synth_units,
            synthSupply,
            saversDepth,
            saversUnits: savers_units
          }
        }
      ),
      RxOp.catchError(
        (): ThorchainPoolLD => Rx.of(RD.failure(Error(`Failed to load info for ${assetToString(asset)} earner`)))
      ),
      RxOp.startWith(RD.pending)
    )

  const apiGetTradeAccount$ = (address: Address): LiveData<Error, TradeAccountResponse[]> =>
    requestThornodeApi$((basePath) =>
      new TradeAccountApi(getThornodeAPIConfiguration(basePath)).tradeAccount(address).then((response) => {
        const data = response.data
        return Array.isArray(data) ? data : [data]
      })
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
          /* 1e8 decimal by default, which is default decimal for ALL assets at THORChain  */
          const tradeAssetUnits = baseAmount(units, THORCHAIN_DECIMAL)
          return {
            owner,
            asset: assetFromStringEx(asset),
            units: tradeAssetUnits,
            lastAddHeight: FP.pipe(last_add_height, O.fromPredicate(N.isNumber)),
            lastWithdrawHeight: FP.pipe(last_withdraw_height, O.fromPredicate(N.isNumber)),
            walletType,
            protocol: Protocol.THORChain
          }
        })
      ),
      RxOp.catchError((): TradeAccountLD => Rx.of(RD.failure(Error(`Failed to load info for ${address} owner`)))),
      RxOp.startWith(RD.pending)
    )

  return {
    thornodeUrl$,
    reloadThornodeUrl,
    getNodeInfos$,
    reloadNodeInfos,
    reloadThorchainConstants,
    thorchainConstantsState$,
    thorchainLastblockState$,
    reloadThorchainLastblock,
    inboundAddressesShared$,
    reloadInboundAddresses,
    loadInboundAddresses$,
    mimir$,
    reloadMimir,
    getLiquidityProviders,
    reloadLiquidityProviders,
    getSaverProvider$,
    reloadSaverProvider,
    getRunePoolProvider$,
    reloadRunePoolProvider,
    getTxStatus$,
    reloadTxStatus,
    getThorchainPool$,
    reloadThorchainPool,
    loadThorchainPools$,
    getThorchainPools$,
    reloadThorchainPools,
    getTradeAccount$,
    reloadTradeAccount,
    getTcyClaim$,
    reloadTcyClaim,
    getTcyStaker$,
    reloadTcyStaker
  }
}
