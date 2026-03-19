import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowsUpDownIcon } from '@heroicons/react/24/outline'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import {
  Asset,
  baseToAsset,
  BaseAmount,
  baseAmount,
  formatAssetAmountCurrency,
  delay,
  assetAmount,
  Address,
  CryptoAmount,
  AssetType,
  AnyAsset,
  TokenAsset,
  SynthAsset,
  SecuredAsset,
  assetToString,
  assetFromStringEx
} from '@xchainjs/xchain-util'
import { array as A, function as FP, nonEmptyArray as NEA, option as O } from 'fp-ts'
import { debounce } from 'lodash'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as RxOp from 'rxjs/operators'

import { getAsgardexAffiliateFee } from '../../../shared/const'
import { ONE_RUNE_BASE_AMOUNT } from '../../../shared/mock/amount'
import { isMayaSupportedAsset, isTCSupportedAsset } from '../../../shared/utils/asset'
import { DEFAULT_ENABLED_CHAINS, EnabledChain, isChainOfThor } from '../../../shared/utils/chain'
import { isVultisigWallet } from '../../../shared/utils/guard'
import { WalletType } from '../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../const'
import { useChainflipContext } from '../../contexts/ChainflipContext'
import { useWalletContext } from '../../contexts/WalletContext'
import {
  THORCHAIN_DECIMAL,
  isUSDAsset,
  isRuneNativeAsset,
  isCacaoAsset,
  isEVMTokenAsset,
  getEVMTokenAddressForChain,
  convertBaseAmountDecimal,
  isUtxoAssetChain
} from '../../helpers/assetHelper'
import { addChainflipSwapToTrackerFromQuote } from '../../helpers/chainflipTransactionTracker'
import { getChainAsset } from '../../helpers/chainHelper'
import { isEvmChainToken } from '../../helpers/evmHelper'
import { unionAssets } from '../../helpers/fp/array'
import { eqAsset, eqBaseAmount, eqOAsset, eqOApproveParams } from '../../helpers/fp/eq'
import { sequenceSOption, sequenceTOption } from '../../helpers/fpHelpers'
import { logger } from '../../helpers/logger'
import * as PoolHelpers from '../../helpers/poolHelper'
import * as PoolHelpersMaya from '../../helpers/poolHelperMaya'
import { emptyString, hiddenString, noDataString } from '../../helpers/stringHelper'
import { addSwapToTracker } from '../../helpers/transactionTracker'
import {
  filterWalletBalancesByAssets,
  getWalletBalanceByAssetAndWalletType,
  hasLedgerInBalancesByAsset
} from '../../helpers/walletHelper'
import { useERC20Approval } from '../../hooks/useERC20Approval'
import { useOpenExplorerTxUrl } from '../../hooks/useOpenExplorerTxUrl'
import { usePricePool } from '../../hooks/usePricePool'
import { usePricePoolMaya } from '../../hooks/usePricePoolMaya'
import { useStreamingParams } from '../../hooks/useStreamingParams'
import { useSwapAddresses } from '../../hooks/useSwapAddresses'
import { useSwapExecution } from '../../hooks/useSwapExecution'
import { useSwapFees } from '../../hooks/useSwapFees'
import { useSwapQuote } from '../../hooks/useSwapQuote'
import { FeeRD } from '../../services/chain/types'
import { ApproveParams } from '../../services/evm/types'
import { getPoolDetail as getPoolDetailMaya } from '../../services/midgard/mayaMidgard/utils'
import { getPoolDetail } from '../../services/midgard/thorMidgard/utils'
import { userChains$ } from '../../services/storage/userChains'
import { addAsset } from '../../services/storage/userChainTokens'
import {
  VaultType,
  WalletBalance,
  WalletBalances,
  isKeystoreMode,
  isStandaloneLedgerMode,
  isVultisigMode
} from '../../services/wallet/types'
import { useCoingecko } from '../../store/gecko/hooks'
import { AssetWithAmount } from '../../types/asgardex'
import { GECKO_MAP } from '../../types/generated/geckoMap'
import { ProviderModal } from '../modal/provider'
import { AssetInput } from '../uielements/assets/assetInput'
import { BaseButton, FlatButton } from '../uielements/button'
import { UIFeesRD } from '../uielements/fees'
import { CopyLabel } from '../uielements/label/CopyLabel'
import { Spin } from '../uielements/spin'
import { Tooltip } from '../uielements/tooltip'
import { ErrorLabel } from './components/ErrorLabel'
import { RecipientAddressSection } from './components/RecipientAddressSection'
import { useSwapConfirmationModals } from './components/SwapConfirmationModals'
import { SwapDetailsPanel } from './components/SwapDetailsPanel'
import { SwapSettings } from './components/SwapSettings'
import { SwapSubmitSection } from './components/SwapSubmitSection'
import { ModalState, RateDirection, SwapProps } from './Swap.types'
import * as Utils from './Swap.utils'
import SwapExpiryProgressBar from './SwapExpiryProgressBar'
import { SwapRoute } from './SwapRoute'
import { SwapTxModal } from './SwapTxModal'

export const Swap = ({
  keystore,
  poolAssets,
  assets: {
    source: { asset: sourceAsset, decimal: sourceAssetDecimal, price: sourceAssetPrice },
    target: { asset: targetAsset, decimal: targetAssetDecimal, price: targetAssetPrice }
  },
  poolAddressThor: oPoolAddressThor,
  poolAddressMaya: oPoolAddressMaya,
  swap$,
  swapCF$,
  poolDetailsThor,
  poolDetailsMaya,
  walletBalances,
  validatePassword$,
  reloadFees,
  reloadBalances = FP.constVoid,
  fees$,
  isApprovedERC20Token$,
  sourceKeystoreAddress: oInitialSourceKeystoreAddress,
  sourceLedgerAddress: oSourceLedgerAddress,
  targetKeystoreAddress: oTargetKeystoreAddress,
  targetLedgerAddress: oTargetLedgerAddress,
  recipientAddress: oRecipientAddress,
  sourceWalletType: initialSourceWalletType,
  targetWalletType: oInitialTargetWalletType,
  onChangeAsset,
  network,
  slipTolerance,
  changeSlipTolerance,
  approveERC20Token$,
  reloadApproveFee,
  approveFee$,
  importWalletHandler,
  addressValidator,
  hidePrivateData,
  transactionTrackingService,
  mayaTransactionTrackingService
}: SwapProps) => {
  const { geckoPriceMap } = useCoingecko()
  const intl = useIntl()
  const { appWalletService } = useWalletContext()

  // App wallet state - still needed for keystore mode check, vault type, etc.
  const appWalletState = useObservableState(appWalletService.appWalletState$)
  const lockedWallet = useObservableState(appWalletService.isLocked$, true)

  // Derive chain identifiers
  const { chain: sourceChain } =
    sourceAsset.type === AssetType.SYNTH
      ? AssetCacao
      : sourceAsset.type === AssetType.SECURED
        ? AssetRuneNative
        : sourceAsset
  const { chain: targetChain } =
    targetAsset.type === AssetType.SYNTH
      ? AssetCacao
      : targetAsset.type === AssetType.SECURED
        ? AssetRuneNative
        : targetAsset

  // ─── Hook 1: Address resolution ───────────────────────────────────────────
  const {
    sourceAddress: oSourceWalletAddress,
    sourceWalletType,
    destinationAddress: effectiveRecipientAddress,
    destinationAddressString: effectiveRecipientAddressString,
    useSourceLedger: useSourceAssetLedger,
    useSourceVultisig: useSourceVultisigFromHook,
    useTargetLedger: useTargetAssetLedger,
    quoteOnly,
    setQuoteOnly,
    targetWalletType: oTargetWalletType,
    setTargetWalletType,
    standaloneLedgerTargetAddress,
    setStandaloneLedgerTargetAddress,
    fetchStandaloneLedgerTargetAddress,
    isFetchingStandaloneLedgerAddress,
    customAddressEditActive,
    setCustomAddressEditActive,
    targetHDMode,
    setTargetHDMode,
    targetWalletAccount,
    setTargetWalletAccount,
    targetWalletIndex,
    setTargetWalletIndex
  } = useSwapAddresses({
    sourceAsset,
    targetAsset,
    sourceKeystoreAddress: oInitialSourceKeystoreAddress,
    sourceLedgerAddress: oSourceLedgerAddress,
    targetKeystoreAddress: oTargetKeystoreAddress,
    targetLedgerAddress: oTargetLedgerAddress,
    recipientAddress: oRecipientAddress,
    initialSourceWalletType,
    initialTargetWalletType: oInitialTargetWalletType
  })

  // Vultisig detection - combine hook result with wallet type check
  const useSourceAssetVultisig = useMemo(
    () => useSourceVultisigFromHook || isVultisigWallet(initialSourceWalletType),
    [useSourceVultisigFromHook, initialSourceWalletType]
  )

  const { isAssetSupported$, transactionTrackingService: chainflipTransactionTrackingService } = useChainflipContext()

  const { streamingInterval, streamingQuantity, isStreaming, activeMode, setMode, setQuantity, resetToDefault } =
    useStreamingParams()

  const { balances: oWalletBalances, loading: walletBalancesLoading } = walletBalances

  const [enabledChains, setEnabledChains] = useState<Set<EnabledChain>>(new Set())
  const [disabledChains, setDisabledChains] = useState<EnabledChain[]>([])

  const isTargetChainDisabled = disabledChains.includes(targetChain)
  const isSourceChainDisabled = disabledChains.includes(sourceChain)

  useEffect(() => {
    const subscription = userChains$.subscribe((chains: EnabledChain[]) => {
      setEnabledChains(new Set(chains))
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const defaultChains = Object.keys(DEFAULT_ENABLED_CHAINS) as EnabledChain[]
    const disabled = defaultChains.filter((chain) => !enabledChains.has(chain))
    setDisabledChains(disabled)
  }, [enabledChains])

  // ZERO `BaseAmount` for target Asset - original decimal
  const zeroTargetBaseAmountMax = useMemo(() => baseAmount(0, targetAssetDecimal), [targetAssetDecimal])

  const prevSourceAsset = useRef<O.Option<AnyAsset>>(O.none)
  const prevTargetAsset = useRef<O.Option<AnyAsset>>(O.none)

  const sourceWalletAddress = useMemo(() => {
    return FP.pipe(
      oSourceWalletAddress,
      O.fold(
        () => '',
        (sourceAddress) => sourceAddress
      )
    )
  }, [oSourceWalletAddress])

  /**
   * All balances based on available assets to swap
   */
  const allBalances: WalletBalances = useMemo(
    () =>
      FP.pipe(
        oWalletBalances,
        O.map((balances) => filterWalletBalancesByAssets(balances, poolAssets)),
        O.getOrElse<WalletBalances>(() => [])
      ),
    [oWalletBalances, poolAssets]
  )

  const hasSourceAssetLedger = useMemo(
    () => hasLedgerInBalancesByAsset(sourceAsset, allBalances),
    [sourceAsset, allBalances]
  )

  const hasTargetAssetLedger = useMemo(() => O.isSome(oTargetLedgerAddress), [oTargetLedgerAddress])

  const getTargetWalletTypeByAddress = useCallback(
    (address: Address): O.Option<WalletType> => {
      const isKeystoreAddress = FP.pipe(
        oTargetKeystoreAddress,
        O.map((keystoreAddress) => keystoreAddress === address),
        O.getOrElse(() => false)
      )
      const isLedgerAddress = FP.pipe(
        oTargetLedgerAddress,
        O.map((ledgerAddress) => ledgerAddress === address),
        O.getOrElse(() => false)
      )
      return isKeystoreAddress ? O.some(WalletType.Keystore) : isLedgerAddress ? O.some(WalletType.Ledger) : O.none
    },
    [oTargetLedgerAddress, oTargetKeystoreAddress]
  )

  // `AssetWB` of source asset
  const oSourceAssetWB: O.Option<WalletBalance> = useMemo(() => {
    const oWalletBalances = NEA.fromArray(allBalances)
    const result = getWalletBalanceByAssetAndWalletType({
      oWalletBalances,
      asset: sourceAsset,
      walletType: sourceWalletType
    })
    logger.debug('[Swap] sourceAssetDecimal (from prop):', sourceAssetDecimal)
    logger.debug('[Swap] sourceWalletType:', sourceWalletType)
    logger.debug('[Swap] sourceAsset:', sourceAsset.chain, sourceAsset.symbol)
    FP.pipe(
      result,
      O.fold(
        () => logger.debug('[Swap] oSourceAssetWB: NONE (no balance found)'),
        (wb) =>
          logger.debug('[Swap] oSourceAssetWB:', {
            amount: wb.amount.amount().toString(),
            decimal: wb.amount.decimal,
            walletType: wb.walletType,
            walletAddress: wb.walletAddress
          })
      )
    )
    return result
  }, [sourceAsset, allBalances, sourceWalletType, sourceAssetDecimal])

  const sourceBalanceLoading = useMemo(
    () => walletBalancesLoading && O.isNone(oSourceAssetWB),
    [walletBalancesLoading, oSourceAssetWB]
  )

  // User balance for source asset
  const sourceAssetAmount: BaseAmount = useMemo(() => {
    const result = FP.pipe(
      oSourceAssetWB,
      O.map(({ amount }) => amount),
      O.getOrElse(() => baseAmount(0, sourceAssetDecimal))
    )
    logger.debug('[Swap] sourceAssetAmount:', {
      amount: result.amount().toString(),
      decimal: result.decimal
    })
    return result
  }, [oSourceAssetWB, sourceAssetDecimal])

  /** Balance of source asset in native form */
  const sourceAssetAmountNative: BaseAmount = useMemo(() => sourceAssetAmount, [sourceAssetAmount])

  // source chain asset
  const sourceChainAsset: Asset = useMemo(() => getChainAsset(sourceChain), [sourceChain])

  // User balance for source chain asset
  const sourceChainAssetAmount: BaseAmount = useMemo(
    () =>
      FP.pipe(
        getWalletBalanceByAssetAndWalletType({
          oWalletBalances,
          asset: sourceChainAsset,
          walletType: sourceWalletType
        }),
        O.map(({ amount }) => amount),
        O.getOrElse(() => baseAmount(0, sourceAssetDecimal))
      ),
    [oWalletBalances, sourceAssetDecimal, sourceChainAsset, sourceWalletType]
  )

  const initialAmountToSwap = useMemo(() => baseAmount(0, sourceAssetAmountNative.decimal), [sourceAssetAmountNative])

  const [amountToSwap, _setAmountToSwap] = useState(initialAmountToSwap)

  const [isSendMax, setIsSendMax] = useState<boolean>(false)

  const isSourceUTXO = useMemo(() => isUtxoAssetChain(sourceAsset), [sourceAsset])

  const [lockedAssetAmount, setLockedAssetAmount] = useState<CryptoAmount>(
    new CryptoAmount(baseAmount(0, sourceAssetDecimal), sourceAsset)
  )

  const pricePoolThor = usePricePool()
  const pricePoolMaya = usePricePoolMaya()

  const priceAmountToSwap: CryptoAmount = useMemo(() => {
    const thorUsdValue = PoolHelpers.getUSDValue({
      balance: { asset: sourceAsset, amount: amountToSwap },
      poolDetails: poolDetailsThor,
      pricePool: pricePoolThor
    })

    let result: BaseAmount

    if (O.isSome(thorUsdValue)) {
      result = thorUsdValue.value
    } else if (sourceAsset.chain === 'SOL' && sourceAsset.symbol === 'SOL') {
      const avaxSolAsset = assetFromStringEx('AVAX.SOL-0xFE6B19286885a4F7F55AdAD09C3Cd1f906D2478F')
      if (avaxSolAsset) {
        const thorDecimalAmount = convertBaseAmountDecimal(amountToSwap, THORCHAIN_DECIMAL)
        result = FP.pipe(
          PoolHelpers.getUSDValue({
            balance: { asset: avaxSolAsset, amount: thorDecimalAmount },
            poolDetails: poolDetailsThor,
            pricePool: pricePoolThor
          }),
          O.getOrElse(() => baseAmount(0, amountToSwap.decimal))
        )
      } else {
        result = baseAmount(0, amountToSwap.decimal)
      }
    } else if (isChainOfThor(sourceChain)) {
      result = baseAmount(0, amountToSwap.decimal)
    } else {
      result = FP.pipe(
        PoolHelpersMaya.getUSDValue({
          balance: { asset: sourceAsset, amount: amountToSwap },
          poolDetails: poolDetailsMaya,
          pricePool: pricePoolMaya
        }),
        O.getOrElse(() => baseAmount(0, amountToSwap.decimal))
      )
    }

    return new CryptoAmount(result, pricePoolThor.asset)
  }, [amountToSwap, poolDetailsMaya, poolDetailsThor, pricePoolMaya, pricePoolThor, sourceAsset, sourceChain])

  const isZeroAmountToSwap = useMemo(() => amountToSwap.amount().isZero(), [amountToSwap])

  // ─── Hook 2: Fee subscription and pricing ──────────────────────────────────
  // Note: This hook does NOT take selectedQuote. It returns only quote-independent
  // values (fees, maxAmount, affiliateBps, inFeeLabel). Quote-dependent fee labels
  // (outFeeLabel, affiliateFeeLabel) are computed below after useSwapQuote.
  const {
    swapFeesRD,
    swapFees,
    maxAmountToSwap,
    affiliateBps: oApplyBps,
    inFeeLabel: priceSwapInFeeLabel,
    oPriceSwapInFee,
    swapMemo
  } = useSwapFees({
    sourceAsset,
    targetAsset,
    fees$,
    destinationAddress: effectiveRecipientAddress,
    slipTolerance,
    streaming: { interval: streamingInterval, quantity: streamingQuantity },
    network,
    sourceBalance: sourceAssetAmountNative,
    poolDetailsThor,
    poolDetailsMaya,
    lockedWallet,
    quoteOnly,
    lockedAssetAmount: lockedAssetAmount.baseAmount,
    amountToSwap
  })

  // ─── Hook 3: Quote fetching ───────────────────────────────────────────────
  const {
    quotes: oQuoteProcotols,
    selectedQuote: oQuoteProtocol,
    quoteError: oErrorProtocol,
    isFetching: isFetchingEstimate,
    fetchQuote: fetchSwap,
    selectQuote: handleSelectQuote,
    resetQuote,
    canSwap,
    slippage: swapSlippage,
    expiry: swapExpiry,
    expectedAmount: swapResultAmountMax
  } = useSwapQuote({
    sourceAsset,
    targetAsset,
    sourceAssetDecimal,
    sourceWalletAddress,
    destinationAddress: effectiveRecipientAddressString,
    quoteOnly,
    streaming: { enabled: isStreaming, interval: streamingInterval, quantity: streamingQuantity },
    slipTolerance,
    affiliateBps: oApplyBps
  })

  // ─── Quote-dependent fee values ─────────────────────────────────────────────
  // These depend on selectedQuote from useSwapQuote, so they live here (not in useSwapFees)
  // to avoid a circular dependency: useSwapFees→affiliateBps→useSwapQuote→selectedQuote→useSwapFees.

  // Outbound fee from quote response
  const oSwapOutFee: CryptoAmount = useMemo(() => {
    return FP.pipe(
      oQuoteProtocol,
      O.fold(
        () =>
          new CryptoAmount(
            swapFees.outFee.amount,
            swapFees.outFee.asset.type === AssetType.SYNTH
              ? AssetCacao
              : swapFees.outFee.asset.type === AssetType.SECURED
                ? AssetRuneNative
                : swapFees.outFee.asset
          ),
        (txDetails) => txDetails.fees.outboundFee
      )
    )
  }, [oQuoteProtocol, swapFees.outFee.amount, swapFees.outFee.asset])

  const [outFeePriceValue, setOutFeePriceValue] = useState<CryptoAmount>(
    new CryptoAmount(swapFees.outFee.amount, targetAsset)
  )

  useEffect(() => {
    if (O.isNone(oQuoteProtocol)) return
    const calculateSwapOutFeePrice = () => {
      if (isUSDAsset(oSwapOutFee.asset)) {
        return O.some(oSwapOutFee.baseAmount)
      }
      return isChainOfThor(oSwapOutFee.asset.chain)
        ? PoolHelpers.getUSDValue({
            balance: { asset: oSwapOutFee.asset, amount: oSwapOutFee.baseAmount },
            poolDetails: poolDetailsThor,
            pricePool: pricePoolThor
          })
        : PoolHelpersMaya.getUSDValue({
            balance: { asset: oSwapOutFee.asset, amount: oSwapOutFee.baseAmount },
            poolDetails: poolDetailsMaya,
            pricePool: pricePoolMaya
          })
    }
    const swapOutFeePrice = calculateSwapOutFeePrice()
    if (O.isSome(swapOutFeePrice)) {
      const newOutFeePriceValue = new CryptoAmount(swapOutFeePrice.value, pricePoolThor.asset)
      setOutFeePriceValue((prevValue) =>
        prevValue?.baseAmount.eq(newOutFeePriceValue.baseAmount) ? prevValue : newOutFeePriceValue
      )
    }
  }, [
    pricePoolThor,
    pricePoolMaya,
    oQuoteProtocol,
    oSwapOutFee.asset,
    oSwapOutFee.baseAmount,
    poolDetailsThor,
    poolDetailsMaya
  ])

  const priceSwapOutFeeLabel = useMemo(() => {
    if (!swapFees) return ''
    const {
      outFee: { asset: feeAsset }
    } = swapFees
    const fee = formatAssetAmountCurrency({
      amount: baseToAsset(oSwapOutFee.baseAmount),
      asset: feeAsset,
      decimal: isUSDAsset(feeAsset) ? 2 : 6,
      trimZeros: !isUSDAsset(feeAsset)
    })
    const price = FP.pipe(
      O.some(outFeePriceValue),
      O.map((cryptoAmount: CryptoAmount) =>
        eqAsset.equals(feeAsset, cryptoAmount.asset)
          ? ''
          : formatAssetAmountCurrency({
              amount: cryptoAmount.assetAmount,
              asset: cryptoAmount.asset,
              decimal: isUSDAsset(cryptoAmount.asset) ? 2 : 6,
              trimZeros: !isUSDAsset(cryptoAmount.asset)
            })
      ),
      O.getOrElse(() => '')
    )
    return price ? `${price} (${fee})` : fee
  }, [swapFees, oSwapOutFee, outFeePriceValue])

  // Affiliate fee from quote
  const affiliateFee: CryptoAmount = useMemo(() => {
    return FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => new CryptoAmount(baseAmount(0), AssetRuneNative),
        (txDetails) => txDetails.fees.affiliateFee
      )
    )
  }, [oQuoteProtocol])

  const [affiliatePriceValue, setAffiliatePriceValue] = useState<CryptoAmount>(
    new CryptoAmount(baseAmount(0, sourceAssetDecimal), sourceAsset)
  )

  useEffect(() => {
    if (O.isNone(oQuoteProtocol)) return
    const affiliateUsdValue = isChainOfThor(affiliateFee.asset.chain)
      ? PoolHelpers.getUSDValue({
          balance: { asset: affiliateFee.asset, amount: affiliateFee.baseAmount },
          poolDetails: poolDetailsThor,
          pricePool: pricePoolThor
        })
      : PoolHelpersMaya.getUSDValue({
          balance: { asset: affiliateFee.asset, amount: affiliateFee.baseAmount },
          poolDetails: poolDetailsMaya,
          pricePool: pricePoolMaya
        })
    if (O.isSome(affiliateUsdValue)) {
      setAffiliatePriceValue(new CryptoAmount(affiliateUsdValue.value, pricePoolThor.asset))
    }
  }, [affiliateFee, oQuoteProtocol, poolDetailsMaya, poolDetailsThor, pricePoolMaya, pricePoolThor])

  const priceAffiliateFeeLabel = useMemo(() => {
    if (!swapFees) return ''

    const fee = formatAssetAmountCurrency({
      amount: affiliateFee.assetAmount,
      asset: affiliateFee.asset,
      decimal: isUSDAsset(affiliateFee.asset) ? 2 : 6,
      trimZeros: !isUSDAsset(affiliateFee.asset)
    })

    const price = FP.pipe(
      O.some(affiliatePriceValue),
      O.map((cryptoAmount: CryptoAmount) =>
        eqAsset.equals(sourceAsset, cryptoAmount.asset)
          ? ''
          : formatAssetAmountCurrency({
              amount: cryptoAmount.assetAmount,
              asset: cryptoAmount.asset,
              decimal: isUSDAsset(cryptoAmount.asset) ? 2 : 6,
              trimZeros: !isUSDAsset(cryptoAmount.asset)
            })
      ),
      O.getOrElse(() => '')
    )
    const bps = getAsgardexAffiliateFee(network)
    const applyBps = FP.pipe(
      oApplyBps,
      O.getOrElse(() => false)
    )
    const displayBps = applyBps && bps !== undefined ? `${bps / 100}%` : '0%'
    return !applyBps ? `free` : price ? `${price} (${fee}) ${displayBps}` : fee
  }, [swapFees, affiliateFee.assetAmount, affiliateFee.asset, affiliatePriceValue, oApplyBps, network, sourceAsset])

  // ─── Hook 4: Swap execution ────────────────────────────────────────────────
  const {
    swapState,
    swapParams: oSwapParams,
    cfSwapParams: oCFSwapParams,
    submitSwap: submitSwapTx,
    submitCFSwap: submitCFTx,
    resetSwapState,
    swapStartTime,
    lastTrackedTxHashRef
  } = useSwapExecution({
    swap$,
    swapCF$,
    selectedQuote: oQuoteProtocol,
    sourceAsset,
    amountToSwap,
    sourceWalletBalance: oSourceAssetWB,
    sourceChainBalance: sourceChainAssetAmount,
    swapFees,
    poolAddressThor: oPoolAddressThor,
    poolAddressMaya: oPoolAddressMaya,
    network,
    isSendMax
  })

  // ─── Remaining component logic ─────────────────────────────────────────────

  const setAmountToSwap = useCallback(
    (newAmountToSwap: BaseAmount) => {
      if (eqBaseAmount.equals(newAmountToSwap, amountToSwap)) return
      const cappedAmount = newAmountToSwap.gt(maxAmountToSwap) ? maxAmountToSwap : newAmountToSwap
      if (eqBaseAmount.equals(cappedAmount, amountToSwap)) return
      _setAmountToSwap({ ...cappedAmount })
    },
    [maxAmountToSwap, amountToSwap]
  )

  // Reset amountToSwap decimal when sourceAssetDecimal changes
  useEffect(() => {
    if (amountToSwap.decimal !== sourceAssetDecimal) {
      _setAmountToSwap(convertBaseAmountDecimal(amountToSwap, sourceAssetDecimal))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceAssetDecimal])

  // Fetch new quote when assets change
  useEffect(() => {
    if (amountToSwap.gt(baseAmount(0, amountToSwap.decimal)) && O.isSome(oApplyBps)) {
      fetchSwap(amountToSwap)
    }
  }, [sourceAsset, targetAsset, fetchSwap, amountToSwap, oApplyBps])

  // Input display state
  const [inputDisplayAmount, setInputDisplayAmount] = useState<BaseAmount>(amountToSwap)

  useEffect(() => {
    setInputDisplayAmount(amountToSwap)
  }, [amountToSwap])

  const debouncedSetAmountToSwap = useMemo(
    () =>
      debounce((amount: BaseAmount) => {
        setAmountToSwap(amount)
      }, 500),
    [setAmountToSwap]
  )

  const onInputChange = useCallback(
    (amount: BaseAmount) => {
      if (isSourceUTXO) setIsSendMax(false)
      setInputDisplayAmount(amount)
      debouncedSetAmountToSwap(amount)
    },
    [debouncedSetAmountToSwap, isSourceUTXO]
  )

  useEffect(() => {
    return () => {
      debouncedSetAmountToSwap.cancel()
    }
  }, [debouncedSetAmountToSwap])

  // Aggregator api Fetch Error
  const aggregatorErrors: JSX.Element = useMemo(() => {
    const protocolErrors: string[] = FP.pipe(
      oErrorProtocol,
      O.fold(
        () => [],
        (error) => {
          if (
            !quoteOnly &&
            O.isNone(effectiveRecipientAddress) &&
            (error?.message?.toLowerCase?.()?.includes('memo') || error?.message?.toLowerCase?.()?.includes('parsing'))
          ) {
            return ['Please enter a recipient address to proceed with the swap']
          }
          if (quoteOnly) {
            const errorMsg = error?.message?.toLowerCase?.()
            if (
              errorMsg?.includes('memo') ||
              errorMsg?.includes('parsing') ||
              errorMsg?.includes('undefined') ||
              errorMsg?.includes('recipient') ||
              errorMsg?.includes('address')
            ) {
              return []
            }
          }
          const errorMessage =
            typeof error?.message === 'string' && error.message.trim()
              ? error.message
              : error?.toString?.() || 'An unexpected error occurred during swap estimation'
          return [errorMessage]
        }
      )
    )

    if (protocolErrors.length === 0) return <></>

    return (
      <ErrorLabel>
        {protocolErrors.map((error, index) => (
          <div key={index} className="text-error0 dark:text-error0d">
            {error}
          </div>
        ))}
      </ErrorLabel>
    )
  }, [oErrorProtocol, quoteOnly, effectiveRecipientAddress])

  /**
   * Price of swap result
   */
  const priceSwapResultAmount: AssetWithAmount = useMemo(() => {
    const amount = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => baseAmount(0, THORCHAIN_DECIMAL),
        (quoteProtocol) => {
          if (quoteProtocol.protocol === 'Thorchain') {
            return O.getOrElse(() => baseAmount(0, THORCHAIN_DECIMAL))(
              PoolHelpers.getUSDValue({
                balance: {
                  asset: swapResultAmountMax.asset,
                  amount: swapResultAmountMax.baseAmount
                },
                poolDetails: poolDetailsThor,
                pricePool: pricePoolThor
              })
            )
          } else if (quoteProtocol.protocol === 'Mayachain') {
            return O.getOrElse(() => baseAmount(0, THORCHAIN_DECIMAL))(
              PoolHelpersMaya.getUSDValue({
                balance: {
                  asset: swapResultAmountMax.asset,
                  amount: swapResultAmountMax.baseAmount
                },
                poolDetails: poolDetailsMaya,
                pricePool: pricePoolMaya
              })
            )
          } else if (quoteProtocol.protocol === 'Chainflip') {
            if (
              !swapResultAmountMax?.asset?.symbol ||
              !swapResultAmountMax?.baseAmount ||
              swapResultAmountMax.baseAmount.amount === undefined
            ) {
              return baseAmount(0, THORCHAIN_DECIMAL)
            }
            const assetSymbol = swapResultAmountMax.asset.symbol.toUpperCase()
            const geckoId = GECKO_MAP[assetSymbol]
            const geckoPrice = geckoId ? geckoPriceMap[geckoId]?.usd : 0
            if (swapResultAmountMax.baseAmount && typeof swapResultAmountMax.baseAmount.times === 'function') {
              try {
                return swapResultAmountMax.baseAmount.times(geckoPrice)
              } catch (error) {
                logger.warn('Error calculating Chainflip USD value:', error)
                return baseAmount(0, THORCHAIN_DECIMAL)
              }
            }
            return baseAmount(0, THORCHAIN_DECIMAL)
          }
          return baseAmount(0, THORCHAIN_DECIMAL)
        }
      )
    )
    return { asset: pricePoolThor.asset, amount }
  }, [
    oQuoteProtocol,
    pricePoolThor,
    swapResultAmountMax,
    poolDetailsThor,
    poolDetailsMaya,
    pricePoolMaya,
    geckoPriceMap
  ])

  /**
   * Price sum of swap fees (IN + OUT) and affiliate
   * This stays in Swap.tsx because it depends on priceAmountToSwap and swapSlippage from the quote hook
   */
  const oPriceSwapFees: O.Option<AssetWithAmount> = useMemo(
    () =>
      FP.pipe(
        sequenceSOption({
          inFee: oPriceSwapInFee,
          outFee: O.some(outFeePriceValue),
          affiliateFee: O.some(affiliatePriceValue)
        }),
        O.map(({ inFee, outFee, affiliateFee: affFee }) => {
          const targetDecimals = inFee.baseAmount.decimal
          const inFeeAmount = inFee.baseAmount
          const outFeeAmount = convertBaseAmountDecimal(outFee.baseAmount, targetDecimals)
          const affiliateAmount = convertBaseAmountDecimal(affFee.baseAmount, targetDecimals)
          const slipAmount = priceAmountToSwap.baseAmount.times(swapSlippage / 100)
          const totalAmount = inFeeAmount.plus(outFeeAmount).plus(affiliateAmount).plus(slipAmount)
          return { asset: inFee.asset, amount: totalAmount }
        })
      ),
    [oPriceSwapInFee, outFeePriceValue, affiliatePriceValue, swapSlippage, priceAmountToSwap]
  )

  const priceSwapFeesLabel = useMemo(() => {
    return FP.pipe(
      oPriceSwapFees,
      O.map(({ amount, asset }) =>
        formatAssetAmountCurrency({
          amount: baseToAsset(amount),
          asset,
          decimal: isUSDAsset(asset) ? 2 : 6
        })
      ),
      O.getOrElse(() => noDataString)
    )
  }, [oPriceSwapFees])

  const swapLimit: O.Option<BaseAmount> = useMemo(() => {
    return FP.pipe(
      oQuoteProtocol,
      O.chain((txDetails) =>
        swapResultAmountMax.baseAmount && swapResultAmountMax.baseAmount.gt(zeroTargetBaseAmountMax)
          ? O.some(Utils.getSwapLimit1e8(txDetails.memo))
          : O.none
      )
    )
  }, [oQuoteProtocol, swapResultAmountMax.baseAmount, zeroTargetBaseAmountMax])

  // Check to see slippage greater than tolerance
  const isCausedSlippage = useMemo(() => swapSlippage > slipTolerance, [swapSlippage, slipTolerance])

  const [rateDirection, setRateDirection] = useState(RateDirection.Source)

  const rateLabel = useMemo(() => {
    switch (rateDirection) {
      case RateDirection.Source:
        return `${formatAssetAmountCurrency({
          asset: sourceAsset,
          amount: assetAmount(1),
          decimal: isUSDAsset(sourceAsset) ? 2 : 6,
          trimZeros: true
        })} = ${formatAssetAmountCurrency({
          asset: targetAsset,
          amount: assetAmount(sourceAssetPrice.dividedBy(targetAssetPrice)),
          decimal: isUSDAsset(targetAsset) ? 2 : 6,
          trimZeros: true
        })}`
      case RateDirection.Target:
        return `${formatAssetAmountCurrency({
          asset: targetAsset,
          decimal: isUSDAsset(targetAsset) ? 2 : 6,
          amount: assetAmount(1),
          trimZeros: true
        })} = ${formatAssetAmountCurrency({
          asset: sourceAsset,
          decimal: isUSDAsset(sourceAsset) ? 2 : 6,
          amount: assetAmount(targetAssetPrice.dividedBy(sourceAssetPrice)),
          trimZeros: true
        })}`
    }
  }, [rateDirection, sourceAsset, sourceAssetPrice, targetAsset, targetAssetPrice])

  const needApprovement: O.Option<boolean> = useMemo(
    () => (isEvmChainToken(sourceAsset) ? O.some(isEVMTokenAsset(sourceAsset as TokenAsset)) : O.none),
    [sourceAsset]
  )

  const oApproveParams: O.Option<ApproveParams> = useMemo(() => {
    const oRouterAddress: O.Option<Address> = FP.pipe(
      oQuoteProtocol,
      O.chain((protocol) => {
        switch (protocol.protocol) {
          case 'Thorchain':
            return FP.pipe(
              oPoolAddressThor,
              O.chain(({ router }) => router)
            )
          case 'Mayachain':
            return FP.pipe(
              oPoolAddressMaya,
              O.chain(({ router }) => router)
            )
          default:
            return O.none
        }
      })
    )
    const oTokenAddress: O.Option<string> = getEVMTokenAddressForChain(sourceChain, sourceAsset as TokenAsset)
    const oNeedApprovement: O.Option<boolean> = FP.pipe(
      needApprovement,
      O.map((v) => !!v)
    )
    return FP.pipe(
      sequenceTOption(oNeedApprovement, oTokenAddress, oRouterAddress, oSourceAssetWB),
      O.map(([_, tokenAddress, routerAddress, { walletAddress, walletAccount, walletIndex, walletType, hdMode }]) => ({
        network,
        spenderAddress: routerAddress,
        contractAddress: tokenAddress,
        fromAddress: walletAddress,
        walletAccount,
        walletIndex,
        hdMode,
        walletType
      }))
    )
  }, [
    needApprovement,
    network,
    oPoolAddressMaya,
    oPoolAddressThor,
    oQuoteProtocol,
    oSourceAssetWB,
    sourceAsset,
    sourceChain
  ])

  // Keep a ref to amountToSwap for the onApprovalConfirmed callback
  const amountToSwapRef = useRef(amountToSwap)
  useEffect(() => {
    amountToSwapRef.current = amountToSwap
  }, [amountToSwap])

  const { approveState, resetApproval, submitApproveTx, awaitingConfirmation } = useERC20Approval({
    isApprovedERC20Token$,
    approveERC20Token$,
    oApproveParams,
    network,
    onApprovalConfirmed: () => fetchSwap(amountToSwapRef.current)
  })

  const reloadFeesHandler = useCallback(() => {
    reloadFees({
      inAsset: sourceAsset,
      memo: swapMemo,
      outAsset: targetAsset
    })
  }, [reloadFees, sourceAsset, swapMemo, targetAsset])

  const onInputBlurHandler = useCallback(() => {
    if (amountToSwap.gt(baseAmount(0, amountToSwap.decimal))) {
      fetchSwap(amountToSwap)
    }
  }, [amountToSwap, fetchSwap])

  const prevApproveFee = useRef<O.Option<BaseAmount>>(O.none)

  const [approveFeeRD, approveFeeParamsUpdated] = useObservableState<FeeRD, ApproveParams>((approveFeeParam$) => {
    return approveFeeParam$.pipe(
      RxOp.switchMap((params) =>
        FP.pipe(
          approveFee$(params),
          RxOp.map((fee) => {
            if (RD.isSuccess(fee)) {
              prevApproveFee.current = O.some(fee.value)
            }
            return fee
          })
        )
      )
    )
  }, RD.initial)

  const approveFee: BaseAmount = useMemo(
    () =>
      FP.pipe(
        approveFeeRD,
        RD.toOption,
        O.alt(() => prevApproveFee.current),
        O.getOrElse(() => ZERO_BASE_AMOUNT)
      ),
    [approveFeeRD]
  )

  // Determine if approval is needed based on quote errors
  const needsApproval = useMemo(() => {
    const errors = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => [],
        (quoteSwap) => quoteSwap.errors
      )
    )
    return (
      !quoteOnly && errors.some((error: string) => error.includes('router has not been approved to spend this amount'))
    )
  }, [oQuoteProtocol, quoteOnly])

  const reloadApproveFeesHandler = useCallback(() => {
    FP.pipe(oApproveParams, O.map(reloadApproveFee))
  }, [oApproveParams, reloadApproveFee])

  const setSourceAsset = useCallback(
    async (asset: AnyAsset) => {
      resetApproval()
      await delay(100)
      setAmountToSwap(initialAmountToSwap)
      onChangeAsset({
        source: asset,
        sourceWalletType: appWalletService.getCurrentWalletType(),
        target: targetAsset,
        targetWalletType: oTargetWalletType,
        recipientAddress: effectiveRecipientAddress
      })
    },
    [
      appWalletService,
      initialAmountToSwap,
      effectiveRecipientAddress,
      oTargetWalletType,
      onChangeAsset,
      resetApproval,
      setAmountToSwap,
      targetAsset
    ]
  )

  const setTargetAsset = useCallback(
    async (asset: AnyAsset) => {
      resetApproval()
      await delay(100)
      onChangeAsset({
        source: sourceAsset,
        sourceWalletType,
        target: asset,
        targetWalletType: O.some(appWalletService.getCurrentWalletType()),
        recipientAddress: O.none
      })
      await delay(100)
      resetApproval()
    },
    [appWalletService, onChangeAsset, resetApproval, sourceAsset, sourceWalletType]
  )

  const prevApproveParams = useRef<O.Option<ApproveParams>>(O.none)

  // whenever `oApproveParams` has been updated, `approveFeeParamsUpdated` needs to be called
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | undefined
    FP.pipe(
      oApproveParams,
      O.filter((params) => !eqOApproveParams.equals(O.some(params), prevApproveParams.current)),
      O.map((params) => {
        prevApproveParams.current = O.some(params)
        timerId = setTimeout(() => {
          approveFeeParamsUpdated(params)
        }, 100)
        return true
      })
    )
    return () => clearTimeout(timerId)
  }, [approveFeeParamsUpdated, oApproveParams])

  const minAmountError = useMemo(() => {
    const errors: string[] = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => [],
        (quoteSwap) => quoteSwap.errors
      )
    )
    return errors.some((error) => error.includes('is less than recommended Min Amount:'))
  }, [oQuoteProtocol])

  const belowDustThreshold = useMemo(() => {
    return FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => false,
        (quoteSwap) => quoteSwap.dustThreshold.baseAmount.gte(amountToSwap)
      )
    )
  }, [amountToSwap, oQuoteProtocol])

  // sets the locked asset amount to be the asset pool depth
  useEffect(() => {
    if (lockedWallet || quoteOnly) {
      if (lockedWallet) {
        setQuoteOnly(true)
      }
      const poolDetailMaya = getPoolDetailMaya(poolDetailsMaya, sourceAsset)
      const poolDetailThor = getPoolDetail(poolDetailsThor, sourceAsset)

      if (O.isSome(poolDetailMaya)) {
        const detail = poolDetailMaya.value
        let amount: BaseAmount
        if (isCacaoAsset(sourceAsset)) {
          amount = baseAmount(detail.runeDepth)
        } else {
          amount = baseAmount(detail.assetDepth)
        }
        setLockedAssetAmount(new CryptoAmount(amount, sourceAsset))
      } else if (O.isSome(poolDetailThor)) {
        const detail = poolDetailThor.value
        let amount: BaseAmount
        if (isRuneNativeAsset(sourceAsset)) {
          amount = baseAmount(detail.runeDepth)
        } else {
          amount = baseAmount(detail.assetDepth)
        }
        setLockedAssetAmount(new CryptoAmount(amount, sourceAsset))
      } else {
        setLockedAssetAmount(new CryptoAmount(ONE_RUNE_BASE_AMOUNT, sourceAsset))
      }
    }
  }, [lockedWallet, poolDetailsMaya, poolDetailsThor, quoteOnly, sourceAsset, targetAsset, setQuoteOnly])

  /**
   * Selectable source assets to swap from.
   */
  const selectableSourceAssets: AnyAsset[] = useMemo(
    () =>
      FP.pipe(
        allBalances,
        A.map(({ asset }) => asset),
        A.filter((asset) => !eqAsset.equals(asset, targetAsset)),
        A.filter((asset) => {
          if (isTCSupportedAsset(targetAsset, poolDetailsThor) && isTCSupportedAsset(asset, poolDetailsThor))
            return true
          if (isMayaSupportedAsset(targetAsset, poolDetailsMaya) && isMayaSupportedAsset(asset, poolDetailsMaya))
            return true
          if (isAssetSupported$(asset)) return true
          return false
        }),
        (assets) => unionAssets(assets)(assets)
      ),
    [allBalances, isAssetSupported$, poolDetailsMaya, poolDetailsThor, targetAsset]
  )

  /**
   * Selectable target assets to swap to.
   */
  const selectableTargetAssets = useMemo(
    (): AnyAsset[] =>
      FP.pipe(
        poolAssets,
        A.filter((asset) => {
          if (isTCSupportedAsset(sourceAsset, poolDetailsThor) && isTCSupportedAsset(asset, poolDetailsThor))
            return true
          if (isMayaSupportedAsset(sourceAsset, poolDetailsMaya) && isMayaSupportedAsset(asset, poolDetailsMaya))
            return true
          if (isAssetSupported$(asset)) return true
          return false
        }),
        A.chain((asset) => {
          if (isRuneNativeAsset(asset) || isCacaoAsset(asset)) return [asset]
          const assets: AnyAsset[] = [asset]
          if (isTCSupportedAsset(asset, poolDetailsThor) && isTCSupportedAsset(sourceAsset, poolDetailsThor)) {
            assets.push({ ...asset, type: AssetType.SECURED } as SecuredAsset)
          }
          if (isMayaSupportedAsset(asset, poolDetailsMaya) && isMayaSupportedAsset(sourceAsset, poolDetailsMaya)) {
            assets.push({ ...asset, type: AssetType.SYNTH, synth: true } as SynthAsset)
          }
          return assets
        }),
        A.filter((asset) => !eqAsset.equals(asset, sourceAsset)),
        (assets) => unionAssets(assets)(assets)
      ),
    [isAssetSupported$, poolAssets, poolDetailsMaya, poolDetailsThor, sourceAsset]
  )

  // Get vault type for Vultisig wallets
  const vaultType: VaultType = useMemo(() => {
    if (appWalletState && isVultisigMode(appWalletState) && appWalletState.activeVault) {
      return appWalletState.activeVault.type
    }
    return 'fast'
  }, [appWalletState])

  // Password validation for Vultisig
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

  // ─── Confirmation modals (all 3 wallet types) ─────────────────────────────
  const {
    showVultisigModal,
    onSubmit,
    onApprove,
    renderModals: renderConfirmationModals
  } = useSwapConfirmationModals({
    useSourceAssetLedger,
    useSourceAssetVultisig,
    sourceAsset,
    sourceChain,
    sourceWalletType,
    network,
    oSwapParams,
    oCFSwapParams,
    submitSwapTx,
    submitCFTx,
    submitApproveTx,
    validatePassword$,
    validatePasswordForVultisig,
    vaultType,
    approveState,
    swapState,
    getActiveVaultId: appWalletService.getActiveVaultId
  })

  const setAmountToSwapFromPercentValue = useCallback(
    (percents: number) => {
      if (isSourceUTXO) setIsSendMax(percents === 100)
      const amountFromPercentage = maxAmountToSwap.amount().multipliedBy(percents / 100)
      const newAmount = baseAmount(amountFromPercentage, maxAmountToSwap.decimal)
      setAmountToSwap(newAmount)
      return newAmount
    },
    [maxAmountToSwap, setAmountToSwap, isSourceUTXO]
  )

  const quoteOnlyButton = () => {
    setQuoteOnly(!quoteOnly)
    setAmountToSwap(initialAmountToSwap)
    resetQuote()
  }

  const swapSettingsSection = useMemo(
    () => (
      <SwapSettings
        activeMode={activeMode}
        streamingInterval={streamingInterval}
        streamingQuantity={streamingQuantity}
        onModeChange={setMode}
        onQuantityChange={setQuantity}
        onReset={resetToDefault}
      />
    ),
    [activeMode, streamingInterval, streamingQuantity, setMode, setQuantity, resetToDefault]
  )

  const swapTxSource = useMemo(() => ({ asset: sourceAsset, amount: amountToSwap }), [sourceAsset, amountToSwap])
  const swapTxTarget = useMemo(
    () => ({ asset: targetAsset, amount: swapResultAmountMax.baseAmount }),
    [targetAsset, swapResultAmountMax.baseAmount]
  )
  const onCloseTxModal = useCallback(() => {
    resetSwapState()
  }, [resetSwapState])

  const onFinishTxModal = useCallback(() => {
    resetSwapState()
    reloadBalances()
    setAmountToSwap(initialAmountToSwap)
    resetQuote()
    if (isEvmChainToken(targetAsset)) {
      addAsset(targetAsset as TokenAsset)
    }
  }, [resetSwapState, reloadBalances, setAmountToSwap, initialAmountToSwap, resetQuote, targetAsset])

  const sourceChainFeeError: boolean = useMemo(() => {
    if (isZeroAmountToSwap) return false
    const {
      inFee: { amount: inFeeAmount }
    } = swapFees
    return inFeeAmount.gt(sourceChainAssetAmount)
  }, [isZeroAmountToSwap, swapFees, sourceChainAssetAmount])

  const quoteError: JSX.Element = useMemo(() => {
    const swapErrors: string[] = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => [],
        (quoteSwap) => quoteSwap.errors
      )
    )

    const filteredErrors = quoteOnly
      ? swapErrors.filter((error) => {
          const errorLower = error.toLowerCase()
          const isBalanceError =
            errorLower.includes('insufficient') ||
            errorLower.includes('not enough') ||
            errorLower.includes('exceed') ||
            errorLower.includes('balance') ||
            errorLower.includes('funds')
          const isFeeError =
            errorLower.includes('fee') ||
            errorLower.includes('outbound') ||
            errorLower.includes('inbound') ||
            errorLower.includes('gas') ||
            errorLower.includes('router has not been approved')
          const isMemoError =
            errorLower.includes('memo') || errorLower.includes('parsing') || errorLower.includes('undefined')
          return !isBalanceError && !isFeeError && !isMemoError
        })
      : swapErrors

    if (filteredErrors.length === 0) return <></>

    return (
      <ErrorLabel>
        {filteredErrors.map((error, index) => {
          if (error.includes('is less than recommended Min Amount')) {
            const matches = error.match(/amount in: (\d+) is less than recommended Min Amount: (\d+)/)
            if (matches) {
              const [_, amountIn, minAmount] = matches
              const formattedAmountIn = new CryptoAmount(baseAmount(amountIn), sourceAsset).formatedAssetString()
              const formattedMinAmount = new CryptoAmount(baseAmount(minAmount), sourceAsset).formatedAssetString()
              return (
                <div key={index}>
                  {`Error: Amount ${formattedAmountIn} is less than the recommended minimum amount: ${formattedMinAmount}`}
                </div>
              )
            }
          }
          if (error.includes('failed to simulate swap') && error.includes('less than price limit')) {
            return (
              <div key={index}>
                {`Price has moved unfavorably. Please increase your slippage tolerance or adjust your input amount to complete this swap.`}
              </div>
            )
          }
          return <div key={index}>{error}</div>
        })}
        {!quoteOnly && belowDustThreshold && <>{`Amount to swap is Below DustThreshold`}</>}
      </ErrorLabel>
    )
  }, [belowDustThreshold, oQuoteProtocol, sourceAsset, quoteOnly])

  const sourceChainFeeErrorLabel: JSX.Element = useMemo(() => {
    if (!sourceChainFeeError || quoteOnly) return <></>
    const {
      inFee: { asset: inFeeAsset, amount: inFeeAmount }
    } = swapFees
    return (
      <ErrorLabel>
        {intl.formatMessage(
          { id: 'swap.errors.amount.balanceShouldCoverChainFee' },
          {
            balance: formatAssetAmountCurrency({
              asset: sourceChainAsset,
              amount: baseToAsset(sourceChainAssetAmount),
              trimZeros: true
            }),
            fee: formatAssetAmountCurrency({
              asset: inFeeAsset,
              trimZeros: true,
              amount: baseToAsset(inFeeAmount)
            })
          }
        )}
      </ErrorLabel>
    )
  }, [sourceChainFeeError, swapFees, intl, sourceChainAsset, sourceChainAssetAmount, quoteOnly])

  // Label: Min amount to swap
  const swapMinResultLabel = useMemo(() => {
    const amount: BaseAmount = FP.pipe(
      swapLimit,
      O.fold(
        () => baseAmount(0, targetAssetDecimal),
        (limitAmount) => convertBaseAmountDecimal(limitAmount, targetAssetDecimal)
      )
    )
    return `${formatAssetAmountCurrency({
      asset: targetAsset,
      amount: baseToAsset(amount),
      trimZeros: true
    })}`
  }, [swapLimit, targetAsset, targetAssetDecimal])

  const uiApproveFeesRD: UIFeesRD = useMemo(
    () =>
      FP.pipe(
        approveFeeRD,
        RD.map((fee) => [{ asset: sourceChainAsset, amount: fee }])
      ),
    [approveFeeRD, sourceChainAsset]
  )

  const isApproveFeeError = useMemo(() => {
    if (O.isNone(needApprovement)) return false
    return sourceChainAssetAmount.lt(approveFee)
  }, [needApprovement, sourceChainAssetAmount, approveFee])

  const renderApproveFeeError: JSX.Element = useMemo(() => {
    if (!isApproveFeeError || O.isNone(oSourceAssetWB) || sourceBalanceLoading) return <></>
    return (
      <ErrorLabel>
        {intl.formatMessage(
          { id: 'swap.errors.amount.balanceShouldCoverChainFee' },
          {
            balance: formatAssetAmountCurrency({
              asset: sourceChainAsset,
              amount: baseToAsset(sourceChainAssetAmount),
              trimZeros: true
            }),
            fee: formatAssetAmountCurrency({
              asset: sourceChainAsset,
              trimZeros: true,
              amount: baseToAsset(approveFee)
            })
          }
        )}
      </ErrorLabel>
    )
  }, [
    isApproveFeeError,
    oSourceAssetWB,
    sourceBalanceLoading,
    intl,
    sourceChainAsset,
    sourceChainAssetAmount,
    approveFee
  ])

  const renderApproveError = useMemo(
    () =>
      FP.pipe(
        approveState,
        RD.fold(
          () => <></>,
          () => <></>,
          (error) => <ErrorLabel>{error.msg}</ErrorLabel>,
          () => <></>
        )
      ),
    [approveState]
  )

  const isApproved = useMemo(() => {
    if (O.isNone(needApprovement)) return true
    if (awaitingConfirmation) return false
    return !needsApproval
  }, [needApprovement, needsApproval, awaitingConfirmation])

  const priceApproveFee: CryptoAmount = useMemo(() => {
    const assetAmt = isApproved
      ? new CryptoAmount(approveFee, swapFees.inFee.asset)
      : new CryptoAmount(baseAmount(0), swapFees.inFee.asset)
    const result = FP.pipe(
      isChainOfThor(assetAmt.asset.chain)
        ? PoolHelpers.getUSDValue({
            balance: { asset: assetAmt.asset, amount: assetAmt.baseAmount },
            poolDetails: poolDetailsThor,
            pricePool: pricePoolThor
          })
        : PoolHelpersMaya.getUSDValue({
            balance: { asset: assetAmt.asset, amount: assetAmt.baseAmount },
            poolDetails: poolDetailsMaya,
            pricePool: pricePoolMaya
          }),
      O.getOrElse(() => baseAmount(0, amountToSwap.decimal))
    )
    return new CryptoAmount(result, pricePoolThor.asset)
  }, [
    isApproved,
    approveFee,
    swapFees.inFee.asset,
    poolDetailsThor,
    pricePoolThor,
    poolDetailsMaya,
    pricePoolMaya,
    amountToSwap.decimal
  ])

  const priceApproveFeeLabel = useMemo(
    () =>
      FP.pipe(
        approveFeeRD,
        RD.fold(
          () => '',
          () => '',
          () => noDataString,
          (_) =>
            FP.pipe(
              O.some(approveFee),
              O.fold(
                () => '',
                (outFee: BaseAmount) => {
                  const fee = formatAssetAmountCurrency({
                    amount: baseToAsset(outFee),
                    asset: sourceChainAsset,
                    decimal: isUSDAsset(sourceChainAsset) ? 2 : 6,
                    trimZeros: !isUSDAsset(sourceChainAsset)
                  })
                  const price = FP.pipe(
                    O.some(priceApproveFee),
                    O.map((cryptoAmount: CryptoAmount) =>
                      eqAsset.equals(sourceAsset, cryptoAmount.asset)
                        ? ''
                        : formatAssetAmountCurrency({
                            amount: cryptoAmount.assetAmount,
                            asset: cryptoAmount.asset,
                            decimal: isUSDAsset(cryptoAmount.asset) ? 2 : 6,
                            trimZeros: !isUSDAsset(cryptoAmount.asset)
                          })
                    ),
                    O.getOrElse(() => '')
                  )
                  return price ? `${price} (${fee})` : fee
                }
              )
            )
        )
      ),
    [approveFeeRD, approveFee, sourceChainAsset, priceApproveFee, sourceAsset]
  )

  useEffect(() => {
    if (O.isSome(prevSourceAsset.current) && !eqOAsset.equals(prevSourceAsset.current, O.some(sourceAsset))) {
      reloadFees({
        inAsset: sourceAsset,
        memo: swapMemo,
        outAsset: targetAsset
      })
      resetApproval()
    }
    prevSourceAsset.current = O.some(sourceAsset)
    if (!eqOAsset.equals(prevTargetAsset.current, O.some(targetAsset))) {
      prevTargetAsset.current = O.some(targetAsset)
    }
  }, [reloadFees, resetApproval, resetSwapState, sourceAsset, targetAsset, swapMemo])

  // Track successful swap transactions
  useEffect(() => {
    const { swapTx } = swapState
    if (RD.isSuccess(swapTx)) {
      const txHash = swapTx.value
      FP.pipe(
        oQuoteProtocol,
        O.map((quoteProtocol) => {
          if (lastTrackedTxHashRef.current !== txHash) {
            if (quoteProtocol.protocol === 'Thorchain') {
              addSwapToTracker(transactionTrackingService, txHash, {
                sourceAsset: assetToString(sourceAsset),
                targetAsset: assetToString(targetAsset),
                amount: amountToSwap.amount().toString()
              })
              lastTrackedTxHashRef.current = txHash
            } else if (quoteProtocol.protocol === 'Mayachain') {
              addSwapToTracker(mayaTransactionTrackingService, txHash, {
                sourceAsset: assetToString(sourceAsset),
                targetAsset: assetToString(targetAsset),
                amount: amountToSwap.amount().toString()
              })
              lastTrackedTxHashRef.current = txHash
            } else if (quoteProtocol.protocol === 'Chainflip' && quoteProtocol.depositChannelId) {
              addChainflipSwapToTrackerFromQuote(chainflipTransactionTrackingService, quoteProtocol.depositChannelId, {
                srcAsset: { chain: sourceAsset.chain, symbol: sourceAsset.symbol },
                destAsset: { chain: targetAsset.chain, symbol: targetAsset.symbol },
                depositAmount: amountToSwap.amount().toString()
              })
              lastTrackedTxHashRef.current = txHash
            }
          }
        })
      )
    }
  }, [
    swapState,
    oQuoteProtocol,
    transactionTrackingService,
    mayaTransactionTrackingService,
    sourceAsset,
    targetAsset,
    amountToSwap,
    chainflipTransactionTrackingService,
    lastTrackedTxHashRef
  ])

  const onSwitchAssets = useCallback(async () => {
    await delay(100)
    setAmountToSwap(initialAmountToSwap)
    resetQuote()
    const walletType = FP.pipe(
      oTargetWalletType,
      O.getOrElse<WalletType>(() => appWalletService.getCurrentWalletType())
    )
    onChangeAsset({
      source: targetAsset,
      sourceWalletType: walletType,
      target: sourceAsset,
      targetWalletType: O.some(sourceWalletType),
      recipientAddress: oSourceWalletAddress
    })
  }, [
    appWalletService,
    initialAmountToSwap,
    oSourceWalletAddress,
    oTargetWalletType,
    onChangeAsset,
    resetQuote,
    setAmountToSwap,
    sourceAsset,
    sourceWalletType,
    targetAsset
  ])

  const disableSubmit: boolean = useMemo(
    () =>
      network !== Network.Stagenet &&
      (lockedWallet ||
        quoteOnly ||
        isZeroAmountToSwap ||
        sourceBalanceLoading ||
        sourceChainFeeError ||
        RD.isPending(swapFeesRD) ||
        RD.isPending(approveState) ||
        awaitingConfirmation ||
        isCausedSlippage ||
        !swapResultAmountMax.baseAmount ||
        swapResultAmountMax.baseAmount.lte(zeroTargetBaseAmountMax) ||
        O.isNone(effectiveRecipientAddress) ||
        !canSwap ||
        customAddressEditActive ||
        isTargetChainDisabled ||
        isSourceChainDisabled ||
        belowDustThreshold),
    [
      network,
      lockedWallet,
      quoteOnly,
      isZeroAmountToSwap,
      sourceBalanceLoading,
      sourceChainFeeError,
      swapFeesRD,
      approveState,
      awaitingConfirmation,
      isCausedSlippage,
      swapResultAmountMax.baseAmount,
      zeroTargetBaseAmountMax,
      effectiveRecipientAddress,
      canSwap,
      customAddressEditActive,
      isTargetChainDisabled,
      isSourceChainDisabled,
      belowDustThreshold
    ]
  )

  const disableSubmitApprove = useMemo(
    () => isApproveFeeError || sourceBalanceLoading || O.isNone(oApproveParams) || RD.isPending(approveState),
    [isApproveFeeError, sourceBalanceLoading, oApproveParams, approveState]
  )

  const onChangeRecipientAddress = useCallback(
    (address: Address) => {
      onChangeAsset({
        source: sourceAsset,
        target: targetAsset,
        sourceWalletType,
        targetWalletType: getTargetWalletTypeByAddress(address),
        recipientAddress: O.some(address)
      })
    },
    [getTargetWalletTypeByAddress, onChangeAsset, sourceAsset, targetAsset, sourceWalletType]
  )

  const onChangeEditableRecipientAddress = useCallback(
    (address: Address) => {
      const walletType = getTargetWalletTypeByAddress(address)
      setTargetWalletType(walletType)
    },
    [getTargetWalletTypeByAddress, setTargetWalletType]
  )

  const onClickUseSourceAssetLedger = useCallback(
    (useLedger: boolean) => {
      setAmountToSwap(initialAmountToSwap)
      onChangeAsset({
        source: sourceAsset,
        target: targetAsset,
        sourceWalletType: useLedger ? WalletType.Ledger : appWalletService.getCurrentWalletType(),
        targetWalletType: oTargetWalletType,
        recipientAddress: effectiveRecipientAddress
      })
    },
    [
      initialAmountToSwap,
      effectiveRecipientAddress,
      oTargetWalletType,
      onChangeAsset,
      appWalletService,
      setAmountToSwap,
      sourceAsset,
      targetAsset
    ]
  )

  const onClickUseTargetAssetLedger = useCallback(
    (useLedger: boolean) => {
      onChangeAsset({
        source: sourceAsset,
        target: targetAsset,
        sourceWalletType,
        targetWalletType: O.some(useLedger ? WalletType.Ledger : appWalletService.getCurrentWalletType()),
        recipientAddress: useLedger ? oTargetLedgerAddress : oTargetKeystoreAddress
      })
    },
    [
      oTargetLedgerAddress,
      oTargetKeystoreAddress,
      onChangeAsset,
      sourceAsset,
      sourceWalletType,
      targetAsset,
      appWalletService
    ]
  )

  const memoTitle = useMemo(
    () =>
      FP.pipe(
        oSwapParams,
        O.map(({ memo }) => memo),
        O.getOrElse(() => emptyString),
        (memo: string) => (
          <CopyLabel
            className="!font-main-bold text-[14px] text-gray2 dark:text-gray2d"
            label={intl.formatMessage({ id: 'common.memo' })}
            textToCopy={memo}
          />
        )
      ),
    [intl, oSwapParams]
  )

  const memoLabel = useMemo(
    () =>
      FP.pipe(
        oSwapParams,
        O.map(({ memo }) => (
          <Tooltip title={memo} key="tooltip-memo">
            {memo}
          </Tooltip>
        )),
        O.toNullable
      ),
    [oSwapParams]
  )

  const [showDetails, setShowDetails] = useState<boolean>(false)
  const handleToggleDetails = useCallback(() => {
    setShowDetails((current) => !current)
  }, [])
  const handleToggleRateDirection = useCallback(() => {
    setRateDirection((current) => (current === RateDirection.Source ? RateDirection.Target : RateDirection.Source))
  }, [])

  // Rebuild openExplorer with current quote protocol
  const openExplorerResolved = useOpenExplorerTxUrl(
    FP.pipe(
      oQuoteProtocol,
      O.chain((quoteSwap) =>
        quoteSwap.protocol === 'Thorchain'
          ? O.some(THORChain)
          : quoteSwap.protocol === 'Mayachain'
            ? O.some(MAYAChain)
            : quoteSwap.protocol === 'Chainflip'
              ? O.some(sourceChain)
              : O.none
      )
    )
  )

  return (
    <div className="my-20px flex w-full max-w-[500px] flex-col justify-between">
      <div>
        {/* Note: Input value is shown as AssetAmount */}
        <div className="flex flex-wrap">
          <div className="mb-3 flex w-full items-center justify-between">
            <FlatButton
              className="rounded-full group-hover:rotate-180 hover:shadow-full dark:hover:shadow-fulld"
              size="small"
              color={quoteOnly ? 'warning' : 'primary'}
              onClick={quoteOnlyButton}>
              {quoteOnly
                ? intl.formatMessage({ id: 'swap.previewOnly' })
                : intl.formatMessage({ id: 'swap.previewAndSwap' })}
            </FlatButton>
            <ProviderModal />
          </div>
          {disabledChains.length > 0 ? (
            <div className="text-12 text-gray2 dark:border-gray1d dark:text-gray2d">
              <div className="flex pb-4">
                {(isTargetChainDisabled || isSourceChainDisabled) && (
                  <>
                    <div className="rounded text-warning0 dark:text-warning0d">
                      {intl.formatMessage(
                        { id: 'common.chainDisabled' },
                        { chain: isTargetChainDisabled ? targetAsset.chain : sourceAsset.chain }
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <></>
          )}
        </div>
        <AssetInput
          className="w-full"
          title={intl.formatMessage({ id: 'swap.input' })}
          amount={useMemo(
            () => ({
              amount: inputDisplayAmount,
              asset: sourceAsset
            }),
            [inputDisplayAmount, sourceAsset]
          )}
          priceAmount={{ asset: priceAmountToSwap.asset, amount: priceAmountToSwap.baseAmount }}
          assets={selectableSourceAssets}
          walletBalance={sourceAssetAmountNative}
          network={network}
          hasAmountShortcut
          onChangeAsset={setSourceAsset}
          onChange={onInputChange}
          onChangePercent={setAmountToSwapFromPercentValue}
          onBlur={onInputBlurHandler}
          showError={minAmountError || belowDustThreshold}
          hasLedger={hasSourceAssetLedger}
          useLedger={useSourceAssetLedger}
          useLedgerHandler={onClickUseSourceAssetLedger}
        />
        <div className="relative mt-1 flex flex-col">
          <AssetInput
            className="w-full md:w-auto"
            title={intl.formatMessage({ id: 'swap.output' })}
            amount={{
              amount: swapResultAmountMax.baseAmount,
              asset: targetAsset
            }}
            priceAmount={priceSwapResultAmount}
            onChangeAsset={setTargetAsset}
            assets={selectableTargetAssets}
            network={network}
            asLabel
            useLedger={useTargetAssetLedger}
            useLedgerHandler={onClickUseTargetAssetLedger}
            hasLedger={hasTargetAssetLedger}
            synthDisabled
          />
          <div className="absolute -top-[32px] left-[calc(50%-30px)] flex flex-col justify-center">
            <div className="w-60px h-60px">
              <BaseButton
                size="small"
                onClick={onSwitchAssets}
                className="group rounded-full border border-solid border-turquoise bg-bg0 !p-10px hover:rotate-180 hover:shadow-full dark:bg-bg0d dark:hover:shadow-fulld">
                <ArrowsUpDownIcon className="ease h-[40px] w-[40px] text-turquoise" />
              </BaseButton>
            </div>
          </div>
        </div>
        <div className="mt-1 space-y-1">
          {isFetchingEstimate ? (
            <Spin
              className="min-h-24 rounded-lg border border-gray0 dark:border-gray0d"
              spinning={isFetchingEstimate}
              tip={intl.formatMessage({ id: 'common.loading' })}
            />
          ) : O.isNone(oQuoteProcotols) ? (
            <></>
          ) : (
            <SwapRoute
              isBoostable={sourceAsset.chain === BTCChain}
              targetAsset={targetAsset.ticker}
              quote={oQuoteProtocol}
              quotes={oQuoteProcotols}
              onSelectQuote={handleSelectQuote}
              quoteOnly={quoteOnly}
            />
          )}
          {FP.pipe(
            oQuoteProtocol,
            O.fold(
              () => swapSettingsSection,
              (quoteSwap) => (quoteSwap.protocol === 'Chainflip' ? <></> : swapSettingsSection)
            )
          )}
          <SwapDetailsPanel
            lockedWallet={lockedWallet}
            showDetails={showDetails}
            onToggleDetails={handleToggleDetails}
            rateLabel={rateLabel}
            onToggleRateDirection={handleToggleRateDirection}
            swapFeesRD={swapFeesRD}
            onReloadFees={reloadFeesHandler}
            priceSwapFeesLabel={priceSwapFeesLabel}
            needApprovement={needApprovement}
            priceApproveFeeLabel={priceApproveFeeLabel}
            priceSwapInFeeLabel={priceSwapInFeeLabel}
            priceSwapOutFeeLabel={priceSwapOutFeeLabel}
            priceAffiliateFeeLabel={priceAffiliateFeeLabel}
            priceAmountToSwap={priceAmountToSwap}
            swapSlippage={swapSlippage}
            slipTolerance={slipTolerance}
            changeSlipTolerance={changeSlipTolerance}
            swapMinResultLabel={swapMinResultLabel}
            streamingInterval={streamingInterval}
            streamingQuantity={streamingQuantity}
            isCausedSlippage={isCausedSlippage}
            sourceChain={sourceChain}
            targetAsset={targetAsset}
            oQuoteProtocol={oQuoteProtocol}
            oSourceWalletAddress={oSourceWalletAddress}
            effectiveRecipientAddress={effectiveRecipientAddress}
            hidePrivateData={hidePrivateData}
            hiddenString={hiddenString}
            noDataString={noDataString}
            oSwapParams={oSwapParams}
            walletBalancesLoading={walletBalancesLoading}
            reloadBalances={reloadBalances}
            sourceAssetAmountNative={sourceAssetAmountNative}
            sourceAsset={sourceAsset}
            memoTitle={memoTitle}
            memoLabel={memoLabel}
          />
          {!lockedWallet && (
            <RecipientAddressSection
              isStandaloneLedger={!!(appWalletState && isStandaloneLedgerMode(appWalletState))}
              targetAsset={targetAsset}
              targetChain={targetChain}
              network={network}
              effectiveRecipientAddress={effectiveRecipientAddress}
              standaloneLedgerTargetAddress={standaloneLedgerTargetAddress}
              setStandaloneLedgerTargetAddress={setStandaloneLedgerTargetAddress}
              customAddressEditActive={customAddressEditActive}
              setCustomAddressEditActive={setCustomAddressEditActive}
              targetHDMode={targetHDMode}
              setTargetHDMode={setTargetHDMode}
              targetWalletAccount={targetWalletAccount}
              setTargetWalletAccount={setTargetWalletAccount}
              targetWalletIndex={targetWalletIndex}
              setTargetWalletIndex={setTargetWalletIndex}
              fetchStandaloneLedgerTargetAddress={fetchStandaloneLedgerTargetAddress}
              isFetchingStandaloneLedgerAddress={isFetchingStandaloneLedgerAddress}
              targetWalletType={oTargetWalletType}
              onChangeRecipientAddress={onChangeRecipientAddress}
              onChangeEditableRecipientAddress={onChangeEditableRecipientAddress}
              addressValidator={addressValidator}
              hidePrivateData={hidePrivateData}
            />
          )}
          {!lockedWallet && O.isSome(oQuoteProtocol) && (
            <div>{<SwapExpiryProgressBar oQuoteProtocol={oQuoteProtocol} swapExpiry={swapExpiry} />}</div>
          )}
        </div>
      </div>

      {(sourceBalanceLoading || isFetchingEstimate) && (
        <Spin
          className="w-full pt-10px"
          tip={
            isFetchingEstimate
              ? intl.formatMessage({ id: 'common.loading' })
              : sourceBalanceLoading
                ? intl.formatMessage({ id: 'common.balance.loading' })
                : undefined
          }
        />
      )}
      <div className="flex flex-col items-center justify-center">
        <SwapSubmitSection
          lockedWallet={lockedWallet}
          isKeystoreWallet={!!(appWalletState && isKeystoreMode(appWalletState))}
          keystore={keystore}
          isApproved={isApproved}
          disableSubmit={disableSubmit}
          onSubmit={onSubmit}
          disableSubmitApprove={disableSubmitApprove}
          awaitingConfirmation={awaitingConfirmation}
          approveState={approveState}
          onApprove={onApprove}
          uiApproveFeesRD={uiApproveFeesRD}
          reloadApproveFeesHandler={reloadApproveFeesHandler}
          sourceChainFeeErrorLabel={sourceChainFeeErrorLabel}
          quoteError={quoteError}
          aggregatorErrors={aggregatorErrors}
          renderApproveFeeError={renderApproveFeeError}
          renderApproveError={renderApproveError}
          importWalletHandler={importWalletHandler}
        />
      </div>
      {renderConfirmationModals}
      {!(useSourceAssetVultisig && vaultType === 'secure' && showVultisigModal !== ModalState.None) && (
        <SwapTxModal
          swapState={swapState}
          swapStartTime={swapStartTime}
          sourceChain={sourceChain}
          source={swapTxSource}
          target={swapTxTarget}
          oQuoteProtocol={oQuoteProtocol}
          goToTransaction={openExplorerResolved.openExplorerTxUrl}
          getExplorerTxUrl={openExplorerResolved.getExplorerTxUrl}
          onCloseTxModal={onCloseTxModal}
          onFinishTxModal={onFinishTxModal}
        />
      )}
    </div>
  )
}
