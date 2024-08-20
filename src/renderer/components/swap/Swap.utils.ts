import { AnyAsset, Asset, BaseAmount, baseAmount, Chain } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/Array'
import * as E from 'fp-ts/Either'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'

import { isLedgerWallet } from '../../../shared/utils/guard'
import { isChainAsset, isUtxoAssetChain, max1e8BaseAmount } from '../../helpers/assetHelper'
import { eqAsset, eqChain } from '../../helpers/fp/eq'
import { priceFeeAmountForAsset } from '../../services/chain/fees/utils'
import { SwapFees } from '../../services/chain/types'
import { PoolAssetDetail, PoolAssetDetails, PoolsDataMap } from '../../services/midgard/types'
import { WalletBalances } from '../../services/wallet/types'
import { AssetsToSwap } from './Swap.types'

/**
 * Returns `BaseAmount` with asgardex identifier - is now a affiliate address/thorname
 * It's always `1e8` based (default by THORChain)
 */
export const getSwapLimit1e8 = (memo: string): BaseAmount => {
  const swapLimitFromMemo = baseAmount(memo.split(':')[3])
  return swapLimitFromMemo
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
 * It checks fees for happy path (successfull swap) or unhappy path (failed swap)
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
 * Helper to calculate balance available to swap by considering possible fees
 *
 * @param assetAmountMax1e8 Balances of source asset - max 1e8
 * @param sourceAsset Source asset to swap from
 * @param inFeeAmount fee of inbound tx
 *
 * @returns BaseAmount available to swap from
 */
export const calcAmountToSwapMax1e8 = ({
  amountToSwapMax1e8,
  sourceAsset,
  inFeeAmount
}: {
  amountToSwapMax1e8: BaseAmount
  sourceAsset: Asset
  inFeeAmount: BaseAmount
}): BaseAmount => {
  // No chain asset, no fee
  if (!isChainAsset(sourceAsset)) return amountToSwapMax1e8
  // In case of chain asset
  // fees needs to be deducted
  const amountToSwap = amountToSwapMax1e8.minus(max1e8BaseAmount(inFeeAmount))
  return amountToSwap.gt(baseAmount(0)) ? amountToSwap : baseAmount(0, amountToSwapMax1e8.decimal)
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
  return maxAmountToSwap.gt(baseAmount(0)) ? maxAmountToSwap : baseAmount(0)
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
