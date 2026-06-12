import { useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import {
  AnyAsset,
  BaseAmount,
  baseAmount,
  baseToAsset,
  formatAssetAmountCurrency,
  CryptoAmount,
  AssetType,
  Address,
  assetAmount,
  assetToBase,
  assetFromStringEx
} from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import * as RxOp from 'rxjs/operators'

import { ASGARDEX_AFFILIATE_FEE_MIN, getAsgardexAffiliateFee, getAsgardexThorname } from '../../shared/const'
import { isChainOfThor } from '../../shared/utils/chain'
import * as Utils from '../components/swap/Swap.utils'
import { useOneClickContext } from '../contexts/OneClickContext'
import { THORCHAIN_DECIMAL, isUSDAsset, convertBaseAmountDecimal } from '../helpers/assetHelper'
import { eqAsset } from '../helpers/fp/eq'
import { getSwapMemo } from '../helpers/memoHelper'
import * as PoolHelpers from '../helpers/poolHelper'
import * as PoolHelpersMaya from '../helpers/poolHelperMaya'
import { emptyString, loadingString } from '../helpers/stringHelper'

import { getZeroSwapFees } from '../services/chain/fees/swap'
import { SwapFeesHandler, SwapFees, SwapFeesRD } from '../services/chain/types'
import type { PoolDetails as PoolDetailsMaya } from '../services/midgard/mayaMidgard/types'
import type { PoolDetails } from '../services/midgard/midgardTypes'
import type { SlipTolerance } from '../types/asgardex'
import { usePricePool } from './usePricePool'
import { usePricePoolMaya } from './usePricePoolMaya'

type UseSwapFeesParams = {
  sourceAsset: AnyAsset
  targetAsset: AnyAsset
  fees$: SwapFeesHandler
  destinationAddress: O.Option<Address>
  slipTolerance: SlipTolerance
  streaming: { interval: number; quantity: number }
  network: Network
  sourceBalance: BaseAmount
  poolDetailsThor: PoolDetails
  poolDetailsMaya: PoolDetailsMaya
  lockedWallet: boolean
  quoteOnly: boolean
  lockedAssetAmount: BaseAmount
  amountToSwap: BaseAmount
  maxAmountToSwapOverride?: BaseAmount
}

type UseSwapFeesResult = {
  swapFeesRD: SwapFeesRD
  swapFees: SwapFees
  maxAmountToSwap: BaseAmount
  affiliateBps: O.Option<boolean>
  inFeeLabel: string
  oPriceSwapInFee: O.Option<CryptoAmount>
  swapMemo: string
}

/**
 * Hook for fee subscription, max swap amount, affiliate BPS check, and inbound fee pricing.
 *
 * Quote-dependent values (outbound fee label, affiliate fee label) are intentionally
 * NOT included here — they depend on `selectedQuote` from `useSwapQuote`, and including
 * them would create a circular dependency. Compute those in the consuming component
 * using `selectedQuote` + the values returned here.
 */
export const useSwapFees = ({
  sourceAsset,
  targetAsset,
  fees$,
  destinationAddress,
  slipTolerance,
  streaming,
  network,
  sourceBalance,
  poolDetailsThor,
  poolDetailsMaya,
  lockedWallet,
  quoteOnly,
  lockedAssetAmount,
  amountToSwap,
  maxAmountToSwapOverride
}: UseSwapFeesParams): UseSwapFeesResult => {
  const pricePoolThor = usePricePool()
  const pricePoolMaya = usePricePoolMaya()
  const { getOneClickUsdPrice } = useOneClickContext()

  const prevChainFees = useRef<O.Option<SwapFees>>(O.none)

  const sourceChain = (
    sourceAsset.type === AssetType.SYNTH
      ? AssetCacao
      : sourceAsset.type === AssetType.SECURED
        ? AssetRuneNative
        : sourceAsset
  ).chain

  const zeroSwapFees = useMemo(
    () => getZeroSwapFees({ inAsset: sourceAsset, outAsset: targetAsset }),
    [sourceAsset, targetAsset]
  )

  // Compute swap memo for fee calculation
  const swapMemo = useMemo(() => {
    return O.fold(
      () => '',
      (recipientAddress: string) => {
        const toleranceBps = slipTolerance * 100
        const affiliateName = getAsgardexThorname(network)
        const affiliateBps = getAsgardexAffiliateFee(network)

        return getSwapMemo({
          targetAsset,
          targetAddress: recipientAddress,
          toleranceBps,
          streamingInterval: streaming.interval,
          streamingQuantity: streaming.quantity,
          affiliateName: affiliateName,
          affiliateBps: affiliateName ? (affiliateBps ?? 0) : undefined
        })
      }
    )(destinationAddress)
  }, [destinationAddress, slipTolerance, network, targetAsset, streaming.interval, streaming.quantity])

  const [swapFeesRD] = useObservableState<SwapFeesRD>(() => {
    return FP.pipe(
      fees$({
        inAsset: sourceAsset,
        memo: swapMemo,
        outAsset: targetAsset
      }),
      RxOp.map((chainFees) => {
        if (RD.isSuccess(chainFees)) {
          prevChainFees.current = O.some(chainFees.value)
        }
        return chainFees
      })
    )
  }, RD.success(zeroSwapFees))

  const swapFees: SwapFees = useMemo(
    () =>
      FP.pipe(
        swapFeesRD,
        RD.toOption,
        O.alt(() => prevChainFees.current),
        O.getOrElse(() => zeroSwapFees)
      ),
    [swapFeesRD, zeroSwapFees]
  )

  // Max amount to swap
  const maxAmountToSwap: BaseAmount = useMemo(() => {
    if (maxAmountToSwapOverride) return maxAmountToSwapOverride
    if (lockedWallet || quoteOnly) {
      return lockedAssetAmount
    }
    return Utils.maxAmountToSwap({
      asset: sourceAsset,
      balanceAmount: sourceBalance,
      feeAmount: swapFees.inFee.amount
    })
  }, [
    maxAmountToSwapOverride,
    lockedAssetAmount,
    lockedWallet,
    quoteOnly,
    sourceAsset,
    sourceBalance,
    swapFees.inFee.amount
  ])

  // Price of swap IN fee (does NOT depend on selectedQuote)
  const oPriceSwapInFee: O.Option<CryptoAmount> = useMemo(() => {
    const assetAmt = new CryptoAmount(swapFees.inFee.amount, swapFees.inFee.asset)
    const usdValueOption = isChainOfThor(assetAmt.asset.chain)
      ? PoolHelpers.getUSDValue({
          balance: { asset: assetAmt.asset, amount: assetAmt.baseAmount },
          poolDetails: poolDetailsThor,
          pricePool: pricePoolThor
        })
      : PoolHelpersMaya.getUSDValue({
          balance: { asset: assetAmt.asset, amount: assetAmt.baseAmount },
          poolDetails: poolDetailsMaya,
          pricePool: pricePoolMaya
        })

    return FP.pipe(
      usdValueOption,
      O.map((result) => new CryptoAmount(result, pricePoolThor.asset))
    )
  }, [poolDetailsMaya, poolDetailsThor, pricePoolMaya, pricePoolThor, swapFees.inFee.amount, swapFees.inFee.asset])

  // In fee label (does NOT depend on selectedQuote)
  const inFeeLabel = useMemo(() => {
    if (!swapFees) return loadingString

    const {
      inFee: { amount, asset: feeAsset }
    } = swapFees

    const fee = formatAssetAmountCurrency({
      amount: baseToAsset(amount),
      asset: feeAsset,
      decimal: isUSDAsset(feeAsset) ? 2 : 6,
      trimZeros: !isUSDAsset(feeAsset)
    })

    const price = FP.pipe(
      oPriceSwapInFee,
      O.map(({ assetAmount, asset }) => {
        if (eqAsset.equals(feeAsset, asset)) return emptyString
        const isVerySmallUSDAmount = isUSDAsset(asset) && assetAmount.amount().lt(0.01)
        const decimalPlaces = isUSDAsset(asset) ? (isVerySmallUSDAmount ? 6 : 2) : 6
        return formatAssetAmountCurrency({
          amount: assetAmount,
          asset: asset,
          decimal: decimalPlaces,
          trimZeros: !isUSDAsset(asset) || isVerySmallUSDAmount
        })
      }),
      O.getOrElse(() => emptyString)
    )
    return price ? `${price} (${fee})` : fee
  }, [oPriceSwapInFee, swapFees])

  // Affiliate BPS check (does NOT depend on selectedQuote)
  const affiliateBps: O.Option<boolean> = useMemo(() => {
    if (amountToSwap.amount().isZero()) return O.none

    let balanceUsdValue: BaseAmount
    const thorBalanceUsdValue = PoolHelpers.getUSDValue({
      balance: { asset: sourceAsset, amount: maxAmountToSwap },
      poolDetails: poolDetailsThor,
      pricePool: pricePoolThor
    })

    if (O.isSome(thorBalanceUsdValue)) {
      balanceUsdValue = thorBalanceUsdValue.value
    } else if (sourceAsset.chain === 'SOL' && sourceAsset.symbol === 'SOL') {
      const avaxSolAsset = assetFromStringEx('AVAX.SOL-0xFE6B19286885a4F7F55AdAD09C3Cd1f906D2478F')
      if (avaxSolAsset) {
        const thorDecimalAmount = convertBaseAmountDecimal(maxAmountToSwap, THORCHAIN_DECIMAL)
        balanceUsdValue = FP.pipe(
          PoolHelpers.getUSDValue({
            balance: { asset: avaxSolAsset, amount: thorDecimalAmount },
            poolDetails: poolDetailsThor,
            pricePool: pricePoolThor
          }),
          O.getOrElse(() => baseAmount(0, maxAmountToSwap.decimal))
        )
      } else {
        balanceUsdValue = baseAmount(0, maxAmountToSwap.decimal)
      }
    } else if (isChainOfThor(sourceChain)) {
      balanceUsdValue = baseAmount(0, maxAmountToSwap.decimal)
    } else {
      balanceUsdValue = FP.pipe(
        PoolHelpersMaya.getUSDValue({
          balance: { asset: sourceAsset, amount: maxAmountToSwap },
          poolDetails: poolDetailsMaya,
          pricePool: pricePoolMaya
        }),
        O.getOrElse(() => baseAmount(0, maxAmountToSwap.decimal))
      )
    }

    if (balanceUsdValue.amount().isZero()) {
      // Pools couldn't price the source. Distinguish "pool data not loaded yet"
      // (defer via O.none — fetchQuote waits) from "no THOR/MAYA pool will ever
      // price this" (e.g. SUI — 1Click-only). Note isChainOfThor can't tell the
      // difference: DEX_CHAINS buckets every enabled non-MAYA chain as a THOR
      // chain, pools or not (the SOL special case above exists because of that).
      const poolsLoaded = poolDetailsThor.length > 0 || poolDetailsMaya.length > 0
      if (!poolsLoaded) return O.none
      // Pools are loaded and still no price — fall back to 1Click's token list
      // so the affiliate threshold still applies; if it has no price either,
      // skip the fee rather than blocking the quote (no price, no fee).
      const oneClickUsdPrice = getOneClickUsdPrice(sourceAsset)
      if (oneClickUsdPrice === undefined) return O.some(false)
      balanceUsdValue = assetToBase(
        assetAmount(baseToAsset(maxAmountToSwap).amount().multipliedBy(oneClickUsdPrice), THORCHAIN_DECIMAL)
      )
      if (balanceUsdValue.amount().isZero()) return O.some(false)
    }

    const affiliateFeeMinInUsdDecimals = assetToBase(assetAmount(ASGARDEX_AFFILIATE_FEE_MIN, balanceUsdValue.decimal))
    if (balanceUsdValue.amount().lt(affiliateFeeMinInUsdDecimals.amount())) return O.some(false)
    if (maxAmountToSwap.amount().isZero()) return O.none

    const swapPercentage = amountToSwap.amount().div(maxAmountToSwap.amount())
    const estimatedSwapUsdValue = balanceUsdValue.amount().multipliedBy(swapPercentage)
    const shouldApplyBps = estimatedSwapUsdValue.gte(affiliateFeeMinInUsdDecimals.amount())
    return O.some(shouldApplyBps)
  }, [
    amountToSwap,
    maxAmountToSwap,
    sourceAsset,
    sourceChain,
    poolDetailsThor,
    pricePoolThor,
    poolDetailsMaya,
    pricePoolMaya,
    getOneClickUsdPrice
  ])

  return {
    swapFeesRD,
    swapFees,
    maxAmountToSwap,
    affiliateBps,
    inFeeLabel,
    oPriceSwapInFee,
    swapMemo
  }
}
