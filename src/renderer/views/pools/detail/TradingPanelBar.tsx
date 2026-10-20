import { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { ArrowsUpDownIcon, ChevronDownIcon, StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, BaseAmount, assetToString, isSecuredAsset } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { ProviderIcon } from '../../../components/swap/ProviderIcon'
import type { ExtendedQuoteSwap } from '../../../components/swap/Swap.types'
import { AssetIcon } from '../../../components/uielements/assets/assetIcon'
import {
  arrangeAssetsForMenu,
  ExtendedAssetType
} from '../../../components/uielements/assets/assetMenu/AssetMenu.helper'
import { Spin } from '../../../components/uielements/spin'
import { assetChainTicker, distinctChainId, isUSDAsset } from '../../../helpers/assetHelper'
import { eqAsset } from '../../../helpers/fp/eq'
import { protocolMapping } from '../../../helpers/protocolHelper'
import { shortQuoteError } from '../../../helpers/tradeQuote'
import { useAssetFavourites } from '../../../hooks/useAssetFavourites'
import { IsApprovedRD } from '../../../services/evm/types'
import { limitVsMarket, type ChartUnit } from './limitPrice'
import { chartPricePrecision, formatChartAmount } from './pairChart'
import { formatSwapAmount, pairRate, swapAmountFromPercent } from './swapAmountDisplay'

/** Counter units per one chart asset, from two display strings. */
const ratioFromTexts = (counterText: string, chartText: string): string | null => {
  const counter = Number(counterText)
  const chart = Number(chartText)
  if (!Number.isFinite(counter) || !Number.isFinite(chart) || counter <= 0 || chart <= 0) return null
  const value = counter / chart
  const text = value.toFixed(chartPricePrecision(value)).replace(/\.?0+$/, '')
  return text === '' || text === '0' ? null : text
}

export type TradeMode = 'buy' | 'sell'
export type OrderType = 'limit' | 'market'
export type Settlement = 'wallet' | 'trade'
export type QuotedSide = TradeMode | null

type Props = {
  poolAsset: AnyAsset
  network: Network
  hasWallet: boolean
  settlement: Settlement
  onDepositTrade?: () => void
  assetBalance: O.Option<BaseAmount>
  /** Balance Buy spends: the counter asset on the selected settlement. */
  buyBalance: O.Option<BaseAmount>
  /** That balance is known and cannot pay the quoted buy. */
  buyShort: boolean
  /** The chart-asset balance is known and cannot pay the sell size. */
  sellShort: boolean
  amountStr: string
  setAmountStr: (v: string) => void
  selectedTarget: AnyAsset | null
  setSelectedTarget: (v: AnyAsset) => void
  availableAssets: AnyAsset[]
  sellQuote: O.Option<ExtendedQuoteSwap>
  /** Quote for the side currently loaded. A buy quote's expected asset is the chart asset. */
  activeQuote: O.Option<ExtendedQuoteSwap>
  quotedSide: QuotedSide
  /** Pay side. A buy spends the counter. */
  tradeMode: TradeMode
  quoteError: O.Option<Error>
  isFetching: boolean
  /** The quote on screen can be submitted, or the limit order can be placed. */
  canTrade: boolean
  isApprovedState: IsApprovedRD
  needsApproval: boolean
  awaitingConfirmation: boolean
  onApprove: () => void
  /** Submits the quoted side, or places the limit order for that side. */
  onTrade: () => void
  /** Swaps the pay and receive assets immediately. Does not submit. */
  onFlip: () => void
  /** Routes for the current amount. The user picks one; the best is only the default. */
  quotes: ExtendedQuoteSwap[]
  onSelectQuote: (quote: ExtendedQuoteSwap) => void
  /** Market swaps now. Limit places a watched order at the entered price. */
  orderType: OrderType
  setOrderType: (orderType: OrderType) => void
  /** Limit price in chart units. A chart click writes this and selects Limit. */
  chartUnit: ChartUnit
  /** Last chart close, in the same units as the limit field. Zero until the series has loaded. */
  chartPrice: number
  limitPriceStr: string
  setLimitPriceStr: (value: string) => void
  /** USD trigger for the watcher. Null until the entered price can be converted. */
  limitUsd: number | null
}

export const TradingPanelBar = ({
  poolAsset,
  network,
  hasWallet,
  settlement,
  onDepositTrade,
  assetBalance,
  buyBalance,
  buyShort,
  sellShort,
  amountStr,
  setAmountStr,
  selectedTarget,
  setSelectedTarget,
  availableAssets,
  sellQuote,
  activeQuote,
  quotedSide,
  tradeMode,
  quoteError,
  isFetching,
  canTrade,
  isApprovedState,
  needsApproval,
  awaitingConfirmation,
  onApprove,
  onTrade,
  onFlip,
  quotes,
  onSelectQuote,
  orderType,
  setOrderType,
  chartUnit,
  chartPrice,
  limitPriceStr,
  setLimitPriceStr,
  limitUsd
}: Props) => {
  const intl = useIntl()

  const buying = tradeMode === 'buy'
  const payBalance = buying ? buyBalance : assetBalance

  const setFromPercent = useCallback(
    (percent: number) => {
      FP.pipe(
        payBalance,
        O.map((amount) => {
          setAmountStr(swapAmountFromPercent(amount, percent))
        })
      )
    },
    [payBalance, setAmountStr]
  )

  const sliderPercent = useMemo(() => {
    if (O.isNone(payBalance)) return 0
    const balance = payBalance.value.amount().toNumber() / 10 ** payBalance.value.decimal
    const size = parseFloat(amountStr)
    if (!balance || !size || size <= 0) return 0
    return Math.max(0, Math.min(100, Math.round((size / balance) * 100)))
  }, [payBalance, amountStr])

  if (!hasWallet) {
    return (
      <div className="flex items-center justify-center border-t border-white/10 bg-white/5 px-4 py-6">
        <span className="text-12 font-main text-gray-500">
          {intl.formatMessage({ id: 'pools.chart.tradingPanel.noWallet' })}
        </span>
      </div>
    )
  }

  const numAmount = parseFloat(amountStr)
  const hasAmount = !!numAmount && numAmount > 0
  const counter = selectedTarget
  const sellExpected = O.isSome(sellQuote) ? formatSwapAmount(sellQuote.value.expectedAmount.baseAmount) : null
  const buyReceive =
    quotedSide === 'buy' && O.isSome(activeQuote) ? formatSwapAmount(activeQuote.value.expectedAmount.baseAmount) : null
  const detailQuote = quotedSide === 'buy' && O.isSome(activeQuote) ? activeQuote : sellQuote
  // 1 chart asset in counter units. A loaded buy uses the counter being spent.
  const rate =
    buying && buyReceive
      ? ratioFromTexts(amountStr, buyReceive)
      : !buying && O.isSome(sellQuote)
        ? pairRate(amountStr, sellQuote.value.expectedAmount.baseAmount)
        : null

  const showApproveButton =
    needsApproval && RD.isSuccess(isApprovedState) && isApprovedState.value === false && !awaitingConfirmation

  const errorText = hasAmount && O.isSome(quoteError) ? shortQuoteError(quoteError.value.message) : ''
  const limitMode = orderType === 'limit'
  const enteredLimit = parseFloat(limitPriceStr)
  const priceLabel = (price: number) =>
    chartUnit === 'pair' && counter
      ? formatChartAmount(price, counter.ticker)
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: price >= 100 ? 2 : price >= 1 ? 4 : 6
        }).format(price)
  const limitLabel = Number.isFinite(enteredLimit) && enteredLimit > 0 ? priceLabel(enteredLimit) : ''
  const vsMarket = limitMode ? limitVsMarket(tradeMode, enteredLimit, chartPrice) : null
  const fillsNow = vsMarket?.immediate === true
  const atMarket = vsMarket !== null && fillsNow && Math.abs(vsMarket.percentFromMarket) < 0.05
  const tradeLabel = intl.formatMessage({
    id: !limitMode
      ? 'common.swap'
      : fillsNow
        ? 'pools.chart.tradingPanel.swapNow'
        : 'pools.chart.tradingPanel.placeOrder'
  })
  const immediateNote =
    limitMode && fillsNow && vsMarket && limitLabel && chartPrice > 0
      ? intl.formatMessage(
          {
            id: atMarket
              ? tradeMode === 'sell'
                ? 'pools.chart.tradingPanel.limit.atMarket.sell'
                : 'pools.chart.tradingPanel.limit.atMarket.buy'
              : tradeMode === 'sell'
                ? 'pools.chart.tradingPanel.limit.through.sell'
                : 'pools.chart.tradingPanel.limit.through.buy'
          },
          {
            pct: `${Math.abs(vsMarket.percentFromMarket).toFixed(Math.abs(vsMarket.percentFromMarket) >= 10 ? 0 : 1)}%`,
            market: priceLabel(chartPrice),
            limit: limitLabel
          }
        )
      : ''
  const payAsset = buying ? counter : poolAsset
  const receiveAsset = buying ? poolAsset : counter
  const receiveText = buying ? (buyReceive ?? '—') : (sellExpected ?? '—')
  const receiveBalance = buying ? assetBalance : buyBalance
  const receiveBalanceText = O.isSome(receiveBalance)
    ? intl.formatMessage(
        { id: 'pools.chart.tradingPanel.available' },
        { amount: formatSwapAmount(receiveBalance.value) }
      )
    : ''
  const payAvailable = intl.formatMessage(
    { id: 'pools.chart.tradingPanel.available' },
    {
      amount: FP.pipe(
        payBalance,
        O.fold(
          () => '0',
          (amount) => formatSwapAmount(amount)
        )
      )
    }
  )

  return (
    <div className="flex flex-col gap-3 border-t border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-black/20 p-1">
        {(['market', 'limit'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setOrderType(type)}
            className={clsx(
              'text-12 rounded-md py-1.5 font-main font-semibold transition-colors',
              orderType === type ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
            )}>
            {intl.formatMessage({
              id: type === 'limit' ? 'pools.chart.tradingPanel.limit' : 'pools.chart.tradingPanel.market'
            })}
          </button>
        ))}
      </div>
      <p className="m-0 font-main text-11 leading-4 text-gray-500">
        {limitMode
          ? limitLabel && limitUsd !== null
            ? intl.formatMessage({ id: 'pools.chart.tradingPanel.limit.hint' }, { price: limitLabel })
            : intl.formatMessage({ id: 'pools.chart.tradingPanel.market.noPrice' })
          : intl.formatMessage({ id: 'pools.chart.tradingPanel.market.hint' })}
      </p>
      {limitMode && (
        <div className="flex flex-col gap-1 rounded-lg bg-white/5 px-3 py-2.5">
          <span className="font-main text-11 text-gray-400">{intl.formatMessage({ id: 'common.price' })}</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={limitPriceStr}
              onChange={(e) => {
                const next = e.target.value
                if (next === '' || /^\d*\.?\d*$/.test(next)) setLimitPriceStr(next)
              }}
              placeholder="0.00"
              className="w-full bg-transparent font-main text-18 text-white placeholder-gray-600 outline-none"
            />
            <span className="text-12 shrink-0 font-main text-gray-300">
              {chartUnit === 'pair' && counter ? counter.ticker : 'USD'}
            </span>
          </div>
        </div>
      )}
      {immediateNote && (
        <p className="m-0 rounded-lg bg-yellow-500/10 px-3 py-2 font-main text-11 leading-4 text-yellow-400">
          {immediateNote}
        </p>
      )}
      {settlement === 'trade' && (
        <div className="flex flex-col gap-0.5">
          <span className="font-main text-11 font-semibold text-white">
            {intl.formatMessage({ id: 'pools.chart.tradingPanel.tradeAccount' })}
          </span>
          <span className="font-main text-11 text-gray-500">
            {intl.formatMessage({ id: 'pools.chart.tradingPanel.tradeAccount.hint' })}
          </span>
          <span className="font-main text-11 text-turquoise">
            {intl.formatMessage({ id: 'pools.chart.tradingPanel.affiliateFree' })}
          </span>
        </div>
      )}
      {onDepositTrade && (
        <button
          type="button"
          onClick={onDepositTrade}
          className="text-12 w-full rounded-lg border border-turquoise/40 py-2 font-main font-semibold text-turquoise transition-colors hover:bg-turquoise/10">
          {intl.formatMessage({ id: 'wallet.action.deposit' })} {intl.formatMessage({ id: 'common.tradeAssets' })}
        </button>
      )}

      <div className="flex flex-col">
        <div className="flex flex-col gap-2 rounded-lg bg-white/5 px-3 pt-2.5 pb-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-main text-11 text-gray-400">
              {intl.formatMessage({
                id: buying ? 'pools.chart.tradingPanel.buyCosts' : 'pools.chart.tradingPanel.size'
              })}
            </span>
            <AssetControl
              asset={payAsset}
              interactive={buying}
              network={network}
              selectedTarget={selectedTarget}
              setSelectedTarget={setSelectedTarget}
              availableAssets={availableAssets}
            />
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => {
              const next = e.target.value
              if (next === '' || /^\d*\.?\d*$/.test(next)) setAmountStr(next)
            }}
            placeholder="0.00"
            className="w-full bg-transparent font-main text-18 text-white placeholder-gray-600 outline-none"
          />
          {O.isSome(payBalance) && (
            <input
              type="range"
              min={0}
              max={100}
              value={sliderPercent}
              aria-label={intl.formatMessage({ id: 'pools.chart.tradingPanel.size' })}
              onChange={(e) => setFromPercent(Number(e.target.value))}
              className="w-full accent-turquoise"
            />
          )}
          <div className="flex items-center justify-between gap-2">
            <span
              className={clsx('font-main text-11', (buying ? buyShort : sellShort) ? 'text-error0' : 'text-gray-500')}>
              {payAvailable}
            </span>
            {O.isSome(payBalance) && <span className="font-main text-11 text-gray-400">{sliderPercent}%</span>}
          </div>
        </div>

        <div className="relative z-10 -my-3 flex justify-center">
          <button
            type="button"
            onClick={onFlip}
            aria-label={intl.formatMessage({ id: 'pools.chart.tradingPanel.switchAssets' })}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-[#1e222d] text-gray-300 transition-colors hover:text-white">
            <ArrowsUpDownIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex flex-col gap-2 rounded-lg bg-white/5 px-3 pt-4 pb-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-main text-11 text-gray-400">
              {intl.formatMessage({
                id: buying ? 'pools.chart.tradingPanel.youReceive' : 'pools.chart.tradingPanel.sellReceives'
              })}
            </span>
            <AssetControl
              asset={receiveAsset}
              interactive={!buying}
              network={network}
              selectedTarget={selectedTarget}
              setSelectedTarget={setSelectedTarget}
              availableAssets={availableAssets}
            />
          </div>
          <span className={clsx('truncate font-main text-18 text-white', isFetching && 'opacity-60')}>
            {receiveText}
          </span>
          {receiveBalanceText && (
            <span className={clsx('truncate font-main text-11', !buying && buyShort ? 'text-error0' : 'text-gray-500')}>
              {receiveBalanceText}
            </span>
          )}
        </div>
      </div>

      {hasAmount && O.isSome(detailQuote) && counter && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5">
          {rate && (
            <span className="font-main text-11 text-gray-400">
              {intl.formatMessage(
                { id: 'pools.chart.tradingPanel.rate' },
                { asset: poolAsset.ticker, rate, target: counter.ticker }
              )}
            </span>
          )}
          <span
            className={clsx(
              'font-main text-11',
              detailQuote.value.slipBasisPoints > 500 ? 'text-error0' : 'text-gray-400'
            )}>
            {intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.slippage' })}{' '}
            {(detailQuote.value.slipBasisPoints / 100).toFixed(2)}%
          </span>
          <QuoteSelect quotes={quotes} selected={detailQuote.value} onSelect={onSelectQuote} />
        </div>
      )}

      {errorText && (
        <div className="rounded-lg bg-error0/10 px-3 py-2">
          <p className="m-0 font-main text-11 leading-4 text-error0">{errorText}</p>
        </div>
      )}

      {showApproveButton ? (
        <button
          type="button"
          onClick={onApprove}
          className="text-12 w-full rounded-lg bg-yellow-500 py-2.5 font-main font-semibold text-white transition-opacity hover:opacity-90">
          {intl.formatMessage({ id: 'pools.chart.tradingPanel.approve' })}
        </button>
      ) : awaitingConfirmation ? (
        <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-500/20 py-2.5">
          <Spin />
          <span className="text-12 font-main text-yellow-400">
            {intl.formatMessage({ id: 'pools.chart.tradingPanel.approve' })}...
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onTrade}
          disabled={!canTrade}
          className={clsx(
            'text-12 flex w-full items-center justify-center rounded-lg py-2.5 font-main font-semibold transition-all',
            canTrade && fillsNow
              ? 'bg-yellow-500 text-gray-900 hover:opacity-90'
              : canTrade
                ? 'bg-turquoise text-white hover:shadow-[0_0_16px_rgba(80,227,194,0.3)]'
                : 'cursor-not-allowed bg-white/10 text-gray-500'
          )}>
          {isFetching && !limitMode ? <Spin /> : tradeLabel}
        </button>
      )}
    </div>
  )
}

const sameRoute = (a: ExtendedQuoteSwap, b: ExtendedQuoteSwap) =>
  a.protocol === b.protocol && Boolean(a.isBoostQuote) === Boolean(b.isBoostQuote)

const routeOutput = (quote: ExtendedQuoteSwap) => parseFloat(quote.expectedAmount.assetAmountFixedString()) || 0

const QuoteSelect = ({
  quotes,
  selected,
  onSelect
}: {
  quotes: ExtendedQuoteSwap[]
  selected: ExtendedQuoteSwap
  onSelect: (quote: ExtendedQuoteSwap) => void
}) => {
  const intl = useIntl()
  const nameOf = (quote: ExtendedQuoteSwap) => {
    const name = protocolMapping[quote.protocol as keyof typeof protocolMapping] ?? quote.protocol
    return quote.isBoostQuote ? `${name} · ${intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.boost' })}` : name
  }
  const options = [...quotes].sort((a, b) => routeOutput(b) - routeOutput(a))
  const listed = options.some((quote) => sameRoute(quote, selected)) ? options : [selected, ...options]
  const bestOutput = listed
    .filter((quote) => quote.canSwap)
    .reduce((max, quote) => Math.max(max, routeOutput(quote)), 0)
  const value = listed.find((quote) => sameRoute(quote, selected)) ?? selected

  if (listed.length <= 1) {
    return (
      <span className="flex items-center gap-1 font-main text-11 text-gray-300">
        <ProviderIcon protocol={selected.protocol} className="!h-3.5 !w-3.5" />
        {nameOf(selected)}
      </span>
    )
  }

  return (
    <Listbox value={value} onChange={onSelect}>
      <div className="relative">
        <ListboxButton
          type="button"
          className="flex cursor-pointer items-center gap-1 rounded-md bg-white/10 px-1.5 py-0.5 font-main text-11 text-gray-200 hover:bg-white/15 hover:text-white">
          <ProviderIcon protocol={value.protocol} className="!h-3.5 !w-3.5" />
          <span>{nameOf(value)}</span>
          <ChevronDownIcon className="h-3 w-3 text-gray-400" />
        </ListboxButton>
        <ListboxOptions className="absolute right-0 z-50 mt-1 max-h-60 w-[260px] overflow-y-auto rounded-lg border border-white/10 bg-[#1e222d] p-1 shadow-xl focus:outline-hidden">
          {listed.map((quote, index) => {
            const isBest = quote.canSwap && routeOutput(quote) === bestOutput && bestOutput > 0
            return (
              <ListboxOption
                key={`${quote.protocol}-${quote.isBoostQuote ? 'boost' : 'base'}-${index}`}
                value={quote}
                className={({ active, selected: isSelected }) =>
                  clsx(
                    'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5',
                    active && 'bg-white/10',
                    isSelected && 'bg-white/5'
                  )
                }>
                <ProviderIcon protocol={quote.protocol} className="!h-3.5 !w-3.5 shrink-0" />
                <span className="text-12 min-w-0 flex-1 truncate font-main text-white">{nameOf(quote)}</span>
                {isBest && (
                  <span className="rounded bg-turquoise/20 px-1 py-0.5 font-main text-[9px] font-semibold text-turquoise">
                    {intl.formatMessage({ id: 'pools.chart.tradingPanel.quote.best' })}
                  </span>
                )}
                <span className="shrink-0 font-main text-11 text-gray-300">
                  {formatSwapAmount(quote.expectedAmount.baseAmount)} {quote.expectedAmount.asset.ticker}
                </span>
              </ListboxOption>
            )
          })}
        </ListboxOptions>
      </div>
    </Listbox>
  )
}

const AssetControl = ({
  asset,
  interactive,
  network,
  selectedTarget,
  setSelectedTarget,
  availableAssets
}: {
  asset: AnyAsset | null
  interactive: boolean
  network: Network
  selectedTarget: AnyAsset | null
  setSelectedTarget: (asset: AnyAsset) => void
  availableAssets: AnyAsset[]
}) => {
  const intl = useIntl()
  const { favourites, toggleFavourite } = useAssetFavourites()
  const arranged = useMemo(
    () => arrangeAssetsForMenu(availableAssets, '', ExtendedAssetType.All, favourites),
    [availableAssets, favourites]
  )

  const renderOption = (option: AnyAsset) => {
    const isSelected = !!selectedTarget && eqAsset.equals(option, selectedTarget)
    const isFavourite = favourites.some((favourite) => eqAsset.equals(favourite, option))
    const chainId = distinctChainId(option)
    const name = assetChainTicker(option)
    const favouriteName = isSecuredAsset(option)
      ? `${name} ${intl.formatMessage({ id: 'common.asset.secured' })}`
      : name
    return (
      <ListboxOption
        key={assetToString(option)}
        value={option}
        className={({ active }) =>
          clsx('flex cursor-pointer items-center gap-2 px-2 py-2', active && 'bg-white/10', isSelected && 'bg-white/5')
        }>
        <button
          type="button"
          tabIndex={-1}
          aria-pressed={isFavourite}
          aria-label={intl.formatMessage(
            { id: isFavourite ? 'common.asset.removeFavourite' : 'common.asset.addFavourite' },
            { asset: favouriteName }
          )}
          className={clsx(
            'flex h-5 w-5 shrink-0 items-center justify-center',
            isFavourite ? 'text-turquoise' : 'text-gray-500 hover:text-turquoise'
          )}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            toggleFavourite(option)
          }}>
          {isFavourite ? <StarSolidIcon className="h-3.5 w-3.5" /> : <StarOutlineIcon className="h-3.5 w-3.5" />}
        </button>
        <AssetIcon asset={option} size="xsmall" network={network} className="pointer-events-none !h-5 !w-5 shrink-0" />
        <span className="text-12 min-w-0 truncate font-main text-white">{option.ticker}</span>
        {chainId && <span className="shrink-0 font-main text-11 text-gray-500">{chainId}</span>}
        {isUSDAsset(option) && (
          <span className="ml-auto shrink-0 rounded bg-turquoise/20 px-1.5 py-0.5 font-main text-[9px] font-semibold text-turquoise">
            USD
          </span>
        )}
      </ListboxOption>
    )
  }

  if (interactive && selectedTarget && availableAssets.length > 0) {
    return (
      <Listbox value={selectedTarget} onChange={setSelectedTarget}>
        <div className="relative">
          <ListboxButton className="text-12 flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 font-main text-white transition-colors hover:bg-white/15">
            {({ open }) => (
              <>
                <AssetIcon
                  asset={selectedTarget}
                  size="xsmall"
                  network={network}
                  className="pointer-events-none !h-5 !w-5"
                />
                <span className="font-semibold">{selectedTarget.ticker}</span>
                <ChevronDownIcon
                  className={clsx('h-3.5 w-3.5 text-gray-400 transition-transform', { 'rotate-180': open })}
                />
              </>
            )}
          </ListboxButton>
          <ListboxOptions className="absolute right-0 z-50 mt-1 max-h-[240px] w-[260px] overflow-y-auto rounded-lg border border-white/10 bg-[#1e222d] shadow-xl focus:outline-hidden">
            {arranged.kind === 'sections' ? (
              <>
                <div className="px-2 pt-2 pb-1 font-main text-[10px] tracking-wide text-gray-500 uppercase">
                  {intl.formatMessage({ id: 'common.asset.favourites' })}
                </div>
                {arranged.favourites.map(renderOption)}
                {arranged.rest.length > 0 && (
                  <>
                    <div className="mx-2 my-1 h-px bg-white/10" />
                    {arranged.rest.map(renderOption)}
                  </>
                )}
              </>
            ) : (
              arranged.assets.map(renderOption)
            )}
          </ListboxOptions>
        </div>
      </Listbox>
    )
  }

  if (!asset) {
    return (
      <span className="text-12 rounded-lg bg-white/10 px-2.5 py-1.5 font-main text-gray-400">
        {intl.formatMessage({ id: 'pools.chart.tradingPanel.selectTarget' })}
      </span>
    )
  }

  return (
    <div className="text-12 flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 font-main text-white">
      <AssetIcon asset={asset} size="xsmall" network={network} className="pointer-events-none !h-5 !w-5" />
      <span className="font-semibold">{asset.ticker}</span>
    </div>
  )
}
