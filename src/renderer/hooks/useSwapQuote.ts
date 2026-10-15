import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import type { Protocol } from '@xchainjs/xchain-aggregator/lib/types'
import { AnyAsset, BaseAmount, baseAmount, Chain, CryptoAmount, isSecuredAsset } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import * as RxOp from 'rxjs/operators'

import type { ExtendedQuoteSwap } from '../components/swap/Swap.types'
import { useChainflipContext } from '../contexts/ChainflipContext'
import { useMidgardContext } from '../contexts/MidgardContext'
import { useMidgardMayaContext } from '../contexts/MidgardMayaContext'
import { useOneClickContext } from '../contexts/OneClickContext'
import { convertBaseAmountDecimal } from '../helpers/assetHelper'
import { createProtocolErrorMessage, validateProtocolsForAssets } from '../helpers/assetProtocolHelper'
import { quoteNeedsRouterApproval } from '../helpers/evmApprovalHelper'
import { logger } from '../helpers/logger'
import {
  dropMayachainForBtcTaproot,
  filterQuotableProtocols,
  isBtcTaprootAddress
} from '../helpers/protocolTradingHalt'
import { getCurrentNetworkState } from '../services/app/service'
import { useAggregator } from '../store/aggregator/hooks'
import { useThorchainMimirHalt } from './useMimirHalt'
import { useMayachainMimirHalt } from './useMimirHaltMaya'
import { pickSelectedQuote, sortQuotesByOutput } from './useSwapQuote.helpers'

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
  /**
   * Content-stable signature of hook-owned quote inputs (halt-filtered protocols,
   * boost, network). Use in refresh effects instead of `fetchQuote` identity.
   */
  quoteRefreshKey: string
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
  const network = getCurrentNetworkState()
  const { isOneClickSupportedAsset } = useOneClickContext()
  const { isChainflipSupportedAssetSync } = useChainflipContext()
  const { mimirHalt: mimirHaltThor } = useThorchainMimirHalt()
  const { mimirHalt: mimirHaltMaya } = useMayachainMimirHalt()
  const {
    service: {
      pools: { haltedChains$: haltedChainsThor$ }
    }
  } = useMidgardContext()
  const {
    service: {
      pools: { haltedChains$: haltedChainsMaya$ }
    }
  } = useMidgardMayaContext()

  const [haltedChainsThor] = useObservableState(
    () => FP.pipe(haltedChainsThor$, RxOp.map(RD.getOrElse((): Chain[] => []))),
    [] as Chain[]
  )
  const [haltedChainsMaya] = useObservableState(
    () => FP.pipe(haltedChainsMaya$, RxOp.map(RD.getOrElse((): Chain[] => []))),
    [] as Chain[]
  )

  const haltState = useMemo(
    () => ({
      thor: { haltedChains: haltedChainsThor, mimirHalt: mimirHaltThor },
      maya: { haltedChains: haltedChainsMaya, mimirHalt: mimirHaltMaya }
    }),
    [haltedChainsThor, mimirHaltThor, haltedChainsMaya, mimirHaltMaya]
  )

  const mayaBlockedByTaproot = isBtcTaprootAddress(sourceWalletAddress) || isBtcTaprootAddress(destinationAddress)

  const quotableProtocols: Protocol[] = useMemo(
    () =>
      dropMayachainForBtcTaproot(
        filterQuotableProtocols(protocols, sourceAsset, targetAsset, haltState),
        sourceWalletAddress,
        destinationAddress
      ),
    [protocols, sourceAsset, targetAsset, haltState, sourceWalletAddress, destinationAddress]
  )

  // Read at response time so an in-flight quote cannot put Maya back after the address changed.
  const taprootAddressRef = useRef({ source: sourceWalletAddress, destination: destinationAddress })
  taprootAddressRef.current = { source: sourceWalletAddress, destination: destinationAddress }

  // Halt-filtered protocol set + boost/network — not fetchQuote identity.
  const quoteRefreshKey = useMemo(
    () => `${quotableProtocols.join(',')}|boost:${isBoostEnabled}|net:${network}`,
    [quotableProtocols, isBoostEnabled, network]
  )

  const requestIdRef = useRef(0)
  /** Sticky user/auto selection across background re-quotes (Chainflip stays Chainflip). */
  const preferredProtocolRef = useRef<Protocol | null>(null)
  const [quotes, setQuotes] = useState<O.Option<ExtendedQuoteSwap[]>>(O.none)
  const [selectedQuote, setSelectedQuote] = useState<O.Option<ExtendedQuoteSwap>>(O.none)
  const [quoteError, setQuoteError] = useState<O.Option<Error>>(O.none)
  const [isFetching, setIsFetching] = useState(false)
  // Aggregator QuoteSwap has no expiry field — capture a 15m window when a fetch lands.
  const [expiry, setExpiry] = useState<Date>(() => new Date())

  // Pair change invalidates any sticky protocol preference from the previous route.
  useEffect(() => {
    preferredProtocolRef.current = null
  }, [sourceAsset, targetAsset])

  // A Taproot sender or recipient must not stay stuck on a Maya quote from the previous address.
  useEffect(() => {
    if (!mayaBlockedByTaproot) return
    if (preferredProtocolRef.current === 'Mayachain') preferredProtocolRef.current = null
  }, [mayaBlockedByTaproot])

  const fetchQuote = useCallback(
    async (amount: BaseAmount) => {
      if (amount.amount().isZero()) {
        preferredProtocolRef.current = null
        setSelectedQuote(O.none)
        setQuoteError(O.none)
        setExpiry(new Date())
        return
      }

      // Don't fetch if we don't know whether to apply affiliate fees yet
      if (O.isNone(affiliateBps)) return
      const applyBps = FP.pipe(
        affiliateBps,
        O.getOrElse(() => false)
      )

      // Validate against halt-filtered protocols so a halted THOR/MAYA route is not
      // treated as a usable enabled protocol for this pair.
      const protocolValidation = validateProtocolsForAssets(
        sourceAsset,
        targetAsset,
        quotableProtocols,
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
        preferredProtocolRef.current = null
        setSelectedQuote(O.none)
        setIsFetching(false)
        return
      }

      if (quotableProtocols.length === 0) {
        setQuoteError(O.some(new Error('No valid swap routes available')))
        preferredProtocolRef.current = null
        setSelectedQuote(O.none)
        setIsFetching(false)
        return
      }

      // Keep the current selection visible while fetching — clearing it caused the UI to
      // flash and then re-pick "best output", which could flip Chainflip → OneClick.
      setIsFetching(true)

      const currentRequestId = ++requestIdRef.current

      try {
        logger.debug('[useSwapQuote] fetchQuote amount:', {
          amountBase: amount.amount().toString(),
          amountDecimal: amount.decimal,
          sourceAsset: `${sourceAsset.chain}.${sourceAsset.symbol}`,
          protocols: quotableProtocols
        })

        // 1Click rejects BigNumber.toString() scientific notation (e.g. NEAR 24dp → "7.7e+24")
        // and non-integer strings. Always pass a pure integer digit string as base units.
        const amountForQuote = convertBaseAmountDecimal(amount, sourceAssetDecimal)
        const amountInteger = baseAmount(
          amountForQuote.amount().integerValue(BigNumber.ROUND_DOWN).toFixed(0),
          amountForQuote.decimal
        )
        const swapParams = {
          fromAsset: { ...sourceAsset, symbol: sourceAsset.symbol.toUpperCase() },
          destinationAsset: { ...targetAsset, symbol: targetAsset.symbol.toUpperCase() },
          amount: new CryptoAmount(amountInteger, {
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

        const result = await estimateSwap({ ...swapParams, enableBoost: isBoostEnabled }, applyBps, quotableProtocols)

        // Discard stale response if a newer request was fired
        if (currentRequestId !== requestIdRef.current) return

        const taprootNow = taprootAddressRef.current
        const blockMaya = isBtcTaprootAddress(taprootNow.source) || isBtcTaprootAddress(taprootNow.destination)
        if (blockMaya && preferredProtocolRef.current === 'Mayachain') preferredProtocolRef.current = null

        const allQuotes: ExtendedQuoteSwap[] = result
          .map(
            (quote) =>
              ({
                ...quote,
                isBoostQuote: quote.protocol === 'Chainflip' && isBoostEnabled
              }) as ExtendedQuoteSwap
          )
          .filter((quote) => !(blockMaya && quote.protocol === 'Mayachain'))

        // Prefer real canSwap quotes. If none, keep THOR/MAYA quotes blocked only by
        // missing router allowance so Swap can select them and run an on-chain
        // isApproved check (approval is not inferred from these error strings).
        const viableQuotes = allQuotes.filter((quote) => quote.canSwap)
        const approvalBlockedQuotes = allQuotes.filter(
          (quote) =>
            !quote.canSwap &&
            (quote.protocol === 'Thorchain' || quote.protocol === 'Mayachain') &&
            quoteNeedsRouterApproval(quote.errors)
        )

        const sortedQuotes = sortQuotesByOutput(viableQuotes)
        const sortedApprovalBlocked = sortQuotesByOutput(approvalBlockedQuotes)
        const nextSelected = pickSelectedQuote(sortedQuotes, sortedApprovalBlocked, preferredProtocolRef.current)

        setQuotes(O.some(allQuotes))
        // Reset the UI expiry window only when a new quote response lands — not when the
        // user merely switches the selected protocol in the existing result set.
        setExpiry(new Date(Date.now() + 15 * 60 * 1000))

        if (nextSelected) {
          // Only clear a sticky preference when that protocol disappeared from the new set.
          if (preferredProtocolRef.current && nextSelected.protocol !== preferredProtocolRef.current) {
            preferredProtocolRef.current = null
          }
          setSelectedQuote(O.some(nextSelected))
          setQuoteError(O.none)
        } else {
          preferredProtocolRef.current = null
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
      quotableProtocols,
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
    const { source, destination } = taprootAddressRef.current
    if (quote.protocol === 'Mayachain' && (isBtcTaprootAddress(source) || isBtcTaprootAddress(destination))) return
    preferredProtocolRef.current = quote.protocol
    setSelectedQuote(O.some(quote))
  }, [])

  const resetQuote = useCallback(() => {
    preferredProtocolRef.current = null
    setQuotes(O.none)
    setSelectedQuote(O.none)
    setQuoteError(O.none)
    setExpiry(new Date())
  }, [])

  // Hide Maya on this render. The stored quote can still be Maya until the next response lands.
  const visibleQuotes = useMemo(
    () =>
      mayaBlockedByTaproot
        ? FP.pipe(
            quotes,
            O.map((list) => list.filter((quote) => quote.protocol !== 'Mayachain'))
          )
        : quotes,
    [mayaBlockedByTaproot, quotes]
  )

  const visibleSelected = useMemo(() => {
    if (!mayaBlockedByTaproot) return selectedQuote
    if (O.isSome(selectedQuote) && selectedQuote.value.protocol !== 'Mayachain') return selectedQuote
    if (O.isNone(visibleQuotes)) return O.none
    const viable = sortQuotesByOutput(visibleQuotes.value.filter((quote) => quote.canSwap))
    const picked = pickSelectedQuote(viable, [], null)
    return picked ? O.some(picked) : O.none
  }, [mayaBlockedByTaproot, selectedQuote, visibleQuotes])

  // Derived values from selected quote
  const canSwap: boolean = useMemo(
    () =>
      FP.pipe(
        visibleSelected,
        O.fold(
          () => false,
          (txDetails) => txDetails.canSwap
        )
      ),
    [visibleSelected]
  )

  const slippage: number = useMemo(
    () =>
      FP.pipe(
        visibleSelected,
        O.fold(
          () => 0,
          (txDetails) => txDetails.slipBasisPoints / 100
        )
      ),
    [visibleSelected]
  )

  const expectedAmount: CryptoAmount = useMemo(
    () =>
      FP.pipe(
        visibleSelected,
        O.fold(
          () => new CryptoAmount(baseAmount(0), targetAsset),
          (txDetails) => txDetails.expectedAmount
        )
      ),
    [visibleSelected, targetAsset]
  )

  // Re-fetch when assets change (if amount > 0 and affiliateBps is known)
  // This is driven from Swap.tsx via the fetchQuote call in its own useEffect

  return {
    quotes: visibleQuotes,
    selectedQuote: visibleSelected,
    quoteError,
    isFetching,
    fetchQuote,
    selectQuote,
    resetQuote,
    quoteRefreshKey,
    canSwap,
    slippage,
    expiry,
    expectedAmount
  }
}
