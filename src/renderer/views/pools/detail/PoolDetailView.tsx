import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import {
  assetFromString,
  assetToString,
  type AnyAsset,
  assetAmount,
  assetToBase,
  baseToAsset,
  CryptoAmount,
  currencySymbolByAsset,
  eqAsset
} from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate, useParams } from 'react-router-dom'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { HDMode } from '../../../../shared/wallet/types'
import { WalletPasswordConfirmationModal } from '../../../components/modal/confirmation/WalletPasswordConfirmationModal'
import { AssetIcon } from '../../../components/uielements/assets/assetIcon'
import { AssetSelect } from '../../../components/uielements/assets/assetSelect'
import { BackLinkButton } from '../../../components/uielements/button'
import {
  CandleTimeframeSelector,
  ChartDateRangeSelector,
  TradingChart,
  SpreadLabel,
  IndicatorToolbar
} from '../../../components/uielements/chart'
import { Label } from '../../../components/uielements/label'
import { Spin } from '../../../components/uielements/spin'
import {
  AssetUSDC,
  AssetUSDT,
  AssetDAI,
  AssetLUSD,
  AssetUSDCAVAX,
  AssetUSDCBSC,
  AssetUSDTBSC,
  DEFAULT_WALLET_TYPE
} from '../../../const'
import { useAppContext } from '../../../contexts/AppContext'
import { useChainContext } from '../../../contexts/ChainContext'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { usePriceLevelContext } from '../../../contexts/PriceLevelContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { updateMemo } from '../../../helpers/memoHelper'
import { useBinanceOHLCV } from '../../../hooks/useBinanceOHLCV'
import { useChainflipPrice } from '../../../hooks/useChainflipPrice'
import { useOHLCVData } from '../../../hooks/useOHLCVData'
import { usePriceSpread } from '../../../hooks/usePriceSpread'
import { useSubscriptionState } from '../../../hooks/useSubscriptionState'
import * as poolsRoutes from '../../../routes/pools'
import { INITIAL_SWAP_STATE } from '../../../services/chain/const'
import type { SwapTxState } from '../../../services/chain/types'
import { DEFAULT_NETWORK } from '../../../services/const'
import { useAggregator } from '../../../store/aggregator/hooks'
import { useApp } from '../../../store/app/hooks'
import type { CandleTimeframe, ChartDateRange, IndicatorConfig, OHLCVDataRD, PriceLevel } from './types'

const DEFAULT_INDICATORS: IndicatorConfig[] = [
  { type: 'SMA', enabled: false, period: 20, color: '#FF6B6B' },
  { type: 'EMA', enabled: false, period: 20, color: '#4ECDC4' },
  { type: 'BB', enabled: false, period: 20, color: '#FFE66D' }
]

const STABLECOIN_OPTIONS: AnyAsset[] = [
  AssetUSDC,
  AssetUSDT,
  AssetDAI,
  AssetLUSD,
  AssetUSDCAVAX,
  AssetUSDCBSC,
  AssetUSDTBSC
]

export const PoolDetailView = () => {
  const { asset: routeAsset } = useParams<{ asset: string }>()
  const navigate = useNavigate()
  const intl = useIntl()
  const { network$ } = useAppContext()
  const network = useObservableState<Network>(network$, DEFAULT_NETWORK)
  const { protocol } = useApp()
  const { swap$ } = useChainContext()
  const { keystoreService, chainBalances$ } = useWalletContext()
  const {
    service: {
      pools: { poolAddressesByChain$ }
    }
  } = useMidgardContext()
  const { estimateSwap } = useAggregator()
  const priceLevelService = usePriceLevelContext()

  const poolAsset = useMemo(() => (routeAsset ? assetFromString(routeAsset) : null), [routeAsset])
  const assetKey = poolAsset ? assetToString(poolAsset) : ''

  const [timeframe, setTimeframe] = useState<CandleTimeframe>('4H')
  const [dateRange, setDateRange] = useState<ChartDateRange>('30d')
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(DEFAULT_INDICATORS)
  const [priceInput, setPriceInput] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [targetStable, setTargetStable] = useState<AnyAsset>(AssetUSDC)

  // Subscribe to levels from the background service
  const allLevelsMap = useObservableState(priceLevelService.levels$, {})
  const priceLevels = useMemo(() => allLevelsMap[assetKey] ?? [], [allLevelsMap, assetKey])

  // Swap execution state
  const [confirmingLevel, setConfirmingLevel] = useState<PriceLevel | null>(null)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [swapMemo, setSwapMemo] = useState('')

  const {
    state: swapState,
    subscribe: subscribeSwapState,
    reset: resetSwapState
  } = useSubscriptionState<SwapTxState>(INITIAL_SWAP_STATE)

  const executingLevelIdRef = useRef<string | null>(null)
  const executeSwapSubRef = useRef<Rx.Subscription | null>(null)

  const chainBalances = useObservableState(chainBalances$, [])

  const stableBalance = useMemo(() => {
    for (const cb of chainBalances) {
      if (!RD.isSuccess(cb.balances)) continue
      const found = cb.balances.value.find((b) => eqAsset(b.asset, targetStable))
      if (found) return baseToAsset(found.amount).amount().toNumber()
    }
    return 0
  }, [chainBalances, targetStable])

  const midgardDataRD = useOHLCVData({ poolAsset, timeframe, dateRange })
  const { dataRD: binanceDataRD, hasBinance } = useBinanceOHLCV({ poolAsset, timeframe, dateRange })
  const { priceRD: chainflipPriceRD } = useChainflipPrice(poolAsset)
  const spreadInfoRD = usePriceSpread(midgardDataRD, binanceDataRD, chainflipPriceRD)

  // Use Binance as primary when available and loaded, otherwise fall back to Midgard
  const chartDataRD: OHLCVDataRD = useMemo(() => {
    if (!hasBinance) return midgardDataRD
    if (RD.isPending(binanceDataRD)) return RD.pending
    if (RD.isInitial(binanceDataRD) || RD.isFailure(binanceDataRD)) return midgardDataRD
    // Binance succeeded — use it if non-empty, otherwise fall back
    const data = binanceDataRD.value
    return data.length > 0 ? RD.success(data) : midgardDataRD
  }, [hasBinance, binanceDataRD, midgardDataRD])

  // Track which data source the chart is actually using
  const chartSource = useMemo(() => {
    if (!hasBinance) return 'THORChain'
    if (RD.isSuccess(binanceDataRD) && binanceDataRD.value.length > 0) return 'Binance'
    return 'THORChain'
  }, [hasBinance, binanceDataRD])

  // Handle swap trigger when price crosses a level
  const handleTrigger = useCallback(
    async (level: PriceLevel, levelAssetKey: string) => {
      if (!poolAsset || levelAssetKey !== assetKey) return

      priceLevelService.updateLevel(assetKey, level.id, { status: 'confirming' })

      try {
        const isSell = level.type === 'sell'
        const sourceAsset: AnyAsset = isSell ? poolAsset : targetStable
        const targetAsset: AnyAsset = isSell ? targetStable : poolAsset

        const amountValue = assetToBase(assetAmount(level.amount))

        const swapParams = {
          fromAsset: { ...sourceAsset, symbol: sourceAsset.symbol.toUpperCase() },
          destinationAsset: { ...targetAsset, symbol: targetAsset.symbol.toUpperCase() },
          amount: new CryptoAmount(amountValue, {
            ...sourceAsset,
            symbol: sourceAsset.symbol.toUpperCase()
          }),
          streamingInterval: 0,
          streamingQuantity: 0,
          toleranceBps: undefined
        }

        const quotes = await estimateSwap(swapParams, true)
        if (!quotes || quotes.length === 0) {
          priceLevelService.updateLevel(assetKey, level.id, { status: 'failed', error: 'No quote returned' })
          return
        }

        const bestQuote = quotes[0]
        setSwapMemo(bestQuote.memo)
        setConfirmingLevel(level)
      } catch (err) {
        priceLevelService.updateLevel(assetKey, level.id, {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Quote failed'
        })
      }
    },
    [poolAsset, assetKey, targetStable, estimateSwap, priceLevelService]
  )

  // Subscribe to crossing events from the background service
  useEffect(() => {
    const sub = priceLevelService.crossings$.subscribe((event) => {
      // Only handle crossings for the currently viewed pool
      if (event.assetKey !== assetKey) return
      priceLevelService.updateLevel(event.assetKey, event.levelId, { status: 'triggered' })
      const triggeredLevel = { ...event.level, status: 'triggered' as const }
      handleTrigger(triggeredLevel, event.assetKey)
    })
    return () => sub.unsubscribe()
  }, [assetKey, priceLevelService, handleTrigger])

  // Cleanup executeSwap subscription on unmount
  useEffect(() => {
    return () => {
      executeSwapSubRef.current?.unsubscribe()
    }
  }, [])

  // Execute swap after password confirmation
  const executeSwap = useCallback(() => {
    if (!confirmingLevel || !poolAsset || !swapMemo) return

    const isSell = confirmingLevel.type === 'sell'
    const sourceAsset: AnyAsset = isSell ? poolAsset : targetStable
    const sourceChain = sourceAsset.chain

    priceLevelService.updateLevel(assetKey, confirmingLevel.id, { status: 'executing' })
    executingLevelIdRef.current = confirmingLevel.id

    // Get pool address and wallet info
    const poolAddr$ = poolAddressesByChain$(sourceChain)

    executeSwapSubRef.current?.unsubscribe()
    executeSwapSubRef.current = Rx.combineLatest([poolAddr$, chainBalances$])
      .pipe(RxOp.take(1))
      .subscribe(([poolAddrRD, chainBalancesVal]) => {
        if (!RD.isSuccess(poolAddrRD)) {
          priceLevelService.updateLevel(assetKey, confirmingLevel.id, {
            status: 'failed',
            error: 'Could not get pool address'
          })
          executingLevelIdRef.current = null
          return
        }

        const poolAddress = poolAddrRD.value

        // Find wallet info from chain balances
        const chainBalance = chainBalancesVal.find((cb) => cb.chain === sourceChain)
        const walletAddress = chainBalance ? O.toNullable(chainBalance.walletAddress) : null

        if (!walletAddress) {
          priceLevelService.updateLevel(assetKey, confirmingLevel.id, {
            status: 'failed',
            error: 'No wallet address for chain'
          })
          executingLevelIdRef.current = null
          return
        }

        // Get wallet details from balance entries
        let walletAccount = 0
        let walletIndex = 0
        let hdMode: HDMode = 'default'
        const walletType = chainBalance?.walletType || DEFAULT_WALLET_TYPE

        if (chainBalance && RD.isSuccess(chainBalance.balances)) {
          const firstBalance = chainBalance.balances.value[0]
          if (firstBalance) {
            walletAccount = firstBalance.walletAccount
            walletIndex = firstBalance.walletIndex
            hdMode = firstBalance.hdMode
          }
        }

        const amountValue = assetToBase(assetAmount(confirmingLevel.amount))

        const swapTxParams = {
          poolAddress,
          asset: sourceAsset,
          amount: amountValue,
          memo: updateMemo(swapMemo, network),
          walletType,
          sender: walletAddress,
          walletAccount,
          walletIndex,
          hdMode,
          protocol
        }

        subscribeSwapState(swap$(swapTxParams))
      })

    setConfirmingLevel(null)
    setShowPasswordModal(false)
    setSwapMemo('')
  }, [
    confirmingLevel,
    poolAsset,
    assetKey,
    targetStable,
    swapMemo,
    poolAddressesByChain$,
    chainBalances$,
    priceLevelService,
    network,
    protocol,
    subscribeSwapState,
    swap$
  ])

  // Watch swap state for completion
  useEffect(() => {
    const levelId = executingLevelIdRef.current
    if (!levelId) return

    if (RD.isSuccess(swapState.swapTx)) {
      priceLevelService.updateLevel(assetKey, levelId, { status: 'completed', txHash: swapState.swapTx.value })
      executingLevelIdRef.current = null
      resetSwapState()
    } else if (RD.isFailure(swapState.swapTx)) {
      priceLevelService.updateLevel(assetKey, levelId, { status: 'failed', error: swapState.swapTx.error.msg })
      executingLevelIdRef.current = null
      resetSwapState()
    }
  }, [swapState, assetKey, priceLevelService, resetSwapState])

  const handleSwap = useCallback(() => {
    if (!poolAsset) return
    navigate(
      poolsRoutes.swap.path({
        source: assetToString(poolAsset),
        target: assetToString(targetStable),
        sourceWalletType: DEFAULT_WALLET_TYPE,
        targetWalletType: DEFAULT_WALLET_TYPE
      })
    )
  }, [poolAsset, targetStable, navigate])

  const handlePriceClick = useCallback((price: number) => {
    setPriceInput(price.toFixed(2))
  }, [])

  const handleStableSelect = useCallback(
    (asset: AnyAsset) => {
      if (!eqAsset(asset, targetStable)) {
        setTargetStable(asset)
      }
    },
    [targetStable]
  )

  const handleAddLevel = useCallback(
    (type: 'buy' | 'sell') => {
      const price = parseFloat(priceInput)
      const amount = parseFloat(amountInput)
      if (isNaN(price) || price <= 0 || isNaN(amount) || amount <= 0 || !poolAsset) return
      const sourceAsset = type === 'buy' ? targetStable : poolAsset
      const amountSymbol = currencySymbolByAsset(sourceAsset)
      priceLevelService.addLevel(assetKey, {
        id: crypto.randomUUID(),
        price,
        type,
        amount,
        amountSymbol,
        status: 'pending'
      })
      setPriceInput('')
      setAmountInput('')
    },
    [priceInput, amountInput, assetKey, poolAsset, targetStable, priceLevelService]
  )

  const handleRemoveLevel = useCallback(
    (id: string) => {
      priceLevelService.removeLevel(assetKey, id)
    },
    [assetKey, priceLevelService]
  )

  const handleConfirmSwap = useCallback(() => {
    setShowPasswordModal(true)
  }, [])

  const handleCancelConfirm = useCallback(() => {
    if (confirmingLevel) {
      priceLevelService.updateLevel(assetKey, confirmingLevel.id, { status: 'pending' })
    }
    setConfirmingLevel(null)
    setSwapMemo('')
  }, [confirmingLevel, assetKey, priceLevelService])

  const handlePasswordSuccess = useCallback(() => {
    executeSwap()
  }, [executeSwap])

  const handlePasswordClose = useCallback(() => {
    setShowPasswordModal(false)
  }, [])

  // Chip status styling
  const getLevelChipClass = (level: PriceLevel) => {
    const base = level.type === 'buy' ? 'bg-[#22c55e]' : 'bg-[#ef4444]'
    switch (level.status) {
      case 'pending':
        return `${base}/20 ${level.type === 'buy' ? 'text-[#22c55e]' : 'text-[#ef4444]'}`
      case 'triggered':
      case 'confirming':
        return 'bg-yellow-500/20 text-yellow-400 animate-pulse'
      case 'executing':
        return 'bg-yellow-500/20 text-yellow-400'
      case 'completed':
        return 'bg-[#22c55e]/20 text-[#22c55e]'
      case 'failed':
        return 'bg-[#ef4444]/20 text-[#ef4444]'
    }
  }

  const getLevelStatusIcon = (level: PriceLevel) => {
    switch (level.status) {
      case 'executing':
        return (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
        )
      case 'completed':
        return <span className="text-[#22c55e]">&#10003;</span>
      case 'failed':
        return <span title={level.error}>&#10007;</span>
      default:
        return null
    }
  }

  if (!poolAsset) {
    return (
      <div className="flex flex-col items-center p-4">
        <Label>{intl.formatMessage({ id: 'routes.invalid.params' })}</Label>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackLinkButton className="!m-0" />
        <AssetIcon asset={poolAsset} size="normal" network={network} className="pointer-events-none" />
        <h2 className="font-main text-18 text-text0 dark:text-text0d">{poolAsset.ticker}</h2>
      </div>

      {/* Chart panel — always dark themed */}
      <div className="flex flex-col gap-3 rounded-lg bg-[#131722] p-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CandleTimeframeSelector selected={timeframe} onChange={setTimeframe} />
            <ChartDateRangeSelector selected={dateRange} onChange={setDateRange} />
            <span className="rounded bg-white/10 px-2 py-0.5 font-main text-11 text-gray-400">{chartSource}</span>
          </div>
          <div className="flex items-center gap-2">
            <IndicatorToolbar indicators={indicators} onChange={setIndicators} />
          </div>
        </div>

        {/* Spread label — only when Binance data is available */}
        {hasBinance &&
          FP.pipe(
            spreadInfoRD,
            RD.fold(
              () => null,
              () => null,
              () => null,
              (spread) => <SpreadLabel spread={spread} />
            )
          )}

        {/* Chart */}
        {FP.pipe(
          chartDataRD,
          RD.fold(
            () => (
              <div className="flex h-[500px] items-center justify-center">
                <Spin />
              </div>
            ),
            () => (
              <div className="flex h-[500px] items-center justify-center">
                <Spin />
              </div>
            ),
            (error) => (
              <div className="flex h-[500px] items-center justify-center">
                <Label className="text-error0 dark:text-error0d">{error.message}</Label>
              </div>
            ),
            (data) =>
              data.length === 0 ? (
                <div className="flex h-[500px] items-center justify-center">
                  <Label className="text-gray2">{intl.formatMessage({ id: 'pools.chart.noData' })}</Label>
                </div>
              ) : (
                <TradingChart
                  data={data}
                  indicators={indicators}
                  priceLevels={priceLevels}
                  onPriceClick={handlePriceClick}
                />
              )
          )
        )}

        {/* Price level controls */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder={intl.formatMessage({ id: 'pools.chart.priceLevel.placeholder' })}
            className="text-13 h-8 w-32 rounded border border-gray-600 bg-transparent px-2 font-main text-white placeholder-gray-500 outline-none focus:border-turquoise"
          />
          <input
            type="number"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            placeholder={intl.formatMessage({ id: 'pools.chart.priceLevel.amount' })}
            className="text-13 h-8 w-32 rounded border border-gray-600 bg-transparent px-2 font-main text-white placeholder-gray-500 outline-none focus:border-turquoise"
          />
          {stableBalance > 0 && (
            <button
              onClick={() => setAmountInput(stableBalance.toFixed(2))}
              className="text-12 h-8 rounded border border-gray-600 px-2 font-main text-gray-400 transition-colors hover:border-turquoise hover:text-turquoise">
              {intl.formatMessage({ id: 'common.max' })}
            </button>
          )}
          <AssetSelect
            asset={targetStable}
            assets={STABLECOIN_OPTIONS}
            onSelect={handleStableSelect}
            network={network}
            dialogHeadline={intl.formatMessage({ id: 'pools.chart.priceLevel.targetAsset' })}
            className="h-8 rounded border border-gray-600 bg-transparent !shadow-none [&_.flex-col]:!flex-row [&_.flex-col]:!gap-1 [&_.relative.flex.items-center]:!hidden"
          />
          <button
            onClick={() => handleAddLevel('buy')}
            className="text-13 h-8 rounded bg-[#22c55e] px-3 font-main text-white transition-opacity hover:opacity-80">
            {intl.formatMessage({ id: 'pools.chart.priceLevel.buy' })}
          </button>
          <button
            onClick={() => handleAddLevel('sell')}
            className="text-13 h-8 rounded bg-[#ef4444] px-3 font-main text-white transition-opacity hover:opacity-80">
            {intl.formatMessage({ id: 'pools.chart.priceLevel.sell' })}
          </button>
        </div>

        {/* Orders table */}
        {priceLevels.length > 0 && (
          <table className="text-12 w-full font-main">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pr-4 pb-1 font-normal">Side</th>
                <th className="pr-4 pb-1 font-normal">Price</th>
                <th className="pr-4 pb-1 font-normal">Amount</th>
                <th className="pr-4 pb-1 font-normal">Status</th>
                <th className="pb-1 font-normal" />
              </tr>
            </thead>
            <tbody>
              {priceLevels.map((level) => (
                <tr key={level.id} className="border-t border-gray-700/50">
                  <td className="py-1.5 pr-4">
                    <span
                      className={`rounded px-1.5 py-0.5 ${
                        level.type === 'buy' ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-[#ef4444]/20 text-[#ef4444]'
                      }`}>
                      {level.type === 'buy' ? 'Buy' : 'Sell'}
                    </span>
                  </td>
                  <td className="py-1.5 pr-4 text-white">${level.price.toLocaleString()}</td>
                  <td className="py-1.5 pr-4 text-white">
                    {level.amountSymbol}
                    {level.amount}
                  </td>
                  <td className="py-1.5 pr-4">
                    <span className="flex items-center gap-1">
                      {getLevelStatusIcon(level)}
                      <span
                        className={
                          level.status === 'pending'
                            ? 'text-gray-400'
                            : level.status === 'completed'
                              ? 'text-[#22c55e]'
                              : level.status === 'failed'
                                ? 'text-[#ef4444]'
                                : 'text-yellow-400'
                        }>
                        {level.status}
                      </span>
                    </span>
                  </td>
                  <td className="py-1.5 text-right">
                    {level.status === 'pending' && (
                      <button
                        onClick={() => handleRemoveLevel(level.id)}
                        className="text-gray-500 transition-colors hover:text-[#ef4444]">
                        &#10005;
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirmingLevel && !showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg border border-gray-700 bg-[#1e222d] p-6">
            <h3 className="mb-4 font-main text-16 text-white">
              {intl.formatMessage({ id: 'pools.chart.priceLevel.confirm.title' })}
            </h3>
            <p className="mb-6 font-main text-14 text-gray-300">
              {confirmingLevel.type === 'sell'
                ? intl.formatMessage(
                    { id: 'pools.chart.priceLevel.confirm.sell' },
                    { amount: String(confirmingLevel.amount), asset: poolAsset.ticker, target: targetStable.ticker }
                  )
                : intl.formatMessage(
                    { id: 'pools.chart.priceLevel.confirm.buy' },
                    { amount: String(confirmingLevel.amount), asset: poolAsset.ticker, target: targetStable.ticker }
                  )}
            </p>
            <p className="text-12 mb-6 font-main text-gray-500">@ ${confirmingLevel.price}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelConfirm}
                className="text-13 rounded-md border border-gray-600 px-4 py-2 font-main text-gray-300 hover:bg-gray-700">
                {intl.formatMessage({ id: 'common.cancel' })}
              </button>
              <button
                onClick={handleConfirmSwap}
                className="text-13 rounded-md bg-turquoise px-4 py-2 font-main text-white hover:bg-turquoise/80">
                {intl.formatMessage({ id: 'common.confirm' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password modal */}
      {showPasswordModal && (
        <WalletPasswordConfirmationModal
          onSuccess={handlePasswordSuccess}
          onClose={handlePasswordClose}
          validatePassword$={keystoreService.validatePassword$}
        />
      )}
    </div>
  )
}
