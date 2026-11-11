import { ADAChain } from '@xchainjs/xchain-cardano'
import { QuoteSwap } from '@xchainjs/xchain-mayachain-query'
import { PoolDetail } from '@xchainjs/xchain-midgard'
import { XRPChain } from '@xchainjs/xchain-ripple'
import { SOLChain } from '@xchainjs/xchain-solana'

import { THORChain, TxDetails } from '@xchainjs/xchain-thorchain-query'
import { AnyAsset, BaseAmount, baseAmount, Chain, CryptoAmount } from '@xchainjs/xchain-util'
import { array as A, function as FP, option as O } from 'fp-ts'
import { ONE_RUNE_BASE_AMOUNT } from '../../../shared/mock/amount'
import { CACAO_DECIMAL, DEFAULT_FEE } from '../../../shared/utils/chainIds'

import { isLedgerWallet } from '../../../shared/utils/guard'
import { ZERO_BASE_AMOUNT } from '../../const'
import {
  isCacaoAsset,
  isChainAsset,
  isRuneNativeAsset,
  max1e8BaseAmount,
  convertBaseAmountDecimal,
  THORCHAIN_DECIMAL
} from '../../helpers/assetHelper'
import { eqAsset, eqChain } from '../../helpers/fp/eq'
import { priceFeeAmountForAsset } from '../../services/chain/fees/utils'
import { SwapFees } from '../../services/chain/types'
import { PoolDetails as PoolDetailsMaya } from '../../services/midgard/mayaMidgard/types'
import { getPoolDetail as getPoolDetailMaya } from '../../services/midgard/mayaMidgard/utils'
import { PoolAssetDetail, PoolAssetDetails, PoolDetails, PoolsDataMap } from '../../services/midgard/midgardTypes'
import { getPoolDetail } from '../../services/midgard/thorMidgard/utils'
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
 * Cap a native RUNE amount at `balance - 0.02`.
 *
 * THORChain debits `DEFAULT_FEE` before `MsgDeposit` runs, and the client signs
 * that message with an empty fee list. The ante is a flat chain fee, so the
 * quoted inbound fee is not used. Returns `amount` when it already fits.
 */
export const capNativeRuneDeposit = (amount: BaseAmount, balance: BaseAmount): BaseAmount => {
  const reserve = convertBaseAmountDecimal(DEFAULT_FEE, balance.decimal)
  const max = balance.minus(reserve)
  const zero = baseAmount(0, balance.decimal)
  const capped = max.gt(zero) ? max : zero
  const amountInBalance = convertBaseAmountDecimal(amount, balance.decimal)
  return amountInBalance.gt(capped) ? capped : amount
}

/**
 * Turn a Midgard pool depth into a `BaseAmount` of the source asset.
 *
 * Used as the max amount in locked-wallet / quote-only mode.
 * `depthDecimal` is the depth's own scale; `assetDecimal` is the source asset's decimal.
 */
export const poolDepthToBaseAmount = (depth: string, depthDecimal: number, assetDecimal: number): BaseAmount =>
  convertBaseAmountDecimal(baseAmount(depth, depthDecimal), assetDecimal)

/**
 * Cap `amount` at `max`. Returns `amount` when it already fits.
 *
 * `BaseAmount.gt` compares raw base units and ignores `decimal`, so `max` is
 * converted to `amount.decimal` first. The capped result keeps `amount.decimal`.
 */
export const capAmountToMax = (amount: BaseAmount, max: BaseAmount): BaseAmount => {
  const maxInAmountDecimal = convertBaseAmountDecimal(max, amount.decimal)
  return amount.gt(maxInAmountDecimal) ? maxInAmountDecimal : amount
}

/**
 * TradeSwap locked-wallet / quote-only max amount (<= 1e8 based).
 *
 * The SOURCE asset's pool `assetDepth` (1e8). RUNE / CACAO have no pool of their own, so for them
 * it is the TARGET pool's `runeDepth` (CACAO 1e10, RUNE 1e8). A CACAO source always reads the Maya
 * pool, whatever `protocol` is. The depth is converted to the source
 * asset's decimal. If the pool is not found, the cap is 1 unit of the source asset.
 *
 * The result is capped to at most 8 decimals, the scale of `amountToSwapMax1e8` in `TradeSwap`.
 */
export const tradeSwapLockedMax1e8 = ({
  protocol,
  sourceAsset,
  targetAsset,
  sourceAssetDecimal,
  poolDetails,
  poolDetailsMaya
}: {
  protocol: Chain
  sourceAsset: AnyAsset
  targetAsset: AnyAsset
  sourceAssetDecimal: number
  poolDetails: PoolDetails
  poolDetailsMaya: PoolDetailsMaya
}): BaseAmount => {
  const poolAsset = isRuneNativeAsset(sourceAsset) || isCacaoAsset(sourceAsset) ? targetAsset : sourceAsset
  // CACAO only has Maya pools, also when the screen's protocol is THORChain
  const oPoolDetail: O.Option<Pick<PoolDetail, 'assetDepth' | 'runeDepth'>> =
    protocol === THORChain && !isCacaoAsset(sourceAsset)
      ? getPoolDetail(poolDetails, poolAsset)
      : getPoolDetailMaya(poolDetailsMaya, poolAsset)
  const max = FP.pipe(
    oPoolDetail,
    O.map((detail) =>
      isCacaoAsset(sourceAsset)
        ? poolDepthToBaseAmount(detail.runeDepth, CACAO_DECIMAL, sourceAssetDecimal)
        : isRuneNativeAsset(sourceAsset)
          ? poolDepthToBaseAmount(detail.runeDepth, THORCHAIN_DECIMAL, sourceAssetDecimal)
          : poolDepthToBaseAmount(detail.assetDepth, THORCHAIN_DECIMAL, sourceAssetDecimal)
    ),
    O.getOrElse(() => convertBaseAmountDecimal(ONE_RUNE_BASE_AMOUNT, sourceAssetDecimal))
  )
  return max1e8BaseAmount(max)
}

/**
 * Whether `amount` is at or below the quote's dust threshold.
 *
 * `BaseAmount.gte` compares raw base units and ignores `decimal`, so `dust` is converted to
 * `amount.decimal` first. An empty (zero) amount is never reported as dust.
 */
export const isAtOrBelowDust = (amount: BaseAmount, dust: BaseAmount): boolean =>
  !amount.amount().isZero() && convertBaseAmountDecimal(dust, amount.decimal).gte(amount)

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
    max1e8BaseAmount
  )
}

/**
 * Calculates max. balance available to swap
 * In some cases fees needs to be deducted from given amount
 *
 * Removes arbitrary 1000-unit rounding that was causing precision loss
 *
 * assetAmountMax1e8 => balances of source asset (max 1e8)
 * feeAmount => fee of inbound tx (in native asset decimal)
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

  // Flat 0.02 RUNE ante. The quoted fee is not consulted.
  if (isRuneNativeAsset(asset)) return capNativeRuneDeposit(balanceAmountMax1e8, balanceAmountMax1e8)

  // Convert fee to match balance decimal (max 1e8)
  // This ensures both amounts have the same decimal before subtraction
  const estimatedFeeMax1e8 = max1e8BaseAmount(feeAmount)

  // Ensure fee has same decimal as balance for proper subtraction
  const feeInBalanceDecimal =
    estimatedFeeMax1e8.decimal !== balanceAmountMax1e8.decimal
      ? convertBaseAmountDecimal(estimatedFeeMax1e8, balanceAmountMax1e8.decimal)
      : estimatedFeeMax1e8

  // Account reserves: some chains require a minimum balance to keep the account active
  const accountReserveMax1e8 =
    asset.chain === XRPChain
      ? max1e8BaseAmount(baseAmount(1000000, 6))
      : asset.chain === ADAChain
        ? max1e8BaseAmount(baseAmount(1170000, 6))
        : asset.chain === SOLChain
          ? max1e8BaseAmount(baseAmount(5000000, 9)) // rent-exempt reserve + buffer
          : ZERO_BASE_AMOUNT

  const reserveInBalanceDecimal =
    accountReserveMax1e8.decimal !== balanceAmountMax1e8.decimal
      ? convertBaseAmountDecimal(accountReserveMax1e8, balanceAmountMax1e8.decimal)
      : accountReserveMax1e8

  const maxAmountToSwap = balanceAmountMax1e8.minus(feeInBalanceDecimal).minus(reserveInBalanceDecimal)
  return maxAmountToSwap.gt(ZERO_BASE_AMOUNT) ? maxAmountToSwap : ZERO_BASE_AMOUNT
}

/**
 * Helper to get max. amount to swap for native decimal amounts
 *
 * balanceAmount => balances of source asset (in native decimal)
 * feeAmount => fee of inbound tx (in native asset decimal)
 */
export const maxAmountToSwap = ({
  asset,
  balanceAmount,
  feeAmount
}: {
  asset: AnyAsset
  balanceAmount: BaseAmount
  feeAmount: BaseAmount
}): BaseAmount => {
  // Ignore non-chain assets
  if (!isChainAsset(asset)) return balanceAmount

  // Flat 0.02 RUNE ante. The quoted fee is not consulted.
  if (isRuneNativeAsset(asset)) return capNativeRuneDeposit(balanceAmount, balanceAmount)

  // Ensure fee has same decimal as balance for proper subtraction
  const feeInBalanceDecimal =
    feeAmount.decimal !== balanceAmount.decimal ? convertBaseAmountDecimal(feeAmount, balanceAmount.decimal) : feeAmount

  // Account reserves: some chains require a minimum balance to keep the account active
  // XRP: 1 XRP (1,000,000 drops), ADA: ~1.17 ADA (1,170,000 lovelace), SOL: ~0.005 SOL (5,000,000 lamports)
  const accountReserve =
    asset.chain === XRPChain
      ? baseAmount(1000000, balanceAmount.decimal)
      : asset.chain === ADAChain
        ? baseAmount(1170000, balanceAmount.decimal)
        : asset.chain === SOLChain
          ? convertBaseAmountDecimal(baseAmount(5000000, 9), balanceAmount.decimal) // rent-exempt reserve (~0.00089 SOL) + buffer
          : ZERO_BASE_AMOUNT

  const maxAmountToSwap = balanceAmount.minus(feeInBalanceDecimal).minus(accountReserve)
  return maxAmountToSwap.gt(ZERO_BASE_AMOUNT) ? maxAmountToSwap : ZERO_BASE_AMOUNT
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
