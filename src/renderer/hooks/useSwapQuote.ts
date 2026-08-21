import { useCallback, useMemo, useRef, useState } from 'react'

import { AnyAsset, BaseAmount, baseAmount, CryptoAmount, isSecuredAsset } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'

import type { ExtendedQuoteSwap } from '../components/swap/Swap.types'
import { useChainflipContext } from '../contexts/ChainflipContext'
import { useOneClickContext } from '../contexts/OneClickContext'
import { convertBaseAmountDecimal } from '../helpers/assetHelper'
import { createProtocolErrorMessage, validateProtocolsForAssets } from '../helpers/assetProtocolHelper'
import { logger } from '../helpers/logger'
import { useAggregator } from '../store/aggregator/hooks'

type UseSwapQuoteParams = {
  sourceAsset: AnyAsset
  targetAsset: AnyAsset
  sourceAssetDecimal: number
  sourceWalletAddress: string
  destinationAddress: string
  quoteOnly: boolean
  streaming: { enabled: boolean; interval: number; quantity: number }
  slipTolerance: number
  affiliateBps: O.Option<boolean>
}

type UseSwapQuoteResult = {
  quotes: O.Option<ExtendedQuoteSwap[]>
  selectedQuote: O.Option<ExtendedQuoteSwap>
  quoteError: O.Option<Error>
  isFetching: boolean
  fetchQuote: (amount: BaseAmount) => Promise<void>
  selectQuote: (quote: ExtendedQuoteSwap) => void
  resetQuote: () => void
  // Derived
  canSwap: boolean
  slippage: number
  expiry: Date
  expectedAmount: CryptoAmount
}

export const useSwapQuote = ({
  sourceAsset,
  targetAsset,
  sourceAssetDecimal,
  sourceWalletAddress,
  destinationAddress,
  quoteOnly,
  streaming,
  slipTolerance,
  affiliateBps
}: UseSwapQuoteParams): UseSwapQuoteResult => {
  const { estimateSwap, protocols, isBoostEnabled } = useAggregator()
  const { isOneClickSupportedAsset } = useOneClickContext()
  const { isChainflipSupportedAssetSync } = useChainflipContext()

  const requestIdRef = useRef(0)
  const [quotes, setQuotes] = useState<O.Option<ExtendedQuoteSwap[]>>(O.none)
  const [selectedQuote, setSelectedQuote] = useState<O.Option<ExtendedQuoteSwap>>(O.none)
  const [quoteError, setQuoteError] = useState<O.Option<Error>>(O.none)
  const [isFetching, setIsFetching] = useState(false)

  // NOTE (#1175): Chainflip estimates currently call requestDepositAddressV2 inside
  // @xchainjs/xchain-aggregator, so every refresh opens a live deposit channel.
  // Deferring channel open until final confirm requires an aggregator/SDK change;
  // Asgardex hard-disables submit after quote UI expiry as the interim guard.
  const fetchQuote = useCallback(
    async (amount: BaseAmount) => {
      if (amount.amount().isZero()) {
        setSelectedQuote(O.none)
        setQuoteError(O.none)
        return
      }

      // Don't fetch if we don't know whether to apply affiliate fees yet
      if (O.isNone(affiliateBps)) return
      const applyBps = FP.pipe(
        affiliateBps,
        O.getOrElse(() => false)
      )

      // Validate protocols — both checks are backed by the protocols' fetched
      // asset lists (with chain-level fallbacks), so picker and quote agree.
      const protocolValidation = validateProtocolsForAssets(
        sourceAsset,
        targetAsset,
        protocols,
        isChainflipSupportedAssetSync,
        isOneClickSupportedAsset
      )
      if (!protocolValidation.isValid) {
        const errorMessage = createProtocolErrorMessage(
          sourceAsset,
          targetAsset,
          protocolValidation.missingProtocols,
          isChainflipSupportedAssetSync,
          isOneClickSupportedAsset
        )
        setQuoteError(O.some(new Error(errorMessage)))
        setSelectedQuote(O.none)
        setIsFetching(false)
        return
      }

      setSelectedQuote(O.none)
      setIsFetching(true)

      const currentRequestId = ++requestIdRef.current

      try {
        logger.debug('[useSwapQuote] fetchQuote amount:', {
          amountBase: amount.amount().toString(),
          amountDecimal: amount.decimal,
          sourceAsset: `${sourceAsset.chain}.${sourceAsset.symbol}`
        })

        const swapParams = {
          fromAsset: { ...sourceAsset, symbol: sourceAsset.symbol.toUpperCase() },
          destinationAsset: { ...targetAsset, symbol: targetAsset.symbol.toUpperCase() },
          amount: new CryptoAmount(convertBaseAmountDecimal(amount, sourceAssetDecimal), {
            ...sourceAsset,
            symbol: sourceAsset.symbol.toUpperCase()
          }),
          fromAddress: isSecuredAsset(sourceAsset) ? undefined : sourceWalletAddress,
          destinationAddress: quoteOnly ? undefined : destinationAddress,
          streamingInterval: streaming.interval,
          streamingQuantity: streaming.quantity,
          liquidityToleranceBps: slipTolerance * 100,
          toleranceBps: undefined
        }

        const result = await estimateSwap({ ...swapParams, enableBoost: isBoostEnabled }, applyBps)

        // Discard stale response if a newer request was fired
        if (currentRequestId !== requestIdRef.current) return

        const allQuotes: ExtendedQuoteSwap[] = result.map(
          (quote) =>
            ({
              ...quote,
              isBoostQuote: quote.protocol === 'Chainflip' && isBoostEnabled
            }) as ExtendedQuoteSwap
        )

        // Protocols report failures as placeholder quotes (canSwap: false with
        // the reason in `errors`) — never select those as the "best" quote, and
        // surface their errors instead of silently rendering a 0 output.
        const viableQuotes = allQuotes.filter((quote) => quote.canSwap)

        const sortedQuotes = [...viableQuotes].sort((a, b) => {
          const amountA = parseFloat(a.expectedAmount.assetAmountFixedString())
          const amountB = parseFloat(b.expectedAmount.assetAmountFixedString())
          const timeA = a.totalSwapSeconds
          const timeB = b.totalSwapSeconds
          return amountA > amountB ? -1 : amountA < amountB ? 1 : timeA - timeB
        })

        setQuotes(O.some(allQuotes))

        if (sortedQuotes.length > 0) {
          setSelectedQuote(O.some(sortedQuotes[0]))
          setQuoteError(O.none)
        } else {
          setSelectedQuote(O.none)
          const protocolErrors = allQuotes.flatMap((quote) =>
            quote.errors.filter((err) => err.length > 0).map((err) => `${quote.protocol}: ${err}`)
          )
          setQuoteError(
            O.some(new Error(protocolErrors.length > 0 ? protocolErrors.join(' | ') : 'No valid swap routes available'))
          )
        }

        logger.info(
          `Swap quotes fetched: ${allQuotes.length} routes`,
          allQuotes.map((q) => q.protocol)
        )
      } catch (err) {
        // Discard stale error if a newer request was fired
        if (currentRequestId !== requestIdRef.current) return

        logger.error('Failed to fetch estimate:', err)

        let errorToSet: Error
        if (err instanceof Error) {
          errorToSet = err
        } else if (typeof err === 'string') {
          errorToSet = new Error(err)
        } else if (err && typeof err === 'object' && 'message' in err) {
          errorToSet = new Error(String(err.message))
        } else {
          errorToSet = new Error('Failed to get swap estimate. Please try again.')
        }

        setQuoteError(O.some(errorToSet))
      }
      setIsFetching(false)
    },
    [
      affiliateBps,
      sourceAsset,
      sourceAssetDecimal,
      targetAsset,
      protocols,
      estimateSwap,
      sourceWalletAddress,
      quoteOnly,
      destinationAddress,
      streaming.interval,
      streaming.quantity,
      slipTolerance,
      isBoostEnabled,
      isOneClickSupportedAsset,
      isChainflipSupportedAssetSync
    ]
  )

  const selectQuote = useCallback((quote: ExtendedQuoteSwap) => {
    setSelectedQuote(O.some(quote))
  }, [])

  const resetQuote = useCallback(() => {
    setQuotes(O.none)
    setSelectedQuote(O.none)
    setQuoteError(O.none)
  }, [])

  // Derived values from selected quote
  const canSwap: boolean = useMemo(
    () =>
      FP.pipe(
        selectedQuote,
        O.fold(
          () => false,
          (txDetails) => txDetails.canSwap
        )
      ),
    [selectedQuote]
  )

  const slippage: number = useMemo(
    () =>
      FP.pipe(
        selectedQuote,
        O.fold(
          () => 0,
          (txDetails) => txDetails.slipBasisPoints / 100
        )
      ),
    [selectedQuote]
  )

  const expiry: Date = useMemo(
    () =>
      FP.pipe(
        selectedQuote,
        O.fold(
          () => new Date(),
          () => {
            const now = new Date()
            now.setMinutes(now.getMinutes() + 15)
            return now
          }
        )
      ),
    [selectedQuote]
  )

  const expectedAmount: CryptoAmount = useMemo(
    () =>
      FP.pipe(
        selectedQuote,
        O.fold(
          () => new CryptoAmount(baseAmount(0), targetAsset),
          (txDetails) => txDetails.expectedAmount
        )
      ),
    [selectedQuote, targetAsset]
  )

  // Re-fetch when assets change (if amount > 0 and affiliateBps is known)
  // This is driven from Swap.tsx via the fetchQuote call in its own useEffect

  return {
    quotes,
    selectedQuote,
    quoteError,
    isFetching,
    fetchQuote,
    selectQuote,
    resetQuote,
    canSwap,
    slippage,
    expiry,
    expectedAmount
  }
}
