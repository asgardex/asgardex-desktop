import { QuoteSwap } from '@xchainjs/xchain-mayachain-query'
import { THORChain, TxDetails } from '@xchainjs/xchain-thorchain-query'
import { AnyAsset, BaseAmount, baseAmount, Chain, CryptoAmount } from '@xchainjs/xchain-util'
import { array as A, either as E, function as FP, option as O } from 'fp-ts'

import { isLedgerWallet } from '../../../shared/utils/guard'
import { ZERO_BASE_AMOUNT } from '../../const'
import { isChainAsset, isUtxoAssetChain, max1e8BaseAmount } from '../../helpers/assetHelper'
import { eqAsset, eqChain } from '../../helpers/fp/eq'
import { priceFeeAmountForAsset } from '../../services/chain/fees/utils'
import { SwapFees } from '../../services/chain/types'
import { PoolAssetDetail, PoolAssetDetails, PoolsDataMap } from '../../services/midgard/midgardTypes'
import { WalletBalances } from '../../services/wallet/types'
import { AssetsToSwap, QuoteData } from './Swap.types'

/**
 * Extracts the swap limit from a memo string in the format "=:asset:address:limit[/quantity/interval]:extra:extra".
 * @param memo - The memo string containing the swap limit in the fourth part (e.g., "=:r:address:32099887789[/quantity/interval]:dx:0").
 * @returns A BaseAmount representing the swap limit, or ZERO_BASE_AMOUNT if the memo or limit is invalid. i.e no quote or previewed quote
 */
export const getSwapLimit1e8 = (memo: string): BaseAmount => {
  if (!memo?.trim()) {
    return ZERO_BASE_AMOUNT
  }

  const parts = memo.split(':')
  if (parts.length < 4) {
    return ZERO_BASE_AMOUNT
  }

  const swapLimitPart = parts[3]
  if (!swapLimitPart) {
    return ZERO_BASE_AMOUNT
  }

  const swapLimit = swapLimitPart.includes('/') ? swapLimitPart.split('/')[0] : swapLimitPart

  const swapLimitNum = Number(swapLimit)
  if (isNaN(swapLimitNum) || swapLimitNum < 0) {
    return ZERO_BASE_AMOUNT
  }

  return baseAmount(swapLimitNum)
}

export const pickPoolAsset = (assets: PoolAssetDetails, asset: AnyAsset): O.Option<PoolAssetDetail> =>
  FP.pipe(
    assets,
    A.findFirst(
      ({ asset: availableAsset }) =>
        availableAsset.chain === asset.chain &&
        availableAsset.symbol === asset.symbol &&
        availableAsset.ticker === asset.ticker
    ),
    O.alt(() => FP.pipe(assets, A.head))
  )

export const calcRefundFee = (inboundFee: BaseAmount): BaseAmount => inboundFee.times(3)

/**
 * Helper to get min. amount to swap
 *
 * It checks fees for happy path (successful swap) or unhappy path (failed swap)
 *
 * Formulas based on "Better Fees Handling #1381"
 * @see https://github.com/thorchain/asgardex-electron/issues/1381
 */
export const minAmountToSwapMax1e8 = ({
  swapFees,
  inAsset,
  inAssetDecimal,
  outAsset,
  poolsData
}: {
  swapFees: SwapFees
  inAsset: AnyAsset
  inAssetDecimal: number
  outAsset: AnyAsset
  poolsData: PoolsDataMap
}): BaseAmount => {
  const { inFee, outFee } = swapFees

  const inFeeInInboundAsset = priceFeeAmountForAsset({
    feeAmount: inFee.amount,
    feeAsset: inFee.asset,
    asset: inAsset,
    assetDecimal: inAssetDecimal,
    poolsData
  })

  const outFeeInInboundAsset = priceFeeAmountForAsset({
    feeAmount: outFee.amount,
    feeAsset: outFee.asset,
    asset: inAsset,
    assetDecimal: inAssetDecimal,
    poolsData
  })

  const refundFeeInInboundAsset = calcRefundFee(inFeeInInboundAsset)

  const inAssetIsChainAsset = isChainAsset(inAsset)
  const outAssetIsChainAsset = isChainAsset(outAsset)

  const successSwapFee = inAssetIsChainAsset ? inFeeInInboundAsset.plus(outFeeInInboundAsset) : outFeeInInboundAsset
  const failureSwapFee = outAssetIsChainAsset
    ? inFeeInInboundAsset.plus(refundFeeInInboundAsset)
    : refundFeeInInboundAsset

  const feeToCover: BaseAmount = successSwapFee.gte(failureSwapFee) ? successSwapFee : failureSwapFee

  return FP.pipe(
    // Over-estimate fee by 50% to cover possible fee changes
    1.5,
    feeToCover.times,
    // transform fee decimal to be `max1e8`
    max1e8BaseAmount,
    // Zero amount is possible only in case there is not fees information loaded.
    // Just to avoid blinking min value filter out zero min amounts too.
    E.fromPredicate((amount) => amount.eq(0) || !isUtxoAssetChain(inAsset), FP.identity),
    // increase min value by 10k satoshi (for meaningful UTXO assets' only)
    E.getOrElse((amount) => amount.plus(10000))
  )
}

/**
 * Calculates max. balance available to swap
 * In some cases fees needs to be deducted from given amount
 *
 * assetAmountMax1e8 => balances of source asset (max 1e8)
 * feeAmount => fee of inbound tx
 */
export const maxAmountToSwapMax1e8 = ({
  asset,
  balanceAmountMax1e8,
  feeAmount
}: {
  asset: AnyAsset
  balanceAmountMax1e8: BaseAmount
  feeAmount: BaseAmount
}): BaseAmount => {
  // Ignore non-chain assets
  if (!isChainAsset(asset)) return balanceAmountMax1e8

  const estimatedFee = max1e8BaseAmount(feeAmount)
  const maxAmountToSwap = balanceAmountMax1e8.minus(estimatedFee)
  const maxAmountRounded = Math.floor(maxAmountToSwap.amount().toNumber() / 1000) * 1000
  const maxAmountRoundedBase = baseAmount(maxAmountRounded, maxAmountToSwap.decimal)
  return maxAmountRoundedBase.gt(baseAmount(0)) ? maxAmountRoundedBase : baseAmount(0)
}

export const assetsInWallet: (_: WalletBalances) => AnyAsset[] = FP.flow(A.map(({ asset }) => asset))

export const balancesToSwapFrom = ({
  assetsToSwap,
  walletBalances
}: {
  assetsToSwap: O.Option<AssetsToSwap>
  walletBalances: WalletBalances
}): WalletBalances => {
  const walletAssets = assetsInWallet(walletBalances)

  const filteredBalances: WalletBalances = FP.pipe(
    walletBalances,
    A.filter((balance) => walletAssets.includes(balance.asset)),
    (balances) => (balances.length ? balances : walletBalances)
  )

  return FP.pipe(
    assetsToSwap,
    O.map(({ source }) =>
      FP.pipe(
        filteredBalances,
        A.filter((balance) => !eqAsset.equals(balance.asset, source))
      )
    ),
    O.getOrElse(() => walletBalances)
  )
}

export const hasLedgerInBalancesByChain = (chain: Chain, balances: WalletBalances): boolean =>
  FP.pipe(
    balances,
    A.findFirst(({ walletType, asset }) => eqChain.equals(chain, asset.chain) && isLedgerWallet(walletType)),
    O.fold(
      () => false,
      () => true
    )
  )

export const getQuoteData = (
  protocol: Chain,
  oQuote: O.Option<TxDetails>,
  oQuoteMaya: O.Option<QuoteSwap>,
  sourceAsset: AnyAsset,
  targetAsset: AnyAsset,
  sourceAssetDecimal: number,
  targetAssetDecimal: number
): QuoteData => {
  const defaultQuoteData: QuoteData = {
    canSwap: false,
    slipBasisPoints: 0,
    streamingSlipBasisPoints: 0,
    expectedAmountOut: new CryptoAmount(baseAmount(0, targetAssetDecimal), targetAsset),
    expiry: new Date(Date.now() + 15 * 60 * 1000), // Default to 15 minutes from now
    maxStreamingQuantity: 0,
    errors: [],
    recommendedMinAmountIn: new CryptoAmount(baseAmount(0, sourceAssetDecimal), sourceAsset),
    memo: ''
  }

  const mapQuote = <T>(oQuote: O.Option<T>, mapper: (quote: T) => QuoteData): QuoteData =>
    FP.pipe(
      oQuote,
      O.map(mapper),
      O.getOrElse(() => defaultQuoteData)
    )

  if (protocol === THORChain) {
    return mapQuote(oQuote, (txDetails) => ({
      canSwap: txDetails.txEstimate.canSwap,
      slipBasisPoints: txDetails.txEstimate.slipBasisPoints,
      streamingSlipBasisPoints: txDetails.txEstimate.streamingSlipBasisPoints,
      expectedAmountOut: txDetails.txEstimate.netOutputStreaming,
      expiry: txDetails.expiry,
      maxStreamingQuantity: txDetails.txEstimate.maxStreamingQuantity,
      errors: txDetails.txEstimate.errors,
      recommendedMinAmountIn: new CryptoAmount(
        baseAmount(txDetails.txEstimate.recommendedMinAmountIn, sourceAssetDecimal),
        sourceAsset
      ),
      memo: txDetails.memo
    }))
  } else {
    return mapQuote(oQuoteMaya, (quoteSwap) => ({
      canSwap: quoteSwap.canSwap,
      slipBasisPoints: quoteSwap.slipBasisPoints,
      streamingSlipBasisPoints: quoteSwap.slipBasisPoints,
      expectedAmountOut: quoteSwap.expectedAmount,
      expiry: new Date(quoteSwap.expiry * 1000),
      maxStreamingQuantity: quoteSwap.maxStreamingQuantity ? quoteSwap.maxStreamingQuantity : 0,
      errors: quoteSwap.errors,
      recommendedMinAmountIn: quoteSwap.recommendedMinAmountIn
        ? quoteSwap.recommendedMinAmountIn
        : new CryptoAmount(baseAmount(0, sourceAssetDecimal), sourceAsset),
      memo: quoteSwap.memo
    }))
  }
}
