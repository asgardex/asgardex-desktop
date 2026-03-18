import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { QuoteSwap } from '@xchainjs/xchain-aggregator'
import { Network } from '@xchainjs/xchain-client'
import {
  AnyAsset,
  CryptoAmount,
  assetAmount,
  assetToBase,
  assetToString,
  baseToAsset,
  formatAssetAmountCurrency
} from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { AssetIcon } from '../../../components/uielements/assets/assetIcon'
import { Spin } from '../../../components/uielements/spin'
import { DEFAULT_WALLET_TYPE } from '../../../const'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { isUSDAsset } from '../../../helpers/assetHelper'
import { eqAsset } from '../../../helpers/fp/eq'
import * as poolsRoutes from '../../../routes/pools'
import { getDecimal } from '../../../services/chain/decimal'
import { PoolsState } from '../../../services/midgard/midgardTypes'
import { hasImportedKeystore } from '../../../services/wallet/util'
import { useAggregator } from '../../../store/aggregator/hooks'

type Props = {
  poolAsset: AnyAsset
  network: Network
}

type TradeMode = 'buy' | 'sell'

type QuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; quote: QuoteSwap }

export const TradingPanel = ({ poolAsset, network }: Props) => {
  const intl = useIntl()
  const navigate = useNavigate()
  const { estimateSwap } = useAggregator()

  // Wallet state
  const {
    chainBalances$,
    keystoreService: { keystoreState$ }
  } = useWalletContext()
  const keystore = useObservableState(keystoreState$, O.none)
  const hasWallet = hasImportedKeystore(keystore)
  const chainBalances = useObservableState(chainBalances$, [])

  // Pool state for available assets
  const {
    service: {
      pools: { poolsState$ }
    }
  } = useMidgardContext()
  const poolsRD = useObservableState(poolsState$, RD.pending)

  // Extract pool details for decimal resolution
  const poolDetails = useMemo(
    () =>
      FP.pipe(
        poolsRD,
        RD.fold(
          () => undefined,
          () => undefined,
          () => undefined,
          (state: PoolsState) => state.poolDetails
        )
      ),
    [poolsRD]
  )

  // Local state
  const [amountStr, setAmountStr] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [tradeMode, setTradeMode] = useState<TradeMode>('buy')
  const [quoteState, setQuoteState] = useState<QuoteState>({ status: 'idle' })
  const abortRef = useRef(0)

  // Extract user's balance for this pool asset
  const assetBalance = useMemo(() => {
    for (const cb of chainBalances) {
      if (cb.chain !== poolAsset.chain) continue
      if (!RD.isSuccess(cb.balances)) continue
      const found = cb.balances.value.find((b) => eqAsset.equals(b.asset, poolAsset))
      if (found) return O.some(found.amount)
    }
    return O.none
  }, [chainBalances, poolAsset])

  // Get available pool assets, stablecoins first
  const availableAssets = useMemo(
    () =>
      FP.pipe(
        poolsRD,
        RD.fold(
          () => [] as AnyAsset[],
          () => [] as AnyAsset[],
          () => [] as AnyAsset[],
          (state: PoolsState) => {
            const filtered = state.poolAssets.filter((a) => !eqAsset.equals(a, poolAsset))
            const stablecoins = filtered.filter(isUSDAsset).sort((a, b) => a.ticker.localeCompare(b.ticker))
            const others = filtered.filter((a) => !isUSDAsset(a)).sort((a, b) => a.ticker.localeCompare(b.ticker))
            return [...stablecoins, ...others]
          }
        )
      ),
    [poolsRD, poolAsset]
  )

  // Default target: first stablecoin, or first available asset
  const defaultTarget = useMemo(() => {
    const stable = availableAssets.find(isUSDAsset)
    return stable ?? availableAssets[0] ?? null
  }, [availableAssets])

  const [selectedTarget, setSelectedTarget] = useState<AnyAsset | null>(defaultTarget)

  // Sync selectedTarget when pool changes or defaultTarget becomes available
  useEffect(() => {
    setSelectedTarget(defaultTarget)
  }, [defaultTarget])

  // Derive source/target based on trade mode
  const sourceAsset = tradeMode === 'sell' ? poolAsset : selectedTarget
  const targetAsset = tradeMode === 'sell' ? selectedTarget : poolAsset

  const handleSetMax = useCallback(() => {
    FP.pipe(
      assetBalance,
      O.map((amount) => {
        setAmountStr(
          baseToAsset(amount)
            .amount()
            .toFixed(8)
            .replace(/\.?0+$/, '')
        )
      })
    )
  }, [assetBalance])

  const fetchQuote = useCallback(
    async (mode: TradeMode) => {
      if (!selectedTarget) return

      const numAmount = parseFloat(amountStr)
      if (!numAmount || numAmount <= 0) return

      const from = mode === 'sell' ? poolAsset : selectedTarget
      const to = mode === 'sell' ? selectedTarget : poolAsset
      const fromDecimal = await getDecimal(from, poolDetails)
      const cryptoAmount = new CryptoAmount(assetToBase(assetAmount(numAmount, fromDecimal)), from)

      // Resolve destination address from wallet balances
      const destAddress = FP.pipe(
        chainBalances.find((cb) => cb.chain === to.chain),
        O.fromNullable,
        O.chain((cb) => cb.walletAddress),
        O.toUndefined
      )

      const requestId = ++abortRef.current
      setQuoteState({ status: 'loading' })

      try {
        const quotes = await estimateSwap(
          {
            fromAsset: from,
            destinationAsset: to,
            amount: cryptoAmount,
            destinationAddress: destAddress
          },
          true
        )

        // Stale request guard
        if (abortRef.current !== requestId) return

        const bestQuote = quotes.find((q: QuoteSwap) => q.canSwap)
        if (bestQuote) {
          setQuoteState({ status: 'success', quote: bestQuote })
        } else {
          const errors = quotes.flatMap((q: QuoteSwap) => q.errors).filter(Boolean)
          setQuoteState({
            status: 'error',
            message: errors[0] || intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.error' })
          })
        }
      } catch (err) {
        if (abortRef.current !== requestId) return
        setQuoteState({
          status: 'error',
          message:
            err instanceof Error ? err.message : intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.error' })
        })
      }
    },
    [selectedTarget, amountStr, poolAsset, estimateSwap, intl, poolDetails, chainBalances]
  )

  const handleTrade = useCallback(
    (mode: TradeMode) => {
      if (!hasWallet || !selectedTarget) return

      const numAmount = parseFloat(amountStr)
      if (!numAmount || numAmount <= 0) {
        // Open modal with no-amount message
        setTradeMode(mode)
        setQuoteState({ status: 'idle' })
        setModalOpen(true)
        return
      }

      setTradeMode(mode)
      setQuoteState({ status: 'idle' })
      setModalOpen(true)
      // Fetch quote after modal opens
      void fetchQuote(mode)
    },
    [hasWallet, selectedTarget, amountStr, fetchQuote]
  )

  const handleConfirm = useCallback(() => {
    if (!selectedTarget) return

    const source = tradeMode === 'buy' ? assetToString(selectedTarget) : assetToString(poolAsset)
    const target = tradeMode === 'buy' ? assetToString(poolAsset) : assetToString(selectedTarget)

    const path = poolsRoutes.swap.path({
      source,
      target,
      sourceWalletType: DEFAULT_WALLET_TYPE,
      targetWalletType: DEFAULT_WALLET_TYPE
    })
    setModalOpen(false)
    navigate(path)
  }, [selectedTarget, tradeMode, poolAsset, navigate])

  const handleCloseModal = useCallback(() => {
    abortRef.current++
    setModalOpen(false)
    setQuoteState({ status: 'idle' })
  }, [])

  const balanceText = hasWallet
    ? FP.pipe(
        assetBalance,
        O.fold(
          () => `${intl.formatMessage({ id: 'common.balance' })}: 0`,
          (amount) =>
            `${intl.formatMessage({ id: 'common.balance' })}: ${formatAssetAmountCurrency({
              amount: baseToAsset(amount),
              asset: poolAsset,
              trimZeros: true
            })}`
        )
      )
    : null

  const numAmount = parseFloat(amountStr)
  const hasAmount = !!numAmount && numAmount > 0

  return (
    <>
      <div className="flex items-center gap-2 border-t border-white/10 bg-white/5 px-4 py-2">
        {/* Left: balance */}
        <span className="text-12 shrink-0 font-main text-gray-400">
          {balanceText ?? intl.formatMessage({ id: 'pools.chart.tradingPanel.noWallet' })}
        </span>

        {/* Right side */}
        {hasWallet ? (
          <div className="ml-auto flex items-center gap-2">
            {/* Amount input */}
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '' || /^\d*\.?\d*$/.test(v)) setAmountStr(v)
                }}
                placeholder="0.00"
                className="w-[80px] rounded bg-white/10 px-2 py-1 font-main text-11 text-white placeholder-gray-500 outline-none focus:bg-white/15"
              />
              {O.isSome(assetBalance) && (
                <button
                  onClick={handleSetMax}
                  className="text-10 font-main font-semibold text-turquoise transition-opacity hover:opacity-80">
                  {intl.formatMessage({ id: 'common.max' })}
                </button>
              )}
            </div>

            {/* Asset pair dropdown */}
            {selectedTarget && availableAssets.length > 0 && (
              <Listbox value={selectedTarget} onChange={setSelectedTarget}>
                <div className="relative">
                  <ListboxButton className="flex cursor-pointer items-center gap-1.5 rounded bg-white/10 px-2.5 py-1 font-main text-11 text-white transition-colors hover:bg-white/15">
                    {({ open }) => (
                      <>
                        <AssetIcon
                          asset={selectedTarget}
                          size="xsmall"
                          network={network}
                          className="pointer-events-none !h-4 !w-4"
                        />
                        <span>{selectedTarget.ticker}</span>
                        <span className="text-gray-500">&middot;</span>
                        <span className="text-gray-400">{selectedTarget.chain}</span>
                        <ChevronDownIcon
                          className={clsx('h-3 w-3 text-gray-400 transition-transform', { 'rotate-180': open })}
                        />
                      </>
                    )}
                  </ListboxButton>
                  <ListboxOptions className="absolute right-0 bottom-full z-50 mb-1 max-h-[240px] w-[200px] overflow-y-auto rounded-lg border border-white/10 bg-[#1e222d] shadow-lg focus:outline-hidden">
                    {availableAssets.map((asset) => {
                      const isSelected = eqAsset.equals(asset, selectedTarget)
                      return (
                        <ListboxOption
                          key={assetToString(asset)}
                          value={asset}
                          className={({ active }) =>
                            clsx(
                              'flex cursor-pointer items-center gap-2 px-3 py-1.5',
                              active && 'bg-white/10',
                              isSelected && 'bg-white/5'
                            )
                          }>
                          <AssetIcon
                            asset={asset}
                            size="xsmall"
                            network={network}
                            className="pointer-events-none !h-4 !w-4"
                          />
                          <span className="font-main text-11 text-white">{asset.ticker}</span>
                          <span className="text-10 font-main text-gray-500">{asset.chain}</span>
                          {isUSDAsset(asset) && (
                            <span className="ml-auto rounded bg-turquoise/20 px-1 py-0.5 font-main text-[9px] text-turquoise">
                              USD
                            </span>
                          )}
                        </ListboxOption>
                      )
                    })}
                  </ListboxOptions>
                </div>
              </Listbox>
            )}

            {/* Buy / Sell buttons */}
            <button
              onClick={() => handleTrade('buy')}
              className="rounded bg-turquoise px-3 py-1 font-main text-11 font-semibold text-white transition-opacity hover:opacity-80">
              {intl.formatMessage({ id: 'common.buy' })}
            </button>
            <button
              onClick={() => handleTrade('sell')}
              className="rounded bg-error0 px-3 py-1 font-main text-11 font-semibold text-white transition-opacity hover:opacity-80">
              {intl.formatMessage({ id: 'common.sell' })}
            </button>
          </div>
        ) : (
          <span className="text-12 ml-auto font-main text-gray-500">
            {intl.formatMessage({ id: 'pools.chart.tradingPanel.noWallet' })}
          </span>
        )}
      </div>

      {/* Quote Modal */}
      <Dialog as="div" className="relative z-50" open={modalOpen} onClose={handleCloseModal}>
        <DialogBackdrop className="fixed inset-0 bg-black/60" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-[380px] rounded-lg border border-white/10 bg-[#1e222d] p-5 shadow-xl">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-main text-14 font-semibold text-white">
                {intl.formatMessage({ id: 'pools.chart.tradingPanel.quote' })}
              </h3>
              <button onClick={handleCloseModal} className="text-12 font-main text-gray-400 hover:text-white">
                &times;
              </button>
            </div>

            {/* Swap direction summary */}
            {sourceAsset && targetAsset && (
              <div className="mb-4 flex items-center gap-2 rounded bg-white/5 px-3 py-2">
                <AssetIcon
                  asset={sourceAsset}
                  size="xsmall"
                  network={network}
                  className="pointer-events-none !h-5 !w-5"
                />
                <span className="text-12 font-main text-white">
                  {hasAmount ? amountStr : '—'} {sourceAsset.ticker}
                </span>
                <span className="text-12 font-main text-gray-500">&rarr;</span>
                <AssetIcon
                  asset={targetAsset}
                  size="xsmall"
                  network={network}
                  className="pointer-events-none !h-5 !w-5"
                />
                <span className="text-12 font-main text-white">{targetAsset.ticker}</span>
              </div>
            )}

            {/* Quote content */}
            {!hasAmount ? (
              <p className="text-12 py-4 text-center font-main text-gray-400">
                {intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.noAmount' })}
              </p>
            ) : quoteState.status === 'loading' ? (
              <div className="flex items-center justify-center py-8">
                <Spin />
              </div>
            ) : quoteState.status === 'error' ? (
              <p className="text-12 py-4 text-center font-main text-error0">{quoteState.message}</p>
            ) : quoteState.status === 'success' ? (
              <div className="flex flex-col gap-2">
                {/* Expected output */}
                <div className="flex items-center justify-between">
                  <span className="font-main text-11 text-gray-400">
                    {intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.output' })}
                  </span>
                  <span className="text-12 font-main font-semibold text-turquoise">
                    {formatAssetAmountCurrency({
                      amount: baseToAsset(quoteState.quote.expectedAmount.baseAmount),
                      asset: targetAsset!,
                      trimZeros: true
                    })}
                  </span>
                </div>

                {/* Slippage */}
                <div className="flex items-center justify-between">
                  <span className="font-main text-11 text-gray-400">
                    {intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.slippage' })}
                  </span>
                  <span
                    className={clsx(
                      'text-12 font-main',
                      quoteState.quote.slipBasisPoints > 500 ? 'text-error0' : 'text-white'
                    )}>
                    {(quoteState.quote.slipBasisPoints / 100).toFixed(2)}%
                  </span>
                </div>

                {/* Fees */}
                <div className="flex items-center justify-between">
                  <span className="font-main text-11 text-gray-400">
                    {intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.fees' })}
                  </span>
                  <span className="text-12 font-main text-white">
                    {formatAssetAmountCurrency({
                      amount: baseToAsset(quoteState.quote.fees.affiliateFee.baseAmount),
                      asset: quoteState.quote.fees.asset,
                      trimZeros: true
                    })}
                  </span>
                </div>

                {/* Protocol */}
                <div className="flex items-center justify-between">
                  <span className="font-main text-11 text-gray-400">
                    {intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.protocol' })}
                  </span>
                  <span className="text-12 font-main text-white">{quoteState.quote.protocol}</span>
                </div>

                {/* Estimated time */}
                {quoteState.quote.totalSwapSeconds > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="font-main text-11 text-gray-400">
                      {intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.time' })}
                    </span>
                    <span className="text-12 font-main text-white">
                      {quoteState.quote.totalSwapSeconds < 60
                        ? `${quoteState.quote.totalSwapSeconds}s`
                        : `${Math.ceil(quoteState.quote.totalSwapSeconds / 60)}m`}
                    </span>
                  </div>
                )}
              </div>
            ) : null}

            {/* Actions */}
            <div className="mt-5 flex gap-2">
              <button
                onClick={handleCloseModal}
                className="text-12 flex-1 rounded bg-white/10 px-3 py-2 font-main font-semibold text-white transition-opacity hover:opacity-80">
                {intl.formatMessage({ id: 'common.cancel' })}
              </button>
              <button
                onClick={handleConfirm}
                disabled={!hasAmount || quoteState.status === 'loading'}
                className={clsx(
                  'text-12 flex-1 rounded px-3 py-2 font-main font-semibold text-white transition-opacity',
                  tradeMode === 'buy' ? 'bg-turquoise' : 'bg-error0',
                  (!hasAmount || quoteState.status === 'loading') && 'cursor-not-allowed opacity-50'
                )}>
                {intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.confirm' })}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </>
  )
}
