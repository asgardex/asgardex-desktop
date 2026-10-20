import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'

import {
  AnyAsset,
  BaseAmount,
  assetToBase,
  assetAmount,
  assetToString,
  baseAmount,
  isTokenAsset,
  isTradeAsset
} from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState, useSubscription } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { ASGARDEX_AFFILIATE_FEE_MIN } from '../../../../shared/const'
import { AssetRuneNative, AssetCacao, MAYAChain, THORChain } from '../../../../shared/utils/chainIds'
import { isVultisigWallet } from '../../../../shared/utils/guard'
import { WalletType } from '../../../../shared/wallet/types'
import { WalletPasswordConfirmationModal } from '../../../components/modal/confirmation'
import { TradeDepositModal } from '../../../components/modal/tradeDeposit'
import { useSwapConfirmationModals } from '../../../components/swap/components/SwapConfirmationModals'
import { ModalState, type ExtendedQuoteSwap } from '../../../components/swap/Swap.types'
import { SwapTxModal } from '../../../components/swap/SwapTxModal'
import { DEFAULT_WALLET_TYPE } from '../../../const'
import { useAppContext } from '../../../contexts/AppContext'
import { useChainContext } from '../../../contexts/ChainContext'
import { useChainflipContext } from '../../../contexts/ChainflipContext'
import { useEvmContext } from '../../../contexts/EvmContext'
import { useMayachainContext } from '../../../contexts/MayachainContext'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../../contexts/MidgardMayaContext'
import { useOneClickContext } from '../../../contexts/OneClickContext'
import { usePriceLevelContext } from '../../../contexts/PriceLevelContext'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { THORCHAIN_DECIMAL } from '../../../helpers/assetHelper'
import { resolveChainflipChannelId } from '../../../helpers/chainflipSwapHelper'
import { addChainflipSwapToTrackerFromQuote } from '../../../helpers/chainflipTransactionTracker'
import { quoteNeedsRouterApproval } from '../../../helpers/evmApprovalHelper'
import { isEvmChainToken } from '../../../helpers/evmHelper'
import { eqAsset } from '../../../helpers/fp/eq'
import { createScopedLogger } from '../../../helpers/logger'
import { addOneClickSwapToTrackerFromQuote } from '../../../helpers/oneClickTransactionTracker'
import {
  orderSwapAssets,
  preferredCounter,
  sameMarketAsset,
  settlementChainAsset,
  supportsTradeSettlement,
  toTradeAsset
} from '../../../helpers/tradeAssetHelper'
import { addSwapToTracker } from '../../../helpers/transactionTracker'
import { useERC20Approval } from '../../../hooks/useERC20Approval'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { useStreamingParams } from '../../../hooks/useStreamingParams'
import { useSwapAddresses } from '../../../hooks/useSwapAddresses'
import { useSwapExecution } from '../../../hooks/useSwapExecution'
import { useSwapFees } from '../../../hooks/useSwapFees'
import { useSwapQuote } from '../../../hooks/useSwapQuote'
import { useTradeDepositAddresses } from '../../../hooks/useTradeDepositAddresses'
import { getDecimal } from '../../../services/chain/decimal'
import type { PoolDetails as PoolDetailsMaya } from '../../../services/midgard/mayaMidgard/types'
import { getPoolDetail as getPoolDetailMaya } from '../../../services/midgard/mayaMidgard/utils'
import { PoolsState, PoolDetails } from '../../../services/midgard/midgardTypes'
import { getPoolDetail } from '../../../services/midgard/thorMidgard/utils'
import type { PriceLevel } from '../../../services/priceLevel/types'
import type { TradeAccount } from '../../../services/thorchain/types'
import {
  getWalletTypeFromState,
  isStandaloneLedgerMode,
  isVultisigMode,
  isVultisigVaultPasswordRequired,
  type ChainBalance,
  type WalletBalance,
  type VaultType
} from '../../../services/wallet/types'
import { hasImportedKeystore } from '../../../services/wallet/util'
import { useApp } from '../../../store/app/hooks'
import { formatLimitInput, limitTriggerUsd, type ChartUnit } from './limitPrice'
import { assetAmountCovers, balanceCovers, formatSwapAmount } from './swapAmountDisplay'
import { newlyCompletedDestinationRefreshes, toTrackerRows, type TrackerRow } from './trackerBalance'
import { offerTradeDepositFor } from './tradeDepositOffer'
import { TradingPanelBar, type OrderType, type QuotedSide, type Settlement, type TradeMode } from './TradingPanelBar'
import { TradingPanelPriceLevels } from './TradingPanelPriceLevels'
import { TradingPanelSwaps } from './TradingPanelSwaps'
import { usePairSwaps } from './usePairSwaps'

export type TradingPanelHandle = {
  /** Chart click fills the limit price and selects Limit. It does not place the order. */
  setLimitPriceFromChart: (price: number) => void
}

type Props = {
  poolAsset: AnyAsset
  network: Network
  tradeMode: TradeMode
  setTradeMode: (mode: TradeMode) => void
  initialSettlement?: Settlement
  handleRef?: React.MutableRefObject<TradingPanelHandle | null>
  onCounterAssetChange?: (asset: AnyAsset | null) => void
  /** Units of the on-screen chart. A pair chart is counter per 1 chart asset. */
  chartUnit: ChartUnit
  /** Last chart close, in chart units. Zero until the series has loaded. */
  chartPrice: number
}

const logger = createScopedLogger('TradingPanel')

const poolAssetsOf = (rd: RD.RemoteData<Error, PoolsState>): AnyAsset[] =>
  FP.pipe(
    rd,
    RD.fold(
      () => [],
      () => [],
      () => [],
      (state) => state.poolAssets ?? []
    )
  )

type DexEndpoint = { address: string; walletType: ChainBalance['walletType'] }

// Active wallet rows for one dex chain. Keystore mode can list a ledger row beside the keystore row.
const dexEndpoints = (balances: ChainBalance[], chain: string): DexEndpoint[] => {
  const seen = new Set<string>()
  const endpoints: DexEndpoint[] = []
  for (const balance of balances) {
    if (balance.chain !== chain || O.isNone(balance.walletAddress)) continue
    const key = `${balance.walletType}:${balance.walletAddress.value}`
    if (seen.has(key)) continue
    seen.add(key)
    endpoints.push({ address: balance.walletAddress.value, walletType: balance.walletType })
  }
  return endpoints
}

const mergeTradeAccounts$ = (
  endpoints: DexEndpoint[],
  load: (address: string, walletType: DexEndpoint['walletType']) => Rx.Observable<RD.RemoteData<Error, TradeAccount[]>>
): Rx.Observable<RD.RemoteData<Error, TradeAccount[]>> => {
  if (endpoints.length === 0) return Rx.of(RD.initial)
  return Rx.combineLatest(endpoints.map((endpoint) => load(endpoint.address, endpoint.walletType))).pipe(
    RxOp.map((results) => {
      for (const result of results) {
        if (RD.isFailure(result)) return result
      }
      if (results.every(RD.isSuccess)) {
        return RD.success(results.flatMap((result) => (RD.isSuccess(result) ? result.value : [])))
      }
      return RD.pending
    })
  )
}

const walletAddressValue = (walletAddress: O.Option<{ address: string }>): string | undefined =>
  O.isSome(walletAddress) ? walletAddress.value.address : undefined

export const TradingPanel = ({
  poolAsset,
  network,
  tradeMode,
  setTradeMode,
  initialSettlement = 'wallet',
  handleRef,
  onCounterAssetChange,
  chartUnit,
  chartPrice
}: Props) => {
  // ── Contexts ──────────────────────────────────────────────────────────
  const { streamingSlipTolerance$ } = useAppContext()
  const slipTolerance = useObservableState(streamingSlipTolerance$, 5)
  const { protocol } = useApp()
  const [settlement, setSettlement] = useState<Settlement>(initialSettlement)

  const {
    chainBalances$,
    reloadBalancesByChain,
    keystoreService: { keystoreState$, validatePassword$ },
    appWalletService
  } = useWalletContext()
  const keystore = useObservableState(keystoreState$, O.none)
  const appWalletState = useObservableState(appWalletService.appWalletState$)
  // Wallet is present for keystore, ledger, or vultisig sessions
  const hasWallet =
    hasImportedKeystore(keystore) ||
    (!!appWalletState && isVultisigMode(appWalletState)) ||
    (!!appWalletState && isStandaloneLedgerMode(appWalletState))
  const chainBalances = useObservableState(chainBalances$, [])

  const { swap$, swapCF$, swapOneClick$, swapFees$ } = useChainContext()
  const { transactionTrackingService, getTradeAccount$, reloadTradeAccount } = useThorchainContext()
  const {
    transactionTrackingService: mayaTransactionTrackingService,
    getTradeAccount$: getTradeAccountMaya$,
    reloadTradeAccount: reloadTradeAccountMaya
  } = useMayachainContext()
  const { transactionTrackingService: chainflipTransactionTrackingService } = useChainflipContext()
  const { transactionTrackingService: oneClickTransactionTrackingService } = useOneClickContext()

  // When a tracked swap flips to complete, reload what received it and, when
  // the spent asset is a trade asset, that trade account too. Trade assets
  // settle on the THOR or MAYA trade account. The L1 in `ETH~USDC` is not that
  // balance. Rows already complete on first sight are left alone.
  const trackerWatching = useRef(new Set<string>())
  const trackerReloaded = useRef(new Set<string>())
  const latestTrackedRows = useRef<TrackerRow[]>([])
  const appWalletStateRef = useRef(appWalletState)
  appWalletStateRef.current = appWalletState
  const reloadCompletedDestinations = useCallback(
    (rows: TrackerRow[]) => {
      const state = appWalletStateRef.current
      if (!state) {
        for (const row of rows) {
          if (!row.isComplete) trackerWatching.current.add(row.id)
        }
        return
      }
      const walletType = getWalletTypeFromState(state)
      const refreshes = newlyCompletedDestinationRefreshes(rows, trackerWatching.current, trackerReloaded.current)
      for (const refresh of refreshes) {
        if (refresh.kind === 'thorTrade') {
          reloadTradeAccount()
        } else if (refresh.kind === 'mayaTrade') {
          reloadTradeAccountMaya()
        } else {
          reloadBalancesByChain(refresh.chain, walletType)()
        }
      }
    },
    [reloadBalancesByChain, reloadTradeAccount, reloadTradeAccountMaya]
  )
  const trackedCompletions$ = useMemo(
    () =>
      Rx.merge(
        transactionTrackingService.getTransactions$.pipe(RxOp.map((rd) => toTrackerRows(rd, 'thor'))),
        mayaTransactionTrackingService.getTransactions$.pipe(RxOp.map((rd) => toTrackerRows(rd, 'maya'))),
        chainflipTransactionTrackingService.getTransactions$.pipe(RxOp.map((rd) => toTrackerRows(rd, 'l1'))),
        oneClickTransactionTrackingService.getTransactions$.pipe(RxOp.map((rd) => toTrackerRows(rd, 'l1')))
      ),
    [
      transactionTrackingService,
      mayaTransactionTrackingService,
      chainflipTransactionTrackingService,
      oneClickTransactionTrackingService
    ]
  )
  useSubscription(trackedCompletions$, (rows) => {
    latestTrackedRows.current = rows
    reloadCompletedDestinations(rows)
  })
  useEffect(() => {
    reloadCompletedDestinations(latestTrackedRows.current)
  }, [appWalletState, reloadCompletedDestinations])

  // Both dex trade accounts, independent of the Wallet | Trade toggle.
  const thorEndpoints = dexEndpoints(chainBalances, THORChain)
  const mayaEndpoints = dexEndpoints(chainBalances, MAYAChain)
  const thorEndpointKey = thorEndpoints.map((endpoint) => `${endpoint.walletType}:${endpoint.address}`).join('|')
  const mayaEndpointKey = mayaEndpoints.map((endpoint) => `${endpoint.walletType}:${endpoint.address}`).join('|')
  const tradeAccountProbe$ = useMemo(
    () =>
      Rx.combineLatest([
        mergeTradeAccounts$(thorEndpoints, getTradeAccount$),
        mergeTradeAccounts$(mayaEndpoints, getTradeAccountMaya$)
      ]),
    // Endpoint objects are rebuilt on every balance tick. The keys change only when an address or wallet type does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thorEndpointKey, mayaEndpointKey, getTradeAccount$, getTradeAccountMaya$]
  )
  const [thorTradeAccountsRD, mayaTradeAccountsRD] = useObservableState(tradeAccountProbe$, [
    RD.initial,
    RD.initial
  ] as [RD.RemoteData<Error, TradeAccount[]>, RD.RemoteData<Error, TradeAccount[]>])
  const vultisigWallet = !!appWalletState && isVultisigMode(appWalletState)
  // Trade deposit signing is keystore or ledger. Vultisig has no trade-deposit flow yet.
  const chartTradeRd = protocol === MAYAChain ? mayaTradeAccountsRD : thorTradeAccountsRD
  const otherTradeRd = protocol === MAYAChain ? thorTradeAccountsRD : mayaTradeAccountsRD
  const offerTradeDeposit = hasWallet && !vultisigWallet && offerTradeDepositFor(chartTradeRd, otherTradeRd)
  const [showTradeDeposit, setShowTradeDeposit] = useState(false)
  const { protocolAddress: thorKeystoreProtocolAddress } = useTradeDepositAddresses({
    protocol: THORChain,
    walletType: WalletType.Keystore
  })
  const { protocolAddress: thorLedgerProtocolAddress } = useTradeDepositAddresses({
    protocol: THORChain,
    walletType: WalletType.Ledger
  })
  const { protocolAddress: mayaKeystoreProtocolAddress } = useTradeDepositAddresses({
    protocol: MAYAChain,
    walletType: WalletType.Keystore
  })
  const { protocolAddress: mayaLedgerProtocolAddress } = useTradeDepositAddresses({
    protocol: MAYAChain,
    walletType: WalletType.Ledger
  })
  const closeTradeDeposit = useCallback(() => {
    setShowTradeDeposit(false)
    reloadTradeAccount()
    reloadTradeAccountMaya()
  }, [reloadTradeAccount, reloadTradeAccountMaya])

  const {
    service: {
      pools: { poolsState$, selectedPoolAddress$ },
      setSelectedPoolAsset
    }
  } = useMidgardContext()

  const {
    service: {
      pools: { selectedPoolAddress$: selectedPoolAddressMaya$, poolsState$: mayaPoolsState$ },
      setSelectedPoolAsset: setSelectedPoolAssetMaya
    }
  } = useMidgardMayaContext()

  const poolsRD = useObservableState(poolsState$, RD.pending)
  const mayaPoolsRD = useObservableState(mayaPoolsState$, RD.initial)

  const poolAddressThor = useObservableState(selectedPoolAddress$, O.none)
  const poolAddressMaya = useObservableState(selectedPoolAddressMaya$, O.none)

  // Price levels
  const priceLevelService = usePriceLevelContext()

  // ── Pool state ────────────────────────────────────────────────────────
  const poolDetailsThor: PoolDetails = useMemo(
    () =>
      FP.pipe(
        poolsRD,
        RD.fold(
          () => [],
          () => [],
          () => [],
          (state: PoolsState) => state.poolDetails
        )
      ),
    [poolsRD]
  )

  const poolDetailsMaya: PoolDetailsMaya = useMemo(
    () =>
      FP.pipe(
        mayaPoolsRD,
        RD.fold(
          () => [],
          () => [],
          () => [],
          (state) => (state as PoolsState).poolDetails ?? []
        )
      ),
    [mayaPoolsRD]
  )

  // ── Available assets & target ─────────────────────────────────────────
  const tradeSettlementEnabled = supportsTradeSettlement(poolAsset, protocol)
  const dexNative = protocol === MAYAChain ? AssetCacao : AssetRuneNative
  const pricedPool = useMemo(
    () => (settlement === 'trade' ? toTradeAsset(poolAsset, protocol) : poolAsset),
    [settlement, poolAsset, protocol]
  )

  useEffect(() => {
    if (settlement === 'trade' && !tradeSettlementEnabled) setSettlement('wallet')
  }, [settlement, tradeSettlementEnabled])

  const availableAssets = useMemo(() => {
    if (settlement !== 'trade')
      return orderSwapAssets(poolAssetsOf(poolsRD as RD.RemoteData<Error, PoolsState>), poolAsset)
    const listed =
      protocol === MAYAChain
        ? poolAssetsOf(mayaPoolsRD as RD.RemoteData<Error, PoolsState>)
        : poolAssetsOf(poolsRD as RD.RemoteData<Error, PoolsState>)
    const traded = listed.map((asset) => toTradeAsset(asset, protocol))
    const withDexNative = traded.some((asset) => eqAsset.equals(asset, dexNative)) ? traded : [...traded, dexNative]
    return orderSwapAssets(withDexNative, pricedPool)
  }, [settlement, poolsRD, mayaPoolsRD, poolAsset, protocol, dexNative, pricedPool])

  const defaultTarget = useMemo(() => preferredCounter(availableAssets), [availableAssets])

  const [selectedTarget, setSelectedTarget] = useState<AnyAsset | null>(defaultTarget)
  useEffect(() => {
    setSelectedTarget((current) => {
      if (current) {
        const matched =
          availableAssets.find((asset) => eqAsset.equals(asset, current)) ??
          availableAssets.find((asset) => sameMarketAsset(asset, current))
        if (matched) return eqAsset.equals(matched, current) ? current : matched
      }
      return defaultTarget
    })
  }, [availableAssets, defaultTarget])

  const resolvedTarget = useMemo(() => {
    if (!selectedTarget) return defaultTarget
    return (
      availableAssets.find((asset) => eqAsset.equals(asset, selectedTarget)) ??
      availableAssets.find((asset) => sameMarketAsset(asset, selectedTarget)) ??
      defaultTarget
    )
  }, [availableAssets, selectedTarget, defaultTarget])

  useEffect(() => {
    onCounterAssetChange?.(resolvedTarget)
  }, [onCounterAssetChange, resolvedTarget])

  // ── Local state ───────────────────────────────────────────────────────
  // Size is always the chart asset. amountStr is that size while selling, and the
  // counter cost while a buy quote is loaded. The pay field shows amountStr in buy mode.
  const [orderType, setOrderType] = useState<OrderType>('market')
  const [limitPriceStr, setLimitPriceStr] = useState('')
  const limitTouchedRef = useRef(false)
  const ignoreChartPriceRef = useRef<number | null>(null)
  const chartScopeRef = useRef<string | null>(null)
  const [sizeStr, setSizeStrState] = useState('')
  const sizeStrRef = useRef('')
  const [amountStr, setAmountStr] = useState('')
  const [sourceDecimal, setSourceDecimal] = useState(8)
  const [sourceDecimalAsset, setSourceDecimalAsset] = useState<AnyAsset | null>(null)
  const [sellQuote, setSellQuote] = useState<O.Option<ExtendedQuoteSwap>>(O.none)
  const [sellQuoteSize, setSellQuoteSize] = useState('')
  const [swapHistoryTick, setSwapHistoryTick] = useState(0)
  const fetchAmountRef = useRef('')
  const acceptedSellRef = useRef<ExtendedQuoteSwap | null>(null)

  const setSizeStr = useCallback(
    (next: string) => {
      sizeStrRef.current = next
      setSizeStrState(next)
      if (tradeMode !== 'sell') setTradeMode('sell')
      setAmountStr(next)
    },
    [tradeMode, setTradeMode]
  )

  const setPayAmount = useCallback(
    (next: string) => {
      if (tradeMode === 'buy') {
        setAmountStr(next)
        return
      }
      setSizeStr(next)
    },
    [tradeMode, setSizeStr]
  )

  const setLimitPriceInput = useCallback((next: string) => {
    limitTouchedRef.current = true
    ignoreChartPriceRef.current = null
    setLimitPriceStr(next)
  }, [])

  const setLimitPriceFromChart = useCallback((price: number) => {
    if (!Number.isFinite(price) || price <= 0) return
    limitTouchedRef.current = true
    ignoreChartPriceRef.current = null
    setOrderType('limit')
    setLimitPriceStr(formatLimitInput(price))
  }, [])

  const counterKey = resolvedTarget ? assetToString(resolvedTarget) : ''
  // A new pair changes what the typed price means. Clear it until that pair's chart price arrives.
  useEffect(() => {
    const scope = `${chartUnit}:${counterKey}`
    if (chartScopeRef.current === null) {
      chartScopeRef.current = scope
      return
    }
    if (chartScopeRef.current === scope) return
    chartScopeRef.current = scope
    limitTouchedRef.current = false
    ignoreChartPriceRef.current = chartPrice > 0 ? chartPrice : null
    setLimitPriceStr('')
  }, [chartUnit, counterKey, chartPrice])

  useEffect(() => {
    if (orderType !== 'limit') return
    if (limitTouchedRef.current) return
    if (limitPriceStr !== '') return
    if (!(chartPrice > 0)) return
    if (ignoreChartPriceRef.current !== null && chartPrice === ignoreChartPriceRef.current) return
    ignoreChartPriceRef.current = null
    setLimitPriceStr(formatLimitInput(chartPrice))
  }, [orderType, chartPrice, limitPriceStr])

  // Derive source/target based on trade mode. Trade settlement uses trade-typed assets.
  const sourceAsset = tradeMode === 'sell' ? pricedPool : resolvedTarget
  const targetAsset = tradeMode === 'sell' ? resolvedTarget : pricedPool

  const sourceChain = useMemo(() => {
    if (!sourceAsset) return 'ETH'
    return settlementChainAsset(sourceAsset, protocol).chain
  }, [sourceAsset, protocol])

  // EVM context for approval. Trade assets are not ERC-20 spends; non-EVM falls back to ETH.
  const { approveERC20Token$, isApprovedERC20Token$ } = useEvmContext(sourceChain)

  const dexRecord = chainBalances.find((cb) => cb.chain === dexNative.chain)
  const dexAddressValue = dexRecord && O.isSome(dexRecord.walletAddress) ? dexRecord.walletAddress.value : ''
  const dexWalletType = dexRecord?.walletType

  const tradeAccounts$ = useMemo(() => {
    if (settlement !== 'trade' || !dexAddressValue || dexWalletType === undefined) {
      return Rx.of(RD.initial as RD.RemoteData<Error, TradeAccount[]>)
    }
    return protocol === MAYAChain
      ? getTradeAccountMaya$(dexAddressValue, dexWalletType)
      : getTradeAccount$(dexAddressValue, dexWalletType)
  }, [settlement, dexAddressValue, dexWalletType, protocol, getTradeAccountMaya$, getTradeAccount$])

  const tradeAccountsRD = useObservableState(tradeAccounts$, RD.initial)

  const tradeAccountAmount = useCallback(
    (asset: AnyAsset): O.Option<BaseAmount> => {
      if (!RD.isSuccess(tradeAccountsRD)) return O.none
      const found = tradeAccountsRD.value.find((account) => eqAsset.equals(account.asset, asset))
      return O.some(found ? found.units : baseAmount(0, THORCHAIN_DECIMAL))
    },
    [tradeAccountsRD]
  )

  // Balance the ticket can spend for an asset on the selected settlement.
  // Trade-asset counters (ETH~USDC) are trade-account units. A missing account is zero,
  // so Buy is not offered when that trade balance cannot pay the cost.
  const settlementAmount = useCallback(
    (asset: AnyAsset): O.Option<BaseAmount> => {
      if (settlement === 'trade' && isTradeAsset(asset)) return tradeAccountAmount(asset)
      const chain = settlementChainAsset(asset, protocol).chain
      let sawPending = false
      let sawLoaded = false
      for (const cb of chainBalances) {
        if (cb.chain !== chain) continue
        if (RD.isInitial(cb.balances) || RD.isPending(cb.balances)) {
          sawPending = true
          continue
        }
        if (!RD.isSuccess(cb.balances)) continue
        sawLoaded = true
        const found = cb.balances.value.find((b) => eqAsset.equals(b.asset, asset))
        if (found) return O.some(found.amount)
      }
      if (sawPending || !sawLoaded) return O.none
      return O.some(baseAmount(0))
    },
    [settlement, protocol, tradeAccountAmount, chainBalances]
  )

  // Balance of the chart asset. The size slider uses this, including while a buy quote is loaded.
  const sizeBalance = useMemo(() => {
    if (settlement === 'trade' && isTradeAsset(pricedPool)) return tradeAccountAmount(pricedPool)
    for (const cb of chainBalances) {
      if (cb.chain !== pricedPool.chain) continue
      if (!RD.isSuccess(cb.balances)) continue
      const found = cb.balances.value.find((b) => eqAsset.equals(b.asset, pricedPool))
      if (found) return O.some(found.amount)
    }
    return O.none
  }, [settlement, pricedPool, tradeAccountAmount, chainBalances])

  // Source wallet balance (WalletBalance object). Trade swaps are signed by the dex wallet.
  const sourceWalletBalance = useMemo((): O.Option<WalletBalance> => {
    if (!sourceAsset) return O.none
    if (settlement === 'trade' && isTradeAsset(sourceAsset)) {
      if (!dexRecord || O.isNone(dexRecord.walletAddress)) return O.none
      const loaded = RD.isSuccess(dexRecord.balances) ? dexRecord.balances.value[0] : undefined
      const units = FP.pipe(
        tradeAccountAmount(sourceAsset),
        O.getOrElse(() => baseAmount(0, THORCHAIN_DECIMAL))
      )
      return O.some({
        asset: sourceAsset,
        amount: units,
        walletAddress: dexRecord.walletAddress.value,
        walletType: dexRecord.walletType,
        walletAccount: loaded?.walletAccount ?? 0,
        walletIndex: loaded?.walletIndex ?? 0,
        hdMode: loaded?.hdMode ?? dexRecord.hdMode
      })
    }
    for (const cb of chainBalances) {
      if (cb.chain !== sourceChain) continue
      if (!RD.isSuccess(cb.balances)) continue
      const found = cb.balances.value.find((b) => eqAsset.equals(b.asset, sourceAsset))
      if (found) return O.some(found)
    }
    return O.none
  }, [settlement, sourceAsset, dexRecord, tradeAccountAmount, chainBalances, sourceChain])

  // Source chain native balance (for gas estimation)
  const sourceChainBalance = useMemo(() => {
    for (const cb of chainBalances) {
      if (cb.chain !== sourceChain) continue
      if (!RD.isSuccess(cb.balances)) continue
      // Find the native asset (not a token)
      const native = cb.balances.value.find((b) => !isTokenAsset(b.asset) && b.asset.chain === sourceChain)
      if (native) return native.amount
    }
    return baseAmount(0)
  }, [chainBalances, sourceChain])

  const sourceBalance = useMemo(
    () =>
      FP.pipe(
        sourceWalletBalance,
        O.map((wb) => wb.amount),
        O.getOrElse(() => baseAmount(0))
      ),
    [sourceWalletBalance]
  )

  // Resolve decimal for source asset (with stale guard for rapid changes)
  useEffect(() => {
    if (!sourceAsset) return
    if (isTradeAsset(sourceAsset)) {
      setSourceDecimal(THORCHAIN_DECIMAL)
      setSourceDecimalAsset(sourceAsset)
      return
    }
    let stale = false
    getDecimal(sourceAsset, poolDetailsThor).then((d) => {
      if (stale) return
      setSourceDecimal(d)
      setSourceDecimalAsset(sourceAsset)
    })
    return () => {
      stale = true
    }
  }, [sourceAsset, poolDetailsThor])

  // Compute amount to swap
  const amountToSwap = useMemo(() => {
    const numAmount = parseFloat(amountStr)
    if (!numAmount || numAmount <= 0) return baseAmount(0, sourceDecimal)
    return assetToBase(assetAmount(numAmount, sourceDecimal))
  }, [amountStr, sourceDecimal])

  // ── Set pool address triggers ─────────────────────────────────────────
  useEffect(() => {
    if (!sourceAsset) return
    setSelectedPoolAsset(O.some(sourceAsset))
    setSelectedPoolAssetMaya(O.some(sourceAsset))
    return () => {
      setSelectedPoolAsset(O.none)
      setSelectedPoolAssetMaya(O.none)
    }
  }, [sourceAsset, setSelectedPoolAsset, setSelectedPoolAssetMaya])

  // ── Resolve source/dest addresses ─────────────────────────────────────
  // Get keystore addresses from chain balances
  const sourceKeystoreAddress = useMemo(() => {
    if (!sourceAsset) return O.none
    const cb = chainBalances.find((c) => c.chain === sourceChain)
    if (!cb) return O.none
    return cb.walletAddress
  }, [chainBalances, sourceAsset, sourceChain])

  const targetKeystoreAddress = useMemo(() => {
    if (!targetAsset) return O.none
    const targetChain = settlementChainAsset(targetAsset, protocol).chain
    const cb = chainBalances.find((c) => c.chain === targetChain)
    if (!cb) return O.none
    return cb.walletAddress
  }, [chainBalances, targetAsset, protocol])

  // ── Hook 1: Streaming params ──────────────────────────────────────────
  const { streamingInterval, streamingQuantity, isStreaming } = useStreamingParams()

  // ── Hook 2: Swap addresses (simplified — no custom recipient, no standalone ledger target) ──
  // Stable refs to avoid re-render loops inside useSwapAddresses
  const oNone = useMemo(() => O.none, [])
  const oDefaultWalletType = useMemo(() => O.some(DEFAULT_WALLET_TYPE), [])
  const safeSourceAsset = sourceAsset ?? pricedPool
  const safeTargetAsset = targetAsset ?? pricedPool

  const {
    sourceAddress: oSourceWalletAddress,
    sourceWalletType,
    destinationAddress,
    destinationAddressString,
    useSourceLedger,
    useSourceVultisig,
    quoteOnly
  } = useSwapAddresses({
    sourceAsset: safeSourceAsset,
    targetAsset: safeTargetAsset,
    sourceKeystoreAddress,
    sourceLedgerAddress: oNone,
    targetKeystoreAddress,
    targetLedgerAddress: oNone,
    recipientAddress: targetKeystoreAddress,
    initialSourceWalletType: DEFAULT_WALLET_TYPE,
    initialTargetWalletType: oDefaultWalletType,
    dexProtocol: protocol
  })

  // ── Hook 3: Swap fees ─────────────────────────────────────────────────
  const { swapFees, affiliateBps: rawAffiliateBps } = useSwapFees({
    sourceAsset: safeSourceAsset,
    targetAsset: safeTargetAsset,
    fees$: swapFees$,
    destinationAddress,
    streaming: { interval: streamingInterval, quantity: streamingQuantity },
    network,
    sourceBalance,
    poolDetailsThor,
    poolDetailsMaya,
    lockedWallet: false,
    quoteOnly,
    lockedAssetAmount: baseAmount(0),
    amountToSwap
  })

  // Simple affiliate fee check: use pool's USD price directly.
  // If useSwapFees resolved it, use that. Otherwise compute from pool detail price.
  // This avoids the fragile PoolHelper chain that can return O.none forever.
  //
  // We derive a stable primitive ('none' | 'true' | 'false') to avoid re-render loops
  // caused by O.some() creating new object references.
  const affiliateBpsValue: 'none' | 'true' | 'false' = useMemo(() => {
    if (O.isSome(rawAffiliateBps)) return rawAffiliateBps.value ? 'true' : 'false'

    const numAmount = parseFloat(amountStr)
    if (!numAmount || numAmount <= 0) return 'none'

    // Try THORChain pool first, then MAYAChain pool
    const usdPrice = FP.pipe(
      getPoolDetail(poolDetailsThor, safeSourceAsset),
      O.alt(() => getPoolDetailMaya(poolDetailsMaya, safeSourceAsset)),
      O.chain((detail) => O.fromNullable(detail.assetPriceUSD)),
      O.map(Number),
      O.getOrElse(() => 0)
    )

    if (usdPrice === 0) return 'false'

    const swapUsdValue = numAmount * usdPrice
    return swapUsdValue >= ASGARDEX_AFFILIATE_FEE_MIN ? 'true' : 'false'
  }, [rawAffiliateBps, amountStr, poolDetailsThor, poolDetailsMaya, safeSourceAsset])

  // Stable Option reference — only changes when the primitive changes
  const affiliateBps: O.Option<boolean> = useMemo(
    () => (affiliateBpsValue === 'none' ? O.none : O.some(affiliateBpsValue === 'true')),
    [affiliateBpsValue]
  )

  // Watched orders trigger off the THORChain pool price, so the button uses that same figure.
  const poolUsdPrice = useMemo(() => {
    const price = FP.pipe(
      getPoolDetail(poolDetailsThor, poolAsset),
      O.chain((detail) => O.fromNullable(detail.assetPriceUSD)),
      O.map(Number),
      O.getOrElse(() => 0)
    )
    return Number.isFinite(price) && price > 0 ? price : 0
  }, [poolDetailsThor, poolAsset])

  // Trade settlement quotes only the protocol that holds the trade account.
  const protocolFilter = useMemo(
    () => (settlement === 'trade' ? ([protocol === MAYAChain ? 'Mayachain' : 'Thorchain'] as const) : undefined),
    [settlement, protocol]
  )

  // ── Hook 4: Swap quote ────────────────────────────────────────────────
  const { quotes, selectedQuote, quoteError, isFetching, fetchQuote, selectQuote, resetQuote } = useSwapQuote({
    sourceAsset: safeSourceAsset,
    targetAsset: safeTargetAsset,
    sourceAssetDecimal: sourceDecimal,
    sourceWalletAddress: FP.pipe(
      oSourceWalletAddress,
      O.getOrElse(() => '')
    ),
    destinationAddress: destinationAddressString,
    quoteOnly,
    streaming: { enabled: isStreaming, interval: streamingInterval, quantity: streamingQuantity },
    slipTolerance,
    affiliateBps,
    protocolFilter
  })

  const quoteChoices = useMemo(
    () =>
      O.isNone(quotes) ? [] : quotes.value.filter((quote) => quote.canSwap || quoteNeedsRouterApproval(quote.errors)),
    [quotes]
  )

  // The sell quote stays on screen while Buy prices the reverse swap from its output.
  // A quote is only kept when it was fetched for the size still in the field.
  useEffect(() => {
    const size = parseFloat(sizeStr)
    if (!size || size <= 0) {
      acceptedSellRef.current = null
      setSellQuote(O.none)
      setSellQuoteSize('')
      return
    }
    if (tradeMode !== 'sell' || isFetching || O.isNone(selectedQuote) || !resolvedTarget) return
    if (sizeStr !== fetchAmountRef.current) return
    if (acceptedSellRef.current === selectedQuote.value) return
    if (!sameMarketAsset(selectedQuote.value.expectedAmount.asset, resolvedTarget)) return
    if (!sourceAsset || !sourceDecimalAsset || !eqAsset.equals(sourceDecimalAsset, sourceAsset)) return
    acceptedSellRef.current = selectedQuote.value
    setSellQuote(selectedQuote)
    setSellQuoteSize(sizeStr)
  }, [sizeStr, tradeMode, isFetching, selectedQuote, resolvedTarget, sourceAsset, sourceDecimalAsset])

  const sizedSellQuote = sellQuoteSize === sizeStr ? sellQuote : O.none

  const quotedSide: QuotedSide = useMemo(() => {
    if (isFetching || O.isNone(selectedQuote) || !selectedQuote.value.canSwap) return null
    if (!sourceAsset || !sourceDecimalAsset || !eqAsset.equals(sourceDecimalAsset, sourceAsset)) return null
    if (amountStr !== fetchAmountRef.current) return null
    const expected = selectedQuote.value.expectedAmount.asset
    if (tradeMode === 'buy' && sameMarketAsset(expected, pricedPool)) return 'buy'
    if (
      tradeMode === 'sell' &&
      sellQuoteSize === sizeStr &&
      resolvedTarget &&
      sameMarketAsset(expected, resolvedTarget)
    )
      return 'sell'
    return null
  }, [
    isFetching,
    selectedQuote,
    sourceAsset,
    sourceDecimalAsset,
    amountStr,
    tradeMode,
    pricedPool,
    resolvedTarget,
    sellQuoteSize,
    sizeStr
  ])

  // ── Hook 5: Swap execution ────────────────────────────────────────────
  const {
    swapState,
    swapParams: oSwapParams,
    cfSwapParams: oCFSwapParams,
    oneClickSwapParams: oOneClickSwapParams,
    submitSwap: submitSwapTx,
    submitCFSwap: submitCFTx,
    submitOneClickSwap: submitOneClickTx,
    resetSwapState,
    swapStartTime,
    lastTrackedTxHashRef,
    lastCFChannelRef,
    lastOneClickDepositAddressRef
  } = useSwapExecution({
    swap$,
    swapCF$,
    swapOneClick$,
    selectedQuote,
    sourceAsset: safeSourceAsset,
    targetAsset: safeTargetAsset,
    destinationAddress: O.fromNullable(destinationAddressString || undefined),
    amountToSwap,
    sourceWalletBalance,
    sourceChainBalance,
    swapFees,
    poolAddressThor,
    poolAddressMaya,
    network,
    isSendMax: false,
    streamingInterval,
    streamingQuantity
  })

  // ── Hook 6: ERC20 Approval ────────────────────────────────────────────
  const needsApproval = useMemo(() => (sourceAsset ? isEvmChainToken(sourceAsset) : false), [sourceAsset])

  const oApproveParams = useMemo(() => {
    if (!needsApproval || !sourceAsset) return O.none
    return FP.pipe(
      selectedQuote,
      O.chain((quote) => {
        const oPoolAddr = quote.protocol === 'Mayachain' ? poolAddressMaya : poolAddressThor
        return FP.pipe(
          oPoolAddr,
          O.chain((poolAddr) => {
            const spenderAddress = FP.pipe(
              poolAddr.router,
              O.getOrElse(() => poolAddr.address)
            )
            return O.some({
              network,
              contractAddress: sourceAsset.symbol.split('-')[1] ?? '',
              spenderAddress,
              fromAddress: FP.pipe(
                oSourceWalletAddress,
                O.getOrElse(() => '')
              ),
              walletType: sourceWalletType,
              walletAccount: 0,
              walletIndex: 0,
              hdMode: 'default' as const
            })
          })
        )
      })
    )
  }, [
    needsApproval,
    sourceAsset,
    selectedQuote,
    poolAddressThor,
    poolAddressMaya,
    network,
    oSourceWalletAddress,
    sourceWalletType
  ])

  const { isApprovedState, awaitingConfirmation, submitApproveTx, resetApproval } = useERC20Approval({
    isApprovedERC20Token$,
    approveERC20Token$,
    oApproveParams,
    network,
    onApprovalConfirmed: () => {
      // After approval confirmed, re-fetch quote
      if (amountToSwap.amount().gt(0)) {
        void fetchQuote(amountToSwap)
      }
    }
  })

  // ── Hook 7: Confirmation modals ───────────────────────────────────────
  const vaultType: VaultType = useMemo(() => {
    if (appWalletState && isVultisigMode(appWalletState) && appWalletState.activeVault) {
      return appWalletState.activeVault.type
    }
    return 'fast'
  }, [appWalletState])

  // Whether the Vultisig modal must prompt for the vault password. Skips the
  // redundant prompt once a fast vault is already unlocked for the session
  // (see `isVultisigVaultPasswordRequired`).
  const isVaultEncrypted: boolean = useMemo(
    () => (appWalletState ? isVultisigVaultPasswordRequired(appWalletState) : true),
    [appWalletState]
  )

  const validatePasswordForVultisig = useCallback(
    async (password: string): Promise<boolean> => {
      if (isVultisigWallet(sourceWalletType)) {
        return appWalletService.validatePassword(password)
      }
      return new Promise((resolve) => {
        validatePassword$(password).subscribe({
          next: (result) => {
            if (RD.isSuccess(result)) resolve(true)
            else if (RD.isFailure(result)) resolve(false)
          },
          error: () => resolve(false)
        })
      })
    },
    [sourceWalletType, appWalletService, validatePassword$]
  )

  const getActiveVaultId = useCallback(() => appWalletService.getActiveVaultId(), [appWalletService])

  const { showPasswordModal, showLedgerModal, showVultisigModal, onSubmit, onApprove, renderModals } =
    useSwapConfirmationModals({
      useSourceAssetLedger: useSourceLedger,
      useSourceAssetVultisig: useSourceVultisig,
      sourceAsset: safeSourceAsset,
      sourceChain,
      sourceWalletType,
      network,
      oSwapParams,
      oCFSwapParams,
      oOneClickSwapParams,
      submitSwapTx,
      submitCFTx,
      submitOneClickTx,
      submitApproveTx,
      validatePassword$,
      validatePasswordForVultisig,
      vaultType,
      isVaultEncrypted,
      approveState: RD.initial,
      swapState,
      getActiveVaultId,
      resetSwapState
    })

  const isConfirmModalOpen =
    showPasswordModal !== ModalState.None ||
    showLedgerModal !== ModalState.None ||
    showVultisigModal !== ModalState.None
  const isSwapTxInFlight = !RD.isInitial(swapState.swapTx)
  const pauseQuoteRefresh = isConfirmModalOpen || isSwapTxInFlight

  // ── Explorer URL for tx modal ─────────────────────────────────────────
  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(sourceChain))

  // ── Auto-fetch quote while an amount is entered ─────────────────────
  // Debounced: amount changes wait 600ms, other changes fire immediately.
  // Skipped while confirming or while SwapTxModal is showing an in-flight swap.
  const quoteFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevAmountRef = useRef(amountStr)
  const hadAmountRef = useRef(false)

  useEffect(() => {
    if (!hasWallet) return
    if (pauseQuoteRefresh) return

    const numAmount = parseFloat(amountStr)
    if (!numAmount || numAmount <= 0) {
      if (quoteFetchTimerRef.current) clearTimeout(quoteFetchTimerRef.current)
      if (hadAmountRef.current) {
        hadAmountRef.current = false
        resetQuote()
      }
      return
    }
    hadAmountRef.current = true
    if (affiliateBpsValue === 'none') return // fees not ready yet

    const doFetch = () => {
      fetchAmountRef.current = amountStr
      const amt = assetToBase(assetAmount(parseFloat(amountStr), sourceDecimal))
      void fetchQuote(amt)
    }

    // If only amount changed, debounce to avoid fetching on every keystroke
    const amountChanged = prevAmountRef.current !== amountStr
    prevAmountRef.current = amountStr

    if (quoteFetchTimerRef.current) clearTimeout(quoteFetchTimerRef.current)

    if (amountChanged) {
      quoteFetchTimerRef.current = setTimeout(doFetch, 600)
    } else {
      doFetch()
    }

    return () => {
      if (quoteFetchTimerRef.current) clearTimeout(quoteFetchTimerRef.current)
    }
    // Use affiliateBpsValue (primitive) instead of affiliateBps (object) to avoid re-render loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasWallet,
    pauseQuoteRefresh,
    amountStr,
    tradeMode,
    resolvedTarget,
    settlement,
    protocol,
    sourceDecimal,
    affiliateBpsValue
  ])

  // ── Actions ───────────────────────────────────────────────────────────
  const handleSelectTarget = useCallback(
    (asset: AnyAsset) => {
      resetQuote()
      setSellQuote(O.none)
      setSelectedTarget(asset)
      if (tradeMode !== 'sell') {
        setTradeMode('sell')
        setAmountStr(sizeStrRef.current)
      }
    },
    [resetQuote, tradeMode, setTradeMode]
  )

  // Buy spends the counter. On Trade settlement that is the counter's trade account.
  const buySpendBalance = useMemo(
    () => (resolvedTarget ? settlementAmount(resolvedTarget) : O.none),
    [resolvedTarget, settlementAmount]
  )
  const buyCost = useMemo((): BaseAmount | null => {
    if (quotedSide === 'buy') return amountToSwap.amount().gt(0) ? amountToSwap : null
    if (O.isSome(sizedSellQuote)) return sizedSellQuote.value.expectedAmount.baseAmount
    return null
  }, [quotedSide, amountToSwap, sizedSellQuote])
  const buyCoversCost = O.isSome(buySpendBalance) && buyCost !== null && balanceCovers(buySpendBalance.value, buyCost)
  const buyShort =
    O.isSome(buySpendBalance) &&
    (!buySpendBalance.value.amount().gt(0) || (buyCost !== null && !balanceCovers(buySpendBalance.value, buyCost)))
  const sellSize = parseFloat(sizeStr)
  const sellCovers = O.isSome(sizeBalance) && assetAmountCovers(sizeBalance.value, sellSize)
  const sellShort = O.isSome(sizeBalance) && (!sizeBalance.value.amount().gt(0) || (sellSize > 0 && !sellCovers))

  // Flip pay and receive immediately. It does not submit.
  // A ready sell quote becomes the amount to spend. Otherwise the buy field stays empty,
  // so the chart size is not quoted as counter units.
  const handleFlip = useCallback(() => {
    if (tradeMode === 'buy') {
      resetQuote()
      setTradeMode('sell')
      setAmountStr(sizeStrRef.current)
      return
    }
    const cost =
      O.isSome(sizedSellQuote) && sizedSellQuote.value.canSwap
        ? formatSwapAmount(sizedSellQuote.value.expectedAmount.baseAmount)
        : ''
    resetQuote()
    if (!cost || cost === '0') {
      acceptedSellRef.current = null
      setSellQuote(O.none)
      setSellQuoteSize('')
      setAmountStr('')
    } else {
      setAmountStr(cost)
    }
    setTradeMode('buy')
  }, [tradeMode, resetQuote, setTradeMode, sizedSellQuote])

  // ── Price levels (limit orders) ─────────────────────────────────────
  const assetKey = assetToString(poolAsset)

  // Track swap completion → update price level status if we were executing one
  const swapTxRD = swapState.swapTx
  const reloadedSwapRef = useRef('')
  useEffect(() => {
    if (!RD.isSuccess(swapTxRD)) return
    const txHash = FP.pipe(
      RD.toOption(swapTxRD),
      O.getOrElse(() => '')
    )
    if (!txHash || reloadedSwapRef.current === txHash) return
    reloadedSwapRef.current = txHash
    setSwapHistoryTick((tick) => tick + 1)
  }, [swapTxRD])
  useEffect(() => {
    if (!executingLevelRef.current) return
    const levelId = executingLevelRef.current

    if (RD.isSuccess(swapTxRD)) {
      const txHash = FP.pipe(
        RD.toOption(swapTxRD),
        O.getOrElse(() => '')
      )
      priceLevelService.updateLevel(assetKey, levelId, {
        status: 'completed',
        txHash: txHash || undefined
      })
      executingLevelRef.current = null
    } else if (RD.isFailure(swapTxRD)) {
      priceLevelService.updateLevel(assetKey, levelId, {
        status: 'failed',
        error: swapTxRD.error.msg ?? 'Swap failed'
      })
      executingLevelRef.current = null
    }
  }, [swapTxRD, priceLevelService, assetKey])

  // ── Track successful swap transactions ────────────────────────────────
  useEffect(() => {
    const { swapTx } = swapState
    if (!RD.isSuccess(swapTx)) return

    const txHash = swapTx.value
    if (lastTrackedTxHashRef.current === txHash) return

    FP.pipe(
      selectedQuote,
      O.map((quoteProtocol) => {
        if (quoteProtocol.protocol === 'Thorchain') {
          addSwapToTracker(transactionTrackingService, txHash, {
            sourceAsset: assetToString(safeSourceAsset),
            targetAsset: assetToString(safeTargetAsset),
            amount: amountToSwap.amount().toString()
          })
          lastTrackedTxHashRef.current = txHash
        } else if (quoteProtocol.protocol === 'Mayachain') {
          addSwapToTracker(mayaTransactionTrackingService, txHash, {
            sourceAsset: assetToString(safeSourceAsset),
            targetAsset: assetToString(safeTargetAsset),
            amount: amountToSwap.amount().toString()
          })
          lastTrackedTxHashRef.current = txHash
        } else if (quoteProtocol.protocol === 'Chainflip') {
          const channelId = resolveChainflipChannelId(
            lastCFChannelRef.current?.depositChannelId,
            quoteProtocol.depositChannelId
          )
          if (channelId) {
            addChainflipSwapToTrackerFromQuote(chainflipTransactionTrackingService, channelId, {
              srcAsset: { chain: safeSourceAsset.chain, symbol: safeSourceAsset.symbol },
              destAsset: { chain: safeTargetAsset.chain, symbol: safeTargetAsset.symbol },
              depositAmount: amountToSwap.amount().toString()
            })
            lastTrackedTxHashRef.current = txHash
          }
        } else if (quoteProtocol.protocol === 'OneClick') {
          // Dry quotes leave toAddress empty. Status is keyed by the wet deposit address.
          const depositAddress = lastOneClickDepositAddressRef.current || quoteProtocol.toAddress
          if (depositAddress) {
            addOneClickSwapToTrackerFromQuote(oneClickTransactionTrackingService, depositAddress, {
              srcAsset: { chain: safeSourceAsset.chain, symbol: safeSourceAsset.symbol },
              destAsset: { chain: safeTargetAsset.chain, symbol: safeTargetAsset.symbol },
              depositAmount: amountToSwap.amount().toString()
            })
            lastTrackedTxHashRef.current = txHash
          }
        }
      })
    )
  }, [
    swapState,
    selectedQuote,
    transactionTrackingService,
    mayaTransactionTrackingService,
    chainflipTransactionTrackingService,
    oneClickTransactionTrackingService,
    safeSourceAsset,
    safeTargetAsset,
    amountToSwap,
    lastTrackedTxHashRef,
    lastCFChannelRef,
    lastOneClickDepositAddressRef
  ])

  const onCloseTxModal = useCallback(() => {
    resetSwapState()
  }, [resetSwapState])

  const onFinishTxModal = useCallback(() => {
    resetSwapState()
    resetQuote()
    resetApproval()
    sizeStrRef.current = ''
    setSizeStrState('')
    setAmountStr('')
    setSellQuote(O.none)
    if (tradeMode !== 'sell') setTradeMode('sell')
  }, [resetSwapState, resetQuote, resetApproval, tradeMode, setTradeMode])
  const levelsMap = useObservableState(priceLevelService.levels$, {})
  const priceLevels: PriceLevel[] = levelsMap[assetKey] ?? []

  const handleRemoveLevel = useCallback(
    (levelId: string) => {
      priceLevelService.removeLevel(assetKey, levelId)
      orderPasswordCache.current.delete(levelId)
    },
    [priceLevelService, assetKey]
  )

  // ── Limit order password cache ──────────────────────────────────────
  // For keystore wallets: password is validated at order creation time and cached
  // in memory (per order ID). On crossing, we bypass the modal and submit directly.
  // For Ledger/Vultisig: the hardware prompt is unavoidable, so we fall back to onSubmit().
  const orderPasswordCache = useRef<Map<string, boolean>>(new Map())

  // Create a limit order with pre-authorization.
  // Keystore wallets: password modal shown at creation time, cached for auto-execution.
  // Hardware wallets: order created immediately, device prompt shown on trigger.
  const addPriceLevelWithAuth = useCallback(
    (price: number, side: TradeMode = 'sell', amountOverride?: number) => {
      if (!hasWallet || !selectedTarget) return
      const numAmount = amountOverride ?? parseFloat(sizeStr)
      if (!numAmount || numAmount <= 0 || !Number.isFinite(price) || price <= 0) return

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      const doCreateOrder = (preAuthorized: boolean) => {
        priceLevelService.addLevel(assetKey, {
          id,
          price,
          type: side,
          amount: numAmount,
          amountSymbol: side === 'sell' ? poolAsset.ticker : selectedTarget.ticker,
          targetAssetKey: assetToString(selectedTarget),
          status: 'pending'
        })
        if (preAuthorized) {
          orderPasswordCache.current.set(id, true)
        }
      }

      if (useSourceLedger || useSourceVultisig) {
        // Hardware wallets can't pre-authorize — create order, prompt on trigger
        doCreateOrder(false)
      } else {
        // Keystore: show password prompt, create order only on success
        setPendingOrderAction(() => doCreateOrder)
        setShowOrderPasswordModal(true)
      }
    },
    [hasWallet, selectedTarget, sizeStr, poolAsset, assetKey, priceLevelService, useSourceLedger, useSourceVultisig]
  )

  const limitUsd = useMemo(
    () => limitTriggerUsd(Number(limitPriceStr), poolUsdPrice, chartPrice),
    [limitPriceStr, poolUsdPrice, chartPrice]
  )

  // Limit: park a buy or sell at the entered price. The price watcher submits it.
  const placeLimitOrder = useCallback(
    (side: TradeMode) => {
      if (limitUsd === null) return
      if (side === 'sell') {
        if (!sellCovers) return
        addPriceLevelWithAuth(limitUsd, 'sell')
        return
      }
      if (!buyCoversCost) return
      const cost =
        quotedSide === 'buy'
          ? Number(amountStr)
          : O.isSome(sizedSellQuote)
            ? Number(formatSwapAmount(sizedSellQuote.value.expectedAmount.baseAmount))
            : 0
      if (!cost) return
      addPriceLevelWithAuth(limitUsd, 'buy', cost)
    },
    [limitUsd, addPriceLevelWithAuth, buyCoversCost, sellCovers, quotedSide, amountStr, sizedSellQuote]
  )

  const hasSize = !!parseFloat(sizeStr) && parseFloat(sizeStr) > 0
  // The pay field is the amount. A buy is sized in the counter, so it does not
  // need a chart-asset size. The button submits only the quote on screen.
  const canMarketSwap =
    tradeMode === 'buy' ? quotedSide === 'buy' && buyCoversCost : quotedSide === 'sell' && sellCovers
  const canPlaceLimit =
    limitUsd !== null &&
    !!selectedTarget &&
    (tradeMode === 'buy' ? quotedSide === 'buy' && buyCoversCost : hasSize && sellCovers)
  const canTrade = orderType === 'limit' ? canPlaceLimit : canMarketSwap

  const handleTrade = useCallback(() => {
    if (orderType === 'limit') {
      placeLimitOrder(tradeMode)
      return
    }
    if (tradeMode === 'buy' ? quotedSide === 'buy' && buyCoversCost : quotedSide === 'sell' && sellCovers) onSubmit()
  }, [orderType, placeLimitOrder, tradeMode, quotedSide, buyCoversCost, sellCovers, onSubmit])

  // Password modal state for limit order pre-authorization
  const [showOrderPasswordModal, setShowOrderPasswordModal] = useState(false)
  const [pendingOrderAction, setPendingOrderAction] = useState<((preAuth: boolean) => void) | null>(null)

  const handleOrderPasswordSuccess = useCallback(() => {
    setShowOrderPasswordModal(false)
    if (pendingOrderAction) {
      pendingOrderAction(true) // pre-authorized
      setPendingOrderAction(null)
    }
  }, [pendingOrderAction])

  const handleOrderPasswordClose = useCallback(() => {
    setShowOrderPasswordModal(false)
    setPendingOrderAction(null)
  }, [])

  // Chart click fills the limit field. The trade button places the order.
  useEffect(() => {
    if (handleRef) {
      handleRef.current = { setLimitPriceFromChart }
    }
  }, [handleRef, setLimitPriceFromChart])

  // Track which level is currently being executed (to prevent double-fire)
  const executingLevelRef = useRef<string | null>(null)
  // Flag: when true, auto-submit after the next successful quote fetch
  const autoSubmitPendingRef = useRef(false)

  // Subscribe to crossing events — restore trade state and flag for auto-execution.
  // Skip if already executing a level (queue is single-slot; next poll will re-trigger).
  useSubscription(priceLevelService.crossings$, (event) => {
    if (event.assetKey !== assetKey) return
    if (executingLevelRef.current) return

    const level = event.level
    if (level.amount <= 0 || !level.targetAssetKey) return

    executingLevelRef.current = event.levelId

    // Mark as executing
    priceLevelService.updateLevel(assetKey, event.levelId, { status: 'executing' })

    // Clear any stale quote before restoring trade state — prevents auto-submit
    // from firing with a previous manual trade's quote before the fresh one arrives
    resetQuote()

    // Restore the trade state from the limit order. Sell orders size the chart asset.
    if (level.type === 'sell') {
      sizeStrRef.current = String(level.amount)
      setSizeStrState(String(level.amount))
    }
    setAmountStr(String(level.amount))
    setTradeMode(level.type)

    const resolvedTarget = availableAssets.find((a) => assetToString(a) === level.targetAssetKey)
    if (resolvedTarget) {
      setSelectedTarget(resolvedTarget)
    }

    autoSubmitPendingRef.current = true
  })

  // Auto-submit when a quote arrives and autoSubmitPending is set
  useEffect(() => {
    if (!autoSubmitPendingRef.current) return
    if (O.isNone(selectedQuote)) return
    if (isFetching) return

    // For ERC20 tokens: wait until approval is confirmed before submitting
    if (needsApproval && (!RD.isSuccess(isApprovedState) || isApprovedState.value === false)) {
      return
    }

    const payKnown = tradeMode === 'buy' ? O.isSome(buySpendBalance) : O.isSome(sizeBalance)
    if (!payKnown) return

    autoSubmitPendingRef.current = false

    const payCovers = tradeMode === 'buy' ? buyCoversCost : sellCovers
    if (!selectedQuote.value.canSwap || !payCovers) {
      if (executingLevelRef.current) {
        priceLevelService.updateLevel(assetKey, executingLevelRef.current, {
          status: 'failed',
          error: selectedQuote.value.canSwap ? 'Balance too low' : 'No valid swap route'
        })
        executingLevelRef.current = null
      }
      return
    }

    const levelId = executingLevelRef.current
    const isPreAuthorized = levelId ? orderPasswordCache.current.has(levelId) : false

    if (isPreAuthorized) {
      // Pre-authorized keystore order: bypass password modal, submit directly
      void (async () => {
        try {
          if (O.isSome(oSwapParams)) {
            submitSwapTx()
          } else if (O.isSome(oCFSwapParams)) {
            await submitCFTx()
          }
        } catch (error) {
          logger.error('Pre-authorized swap submit failed', error)
          // Channel open can fail before swapCF$ emits — mark the limit order failed now.
          if (levelId) {
            priceLevelService.updateLevel(assetKey, levelId, {
              status: 'failed',
              error: error instanceof Error ? error.message : 'Swap submission failed'
            })
            executingLevelRef.current = null
          }
        } finally {
          if (levelId) orderPasswordCache.current.delete(levelId)
        }
      })()
    } else {
      // Hardware wallet or non-pre-authorized: show confirmation modal
      onSubmit()
    }
  }, [
    selectedQuote,
    isFetching,
    needsApproval,
    isApprovedState,
    onSubmit,
    priceLevelService,
    assetKey,
    oSwapParams,
    oCFSwapParams,
    submitSwapTx,
    submitCFTx,
    tradeMode,
    buySpendBalance,
    sizeBalance,
    buyCoversCost,
    sellCovers
  ])

  // Extra content for tx modal
  const swapTxSource = useMemo(
    () => ({ asset: safeSourceAsset, amount: amountToSwap }),
    [safeSourceAsset, amountToSwap]
  )
  const swapTxTarget = useMemo(
    () => ({ asset: targetAsset || safeSourceAsset, amount: baseAmount(0) }),
    [targetAsset, safeSourceAsset]
  )

  const swapAddresses = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const balance of chainBalances) {
      if (O.isNone(balance.walletAddress)) continue
      const address = balance.walletAddress.value
      if (!address || seen.has(address)) continue
      seen.add(address)
      list.push(address)
    }
    list.sort()
    return list
  }, [chainBalances])

  const pairSwaps = usePairSwaps({
    protocol,
    poolAsset,
    counter: resolvedTarget,
    addresses: swapAddresses,
    reloadToken: swapHistoryTick
  })

  return (
    <>
      <TradingPanelBar
        poolAsset={pricedPool}
        network={network}
        hasWallet={hasWallet}
        settlement={settlement}
        onDepositTrade={settlement === 'trade' && offerTradeDeposit ? () => setShowTradeDeposit(true) : undefined}
        tradeMode={tradeMode}
        assetBalance={sizeBalance}
        buyBalance={buySpendBalance}
        buyShort={buyShort}
        sellShort={sellShort}
        amountStr={tradeMode === 'buy' ? amountStr : sizeStr}
        setAmountStr={setPayAmount}
        selectedTarget={selectedTarget}
        setSelectedTarget={handleSelectTarget}
        availableAssets={availableAssets}
        sellQuote={sizedSellQuote}
        activeQuote={selectedQuote}
        quotedSide={quotedSide}
        quoteError={quoteError}
        isFetching={isFetching}
        canTrade={canTrade}
        isApprovedState={isApprovedState}
        needsApproval={needsApproval}
        awaitingConfirmation={awaitingConfirmation}
        onApprove={onApprove}
        onTrade={handleTrade}
        onFlip={handleFlip}
        quotes={quoteChoices}
        onSelectQuote={selectQuote}
        orderType={orderType}
        setOrderType={setOrderType}
        chartUnit={chartUnit}
        chartPrice={chartPrice}
        limitPriceStr={limitPriceStr}
        setLimitPriceStr={setLimitPriceInput}
        limitUsd={limitUsd}
      />

      <TradingPanelPriceLevels levels={priceLevels} onRemove={handleRemoveLevel} />

      {hasWallet && <TradingPanelSwaps poolTicker={poolAsset.ticker} rows={pairSwaps.rows} phase={pairSwaps.phase} />}

      {(offerTradeDeposit || showTradeDeposit) && (
        <TradeDepositModal
          visible={showTradeDeposit}
          chainBalances={chainBalances}
          initialProtocol={protocol === MAYAChain ? MAYAChain : THORChain}
          thorKeystoreProtocolAddress={walletAddressValue(thorKeystoreProtocolAddress)}
          thorLedgerProtocolAddress={walletAddressValue(thorLedgerProtocolAddress)}
          mayaKeystoreProtocolAddress={walletAddressValue(mayaKeystoreProtocolAddress)}
          mayaLedgerProtocolAddress={walletAddressValue(mayaLedgerProtocolAddress)}
          network={network}
          validatePassword$={validatePassword$}
          onClose={closeTradeDeposit}
        />
      )}

      {/* Wallet confirmation modals (password/ledger/vultisig) for manual swaps */}
      {renderModals}

      {/* Password modal for limit order pre-authorization */}
      {showOrderPasswordModal && (
        <WalletPasswordConfirmationModal
          onSuccess={handleOrderPasswordSuccess}
          onClose={handleOrderPasswordClose}
          validatePassword$={validatePassword$}
        />
      )}

      {/* Swap progress modal */}
      <SwapTxModal
        swapState={swapState}
        swapStartTime={swapStartTime}
        sourceChain={sourceChain}
        source={swapTxSource}
        target={swapTxTarget}
        oQuoteProtocol={selectedQuote}
        depositChannelId={O.fromNullable(lastCFChannelRef.current?.depositChannelId)}
        goToTransaction={openExplorerTxUrl}
        getExplorerTxUrl={getExplorerTxUrl}
        onCloseTxModal={onCloseTxModal}
        onFinishTxModal={onFinishTxModal}
      />
    </>
  )
}
