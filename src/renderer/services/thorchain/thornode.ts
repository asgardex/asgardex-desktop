import * as RD from '@devexperts/remote-data-ts'
import {
  Configuration,
  ConstantsResponse,
  InboundAddressesResponse,
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
  BorrowersApi,
  Borrower,
  PoolsApi,
  Pool,
  QuoteApi,
  QuoteLoanOpenResponse,
  QuoteLoanCloseResponse,
  RUNEPoolApi,
  RUNEProvider,
  TradeAccountApi,
  TradeAccountResponse
} from '@xchainjs/xchain-thornode'
import {
  Address,
  AnyAsset,
  assetFromString,
  assetFromStringEx,
  assetToString,
  BaseAmount,
  baseAmount,
  bnOrZero
} from '@xchainjs/xchain-util'
import { AxiosResponse } from 'axios'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as N from 'fp-ts/lib/number'
import * as O from 'fp-ts/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { AssetRuneNative } from '../../../shared/utils/asset'
import { isSupportedChain } from '../../../shared/utils/chain'
import { WalletType } from '../../../shared/wallet/types'
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
  LiquidityProvider,
  NodeInfosLD,
  NodeInfos,
  ClientUrl$,
  InboundAddressesLD,
  ThorchainConstantsLD,
  ThorchainLastblockLD,
  SaverProviderLD,
  SaverProvider,
  InboundAddresses,
  InboundAddress,
  TxStagesLD,
  TxStages,
  BorrowerProviderLD,
  BorrowerProvider,
  ThorchainPoolLD,
  ThorchainPool,
  LoanOpenQuoteLD,
  LoanOpenQuote,
  BlockInformation,
  LoanCloseQuote,
  LoanCloseQuoteLD,
  NodeStatusEnum,
  RunePoolProviderLD,
  RunePoolProvider,
  TradeAccount,
  TradeAccountLD
} from './types'

const height: number | undefined = undefined

export const getThornodeAPIConfiguration = (basePath: string): Configuration => {
  return new Configuration({ basePath })
}

export const createThornodeService$ = (network$: Network$, clientUrl$: ClientUrl$) => {
  // `TriggerStream` to reload THORNode url
  const { stream$: reloadThornodeUrl$, trigger: reloadThornodeUrl } = triggerStream()

  /**
   * Thornode url
   */
  const thornodeUrl$: ThornodeApiUrlLD = Rx.combineLatest([network$, clientUrl$, reloadThornodeUrl$]).pipe(
    RxOp.map(([network, url, _]) => RD.success(`${url[network].node}`)),
    RxOp.shareReplay(1)
  )

  const apiGetNodeInfos$ = () =>
    FP.pipe(
      thornodeUrl$,
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(new NodesApi(getThornodeAPIConfiguration(basePath)).nodes(height)),
          RxOp.map((response: AxiosResponse<NodesResponse, unknown>) => RD.success(response.data)), // Extract nodes from AxiosResponse
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      ),
      RxOp.startWith(RD.pending)
    )

  const loadInboundAddresses$ = (): InboundAddressesLD =>
    FP.pipe(
      thornodeUrl$,
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(new NetworkApi(getThornodeAPIConfiguration(basePath)).inboundAddresses()),
          RxOp.map((response: AxiosResponse<InboundAddressesResponse, InboundAddress>) => {
            const data: InboundAddresses = response.data.map((item) => ({
              chain: item.chain || '', // provide a default value if chain is undefined
              address: item.address || '',
              router: item.router || '',
              global_trading_paused: item.global_trading_paused,
              chain_trading_paused: item.chain_trading_paused,
              chain_lp_actions_paused: item.chain_lp_actions_paused,
              outbound_fee: item.outbound_fee,
              dust_threshold: item.dust_threshold,
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
   * Get `ThorchainConstants` data from Midgard
   */
  const apiGetThorchainConstants$ = FP.pipe(
    thornodeUrl$,
    liveData.chain((basePath) =>
      FP.pipe(
        Rx.from(new NetworkApi(getThornodeAPIConfiguration(basePath)).constants()),
        RxOp.map((response: AxiosResponse<ConstantsResponse>) => RD.success(response.data)), // Extract data from AxiosResponse
        RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
      )
    )
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
  const apiGetThorchainLastblock$ = FP.pipe(
    thornodeUrl$,
    liveData.chain((basePath) =>
      FP.pipe(
        Rx.from(new NetworkApi(getThornodeAPIConfiguration(basePath)).lastblock()),
        RxOp.map((response: AxiosResponse<LastBlockResponse>) => RD.success(response.data)), // Extract data from AxiosResponse
        RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
      )
    )
  )
  const { stream$: reloadTxStatus$, trigger: reloadTxStatus } = triggerStream()
  /**
   * Api call to `getTxStatus` endpoint
   */
  const apiGetTxStatus$ = (txHash: string) =>
    FP.pipe(
      thornodeUrl$,
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(new TransactionsApi(getThornodeAPIConfiguration(basePath)).txStages(txHash)),
          RxOp.map((response: AxiosResponse<TxStagesResponse>) => RD.success(response.data)), // Extract data from AxiosResponse
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      )
    )

  const getTxStatus$ = (txHash: string): TxStagesLD =>
    FP.pipe(
      reloadTxStatus$,
      RxOp.debounceTime(500),
      RxOp.switchMap((_) => apiGetTxStatus$(txHash)),
      liveData.map(
        // transform data -> TxStages
        (txStages): TxStages => {
          return {
            inboundObserved: {
              finalCount: txStages.inbound_observed.final_count,
              completed: txStages.inbound_observed.completed
            },
            inboundConfirmationCounted: {
              remainingConfirmationSeconds: txStages.inbound_confirmation_counted?.remaining_confirmation_seconds,
              completed: txStages.inbound_confirmation_counted?.completed
                ? txStages.inbound_confirmation_counted?.completed
                : false
            },
            inboundFinalised: {
              completed: txStages.inbound_finalised?.completed ? txStages.inbound_finalised?.completed : false
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
            swapFinalised: txStages.swap_finalised?.completed ? txStages.swap_finalised?.completed : false
          }
        }
      ),
      RxOp.catchError((): TxStagesLD => Rx.of(RD.failure(Error(`Failed to load info for ${txHash}`))))
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

  const loadThorchainLastblockInterval$ = Rx.timer(0 /* no delay for first value */, 15 * 1000 /* every 15 sec  */)

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
            node_operator_address
          }) => ({
            address: node_address,
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
    FP.pipe(
      thornodeUrl$,
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(
            new LiquidityProvidersApi(getThornodeAPIConfiguration(basePath)).liquidityProviders(assetToString(asset))
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

  const apiGetMimir$: MimirLD = FP.pipe(
    thornodeUrl$,
    liveData.chain((basePath) =>
      FP.pipe(
        Rx.from(
          height !== undefined
            ? new MimirApi(getThornodeAPIConfiguration(basePath)).mimir(height)
            : new MimirApi(getThornodeAPIConfiguration(basePath)).mimir()
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
      thornodeUrl$,
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(new SaversApi(getThornodeAPIConfiguration(basePath)).saver(assetToString(asset), address)),
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
          /* 1e8 decimal by default, which is default decimal for ALL accets at THORChain  */
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
    FP.pipe(
      thornodeUrl$,
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(new RUNEPoolApi(getThornodeAPIConfiguration(basePath)).runeProvider(address)),
          RxOp.map((response: AxiosResponse<RUNEProvider>) => RD.success(response.data)), // Extract data from AxiosResponse
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      ),
      RxOp.startWith(RD.pending)
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
          /* 1e8 decimal by default, which is default decimal for ALL accets at THORChain  */
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
    FP.pipe(
      thornodeUrl$,
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(new PoolsApi(getThornodeAPIConfiguration(basePath)).pool(assetToString(asset))),
          RxOp.map((response: AxiosResponse<Pool>) => RD.success(response.data)), // Extract data from AxiosResponse
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      ),
      RxOp.startWith(RD.pending)
    )
  const { stream$: reloadThorchainPool$, trigger: reloadThorchainPool } = triggerStream()

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
            savers_units,
            loan_collateral,
            loan_collateral_remaining,
            loan_cr
          } = pool
          /* 1e8 decimal by default, which is default decimal for ALL accets at THORChain  */
          const poolAsset = assetFromStringEx(asset)
          const shortCode = short_code ? short_code : ''
          const assetDecimal = Number(decimals)
          const pendingInboundAsset = baseAmount(pending_inbound_asset, THORCHAIN_DECIMAL)
          const pendingInboundRune = baseAmount(pending_inbound_rune, THORCHAIN_DECIMAL)
          const balanceAsset = baseAmount(balance_asset, THORCHAIN_DECIMAL)
          const balanceRune = baseAmount(balance_rune, THORCHAIN_DECIMAL)
          const synthSupply = baseAmount(synth_supply, THORCHAIN_DECIMAL)
          const saversDepth = baseAmount(savers_depth, THORCHAIN_DECIMAL)
          const loanCollateral = baseAmount(loan_collateral, THORCHAIN_DECIMAL)
          const loanCollateralRemaining = baseAmount(loan_collateral_remaining, THORCHAIN_DECIMAL)

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
            saversUnits: savers_units,
            loanCollateral,
            loanCollateralRemaining,
            loanCr: Number(loan_cr)
          }
        }
      ),
      RxOp.catchError(
        (): ThorchainPoolLD => Rx.of(RD.failure(Error(`Failed to load info for ${assetToString(asset)} borrower`)))
      ),
      RxOp.startWith(RD.pending)
    )

  const apiGetTradeAccount$ = (address: Address): LiveData<Error, TradeAccountResponse[]> =>
    FP.pipe(
      thornodeUrl$, // Fetch the base URL
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(new TradeAccountApi(getThornodeAPIConfiguration(basePath)).tradeAccount(address)), // Call the API
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
          /* 1e8 decimal by default, which is default decimal for ALL accets at THORChain  */
          const tradeAssetUnits = baseAmount(units, THORCHAIN_DECIMAL)
          return {
            owner,
            asset: assetFromStringEx(asset),
            units: tradeAssetUnits,
            lastAddHeight: FP.pipe(last_add_height, O.fromPredicate(N.isNumber)),
            lastWithdrawHeight: FP.pipe(last_withdraw_height, O.fromPredicate(N.isNumber)),
            walletType
          }
        })
      ),
      RxOp.catchError((): TradeAccountLD => Rx.of(RD.failure(Error(`Failed to load info for ${address} owner`)))),
      RxOp.startWith(RD.pending)
    )

  const apiGetBorrowerProvider$ = (asset: AnyAsset, address: Address): LiveData<Error, Borrower> =>
    FP.pipe(
      thornodeUrl$,
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(new BorrowersApi(getThornodeAPIConfiguration(basePath)).borrower(assetToString(asset), address)),
          RxOp.map((response: AxiosResponse<Borrower>) => RD.success(response.data)), // Extract data from AxiosResponse
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      ),
      RxOp.startWith(RD.pending)
    )
  const { stream$: reloadBorrowerProvider$, trigger: reloadBorrowerProvider } = triggerStream()

  const getBorrowerProvider$ = (asset: AnyAsset, address: Address, walletType?: WalletType): BorrowerProviderLD =>
    FP.pipe(
      reloadBorrowerProvider$,
      RxOp.debounceTime(300),
      RxOp.switchMap((_) => apiGetBorrowerProvider$(asset, address)),
      liveData.map(
        // transform Borrower -> BorrowerProvider
        (provider): BorrowerProvider => {
          const {
            debt_issued,
            debt_repaid,
            debt_current,
            collateral_deposited,
            collateral_withdrawn,
            collateral_current,
            last_open_height,
            last_repay_height
          } = provider
          /* 1e8 decimal by default, which is default decimal for ALL accets at THORChain  */
          const debtIssued = baseAmount(debt_issued, THORCHAIN_DECIMAL)
          const debtRepaid = baseAmount(debt_repaid, THORCHAIN_DECIMAL)
          const debtCurrent = baseAmount(debt_current, THORCHAIN_DECIMAL)
          const collateralDeposited = baseAmount(collateral_deposited, THORCHAIN_DECIMAL)
          const collateralWithdrawn = baseAmount(collateral_withdrawn, THORCHAIN_DECIMAL)
          const collateralCurrent = baseAmount(collateral_current, THORCHAIN_DECIMAL)
          const lastOpenHeight = FP.pipe(last_open_height, O.fromPredicate(N.isNumber))
          const lastRepayHeight = FP.pipe(last_repay_height, O.fromPredicate(N.isNumber))
          return {
            owner: provider.owner,
            asset,
            debtIssued,
            debtRepaid,
            debtCurrent,
            collateralDeposited,
            collateralWithdrawn,
            collateralCurrent,
            lastOpenHeight,
            lastRepayHeight,
            walletType
          }
        }
      ),
      RxOp.catchError(
        (): BorrowerProviderLD => Rx.of(RD.failure(Error(`Failed to load info for ${assetToString(asset)} borrower`)))
      ),
      RxOp.startWith(RD.pending)
    )
  const apiGetLoanQuoteOpen$ = (
    asset: AnyAsset,
    amount: BaseAmount,
    targetAsset: AnyAsset,
    destination: string,
    minOut?: string,
    affiliateBps?: number,
    affiliate?: string,
    height?: number
  ): LiveData<Error, QuoteLoanOpenResponse> =>
    FP.pipe(
      thornodeUrl$,
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(
            new QuoteApi(getThornodeAPIConfiguration(basePath)).quoteloanopen(
              height,
              assetToString(asset),
              amount.amount().toNumber(),
              assetToString(targetAsset),
              destination,
              minOut,
              affiliateBps,
              affiliate
            )
          ),
          RxOp.map((response: AxiosResponse<QuoteLoanOpenResponse>) => RD.success(response.data)), // Extract data from AxiosResponse
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      ),
      RxOp.startWith(RD.pending)
    )
  const { stream$: reloadLoanQuoteOpen$, trigger: reloadLoanQuoteOpen } = triggerStream()

  const getLoanQuoteOpen$ = (
    asset: AnyAsset,
    amount: BaseAmount,
    targetAsset: AnyAsset,
    destination: string,
    minOut?: string,
    affiliateBps?: number,
    affiliate?: string,
    height?: number
  ): LoanOpenQuoteLD =>
    FP.pipe(
      reloadLoanQuoteOpen$,
      RxOp.debounceTime(300),
      RxOp.switchMap((_) =>
        apiGetLoanQuoteOpen$(asset, amount, targetAsset, destination, minOut, affiliateBps, affiliate, height)
      ),
      liveData.map(
        // transform quote -> quoteType
        (quote): LoanOpenQuote => {
          const {
            inbound_address,
            inbound_confirmation_blocks,
            inbound_confirmation_seconds,
            outbound_delay_blocks,
            outbound_delay_seconds,
            fees,
            router,
            expiry,
            warning,
            notes,
            dust_threshold,
            recommended_min_amount_in,
            memo,
            expected_amount_out,
            expected_collateralization_ratio,
            expected_collateral_deposited,
            expected_debt_issued,
            total_open_loan_seconds
          } = quote
          /* 1e8 decimal by default, which is default decimal for ALL accets at THORChain  */
          const expectedWait: BlockInformation = {
            inboundConfirmationBlocks: inbound_confirmation_blocks,
            inboundConfirmationSeconds: inbound_confirmation_seconds,
            outboundDelayBlocks: outbound_delay_blocks,
            outbondDelaySeconds: outbound_delay_seconds
          }
          const recommendedMinAmountIn = baseAmount(
            recommended_min_amount_in ? recommended_min_amount_in : 0,
            THORCHAIN_DECIMAL
          )
          const expectedAmountOut = baseAmount(expected_amount_out, THORCHAIN_DECIMAL)

          return {
            inboundAddress: inbound_address ? inbound_address : '',
            expectedWaitTime: expectedWait,
            fees,
            router,
            expiry,
            warning,
            notes,
            dustThreshold: dust_threshold,
            recommendedMinAmountIn,
            memo: memo ? memo : '',
            expectedAmountOut,
            expectedCollateralizationRatio: expected_collateralization_ratio,
            expectedCollateralDeposited: expected_collateral_deposited,
            expectedDebtIssued: expected_debt_issued,
            totalOpenLoanSeconds: total_open_loan_seconds
          }
        }
      ),
      RxOp.catchError(
        (): LoanOpenQuoteLD => Rx.of(RD.failure(Error(`Failed to load info for ${assetToString(asset)} loan open`)))
      ),
      RxOp.startWith(RD.pending)
    )
  const apiGetLoanQuoteClose$ = (
    fromAsset: AnyAsset,
    repayBps: number,
    targetAsset: AnyAsset,
    loanOwner: string,
    minOut?: string,
    height?: number
  ): LiveData<Error, QuoteLoanCloseResponse> =>
    FP.pipe(
      thornodeUrl$,
      liveData.chain((basePath) =>
        FP.pipe(
          Rx.from(
            new QuoteApi(getThornodeAPIConfiguration(basePath)).quoteloanclose(
              height,
              assetToString(fromAsset),
              repayBps,
              assetToString(targetAsset),
              loanOwner,
              minOut
            )
          ),
          RxOp.map((response: AxiosResponse<QuoteLoanCloseResponse>) => RD.success(response.data)), // Extract data from AxiosResponse
          RxOp.catchError((e: Error) => Rx.of(RD.failure(e)))
        )
      ),
      RxOp.startWith(RD.pending)
    )
  const { stream$: reloadLoanQuoteClose$, trigger: reloadLoanQuoteClose } = triggerStream()

  const getLoanQuoteClose$ = (
    asset: AnyAsset,
    repayBps: number,
    targetAsset: AnyAsset,
    loanOwner: string,
    minOut?: string,
    height?: number
  ): LoanCloseQuoteLD =>
    FP.pipe(
      reloadLoanQuoteClose$,
      RxOp.debounceTime(300),
      RxOp.switchMap((_) => apiGetLoanQuoteClose$(asset, repayBps, targetAsset, loanOwner, minOut, height)),
      liveData.map(
        // transform quote -> quoteType
        (quote): LoanCloseQuote => {
          const {
            inbound_address,
            inbound_confirmation_blocks,
            inbound_confirmation_seconds,
            outbound_delay_blocks,
            outbound_delay_seconds,
            fees,
            router,
            expiry,
            warning,
            notes,
            dust_threshold,
            recommended_min_amount_in,
            recommended_gas_rate,
            memo,
            expected_amount_out,
            expected_amount_in,
            expected_collateral_withdrawn,
            expected_debt_repaid,
            total_repay_seconds
          } = quote
          /* 1e8 decimal by default, which is default decimal for ALL accets at THORChain  */
          const expectedWait: BlockInformation = {
            inboundConfirmationBlocks: inbound_confirmation_blocks,
            inboundConfirmationSeconds: inbound_confirmation_seconds,
            outboundDelayBlocks: outbound_delay_blocks,
            outbondDelaySeconds: outbound_delay_seconds
          }
          const recommendedMinAmountIn = baseAmount(
            recommended_min_amount_in ? recommended_min_amount_in : 0,
            THORCHAIN_DECIMAL
          )
          const expectedAmountOut = baseAmount(expected_amount_out, THORCHAIN_DECIMAL)
          const expectedAmountIn = baseAmount(expected_amount_in, THORCHAIN_DECIMAL)

          return {
            inboundAddress: inbound_address ? inbound_address : '',
            expectedWaitTime: expectedWait,
            fees,
            router,
            expiry,
            warning,
            notes,
            dustThreshold: dust_threshold,
            recommendedMinAmountIn,
            reccommendedGasRate: recommended_gas_rate ? recommended_gas_rate : '',
            memo: memo ? memo : '',
            expectedAmountOut,
            expectedAmountIn,
            expectedCollateralWithdrawn: expected_collateral_withdrawn,
            expectedDebtRepaid: expected_debt_repaid,
            totalRepaymentSeconds: total_repay_seconds
          }
        }
      ),
      RxOp.catchError(
        (): LoanCloseQuoteLD => Rx.of(RD.failure(Error(`Failed to load info for ${assetToString(asset)} loan open`)))
      ),
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
    getBorrowerProvider$,
    reloadBorrowerProvider,
    getTxStatus$,
    reloadTxStatus,
    getThorchainPool$,
    reloadThorchainPool,
    getLoanQuoteOpen$,
    reloadLoanQuoteOpen,
    getLoanQuoteClose$,
    reloadLoanQuoteClose,
    getTradeAccount$,
    reloadTradeAccount
  }
}
