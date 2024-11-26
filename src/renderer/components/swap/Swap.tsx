import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import {
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  ArrowsUpDownIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon
} from '@heroicons/react/24/outline'
import { QuoteSwap as QuoteSwapProtocol } from '@xchainjs/xchain-aggregator'
import { Network } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { MayaChain, MayachainQuery } from '@xchainjs/xchain-mayachain-query'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import { InboundDetail, ThorchainQuery } from '@xchainjs/xchain-thorchain-query'
import {
  Asset,
  baseToAsset,
  BaseAmount,
  baseAmount,
  formatAssetAmountCurrency,
  delay,
  assetAmount,
  Address,
  isSynthAsset,
  CryptoAmount,
  AssetType,
  AnyAsset,
  TokenAsset,
  SynthAsset,
  isTokenAsset,
  isTradeAsset
} from '@xchainjs/xchain-util'
import { Row } from 'antd'
import clsx from 'clsx'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as RxOp from 'rxjs/operators'

import { Dex, mayaDetails, thorDetails } from '../../../shared/api/types'
import { ASGARDEX_AFFILIATE_FEE_MIN, getAsgardexAffiliateFee, getAsgardexThorname } from '../../../shared/const'
import { ONE_RUNE_BASE_AMOUNT } from '../../../shared/mock/amount'
import {
  chainToString,
  DEFAULT_ENABLED_CHAINS,
  DefaultChainAttributes,
  EnabledChain
} from '../../../shared/utils/chain'
import { isLedgerWallet } from '../../../shared/utils/guard'
import { WalletType } from '../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../const'
import {
  max1e8BaseAmount,
  convertBaseAmountDecimal,
  to1e8BaseAmount,
  THORCHAIN_DECIMAL,
  isUSDAsset,
  isRuneNativeAsset,
  isCacaoAsset,
  isEVMTokenAsset,
  getEVMTokenAddressForChain
} from '../../helpers/assetHelper'
import { getChainAsset, isBchChain, isBtcChain, isDogeChain, isLtcChain } from '../../helpers/chainHelper'
import { isEvmChain, isEvmToken } from '../../helpers/evmHelper'
import { unionAssets } from '../../helpers/fp/array'
import { eqAsset, eqBaseAmount, eqOAsset, eqOApproveParams, eqAddress } from '../../helpers/fp/eq'
import { sequenceSOption, sequenceTOption } from '../../helpers/fpHelpers'
import { getSwapMemo, updateMemo } from '../../helpers/memoHelper'
import * as PoolHelpers from '../../helpers/poolHelper'
import { isPoolDetails } from '../../helpers/poolHelper'
import * as PoolHelpersMaya from '../../helpers/poolHelperMaya'
import { LiveData } from '../../helpers/rx/liveData'
import { emptyString, hiddenString, loadingString, noDataString } from '../../helpers/stringHelper'
import { formatSwapTime } from '../../helpers/timeHelper'
import {
  filterWalletBalancesByAssetsForDex,
  getWalletBalanceByAssetAndWalletType,
  getWalletTypeLabel,
  hasLedgerInBalancesByAsset
} from '../../helpers/walletHelper'
import { usePricePool } from '../../hooks/usePricePool'
import { usePricePoolMaya } from '../../hooks/usePricePoolMaya'
import { useSubscriptionState } from '../../hooks/useSubscriptionState'
import { ChangeSlipToleranceHandler } from '../../services/app/types'
import { INITIAL_SWAP_STATE } from '../../services/chain/const'
import { getZeroSwapFees } from '../../services/chain/fees/swap'
import {
  SwapTxParams,
  SwapFeesHandler,
  ReloadSwapFeesHandler,
  SwapFeesRD,
  SwapFees,
  FeeRD,
  SwapHandler,
  SwapTxState
} from '../../services/chain/types'
import { AddressValidationAsync, GetExplorerTxUrl, OpenExplorerTxUrl } from '../../services/clients'
import {
  ApproveFeeHandler,
  ApproveParams,
  IsApprovedRD,
  IsApproveParams,
  LoadApproveFeeHandler
} from '../../services/evm/types'
import { PoolDetails as PoolDetailsMaya } from '../../services/mayaMigard/types'
import { getPoolDetail as getPoolDetailMaya } from '../../services/mayaMigard/utils'
import { PoolAddress, PoolDetails, PoolsDataMap } from '../../services/midgard/types'
import { getPoolDetail } from '../../services/midgard/utils'
import { userChains$ } from '../../services/storage/userChains'
import { addAsset } from '../../services/storage/userChainTokens'
import {
  ApiError,
  KeystoreState,
  TxHashLD,
  TxHashRD,
  ValidatePasswordHandler,
  BalancesState,
  WalletBalance,
  WalletBalances
} from '../../services/wallet/types'
import { hasImportedKeystore, isLocked } from '../../services/wallet/util'
import { useAggregator } from '../../store/aggregator/hooks'
import { AssetWithAmount, SlipTolerance } from '../../types/asgardex'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../modal/confirmation'
import { TxModal } from '../modal/tx'
import { SwapAssets } from '../modal/tx/extra'
import { LoadingView } from '../shared/loading'
import { AssetInput } from '../uielements/assets/assetInput'
import { BaseButton, FlatButton, ViewTxButton } from '../uielements/button'
import { Collapse } from '../uielements/collapse'
import { Tooltip, TooltipAddress, WalletTypeLabel } from '../uielements/common/Common.styles'
import { Fees, UIFeesRD } from '../uielements/fees'
import { InfoIcon } from '../uielements/info'
import { CopyLabel } from '../uielements/label'
import { ProgressBar } from '../uielements/progressBar'
import { Slider } from '../uielements/slider'
import { EditableAddress } from './EditableAddress'
import { SelectableSlipTolerance } from './SelectableSlipTolerance'
import { SwapAsset } from './Swap.types'
import * as Utils from './Swap.utils'

const ErrorLabel: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }): JSX.Element => (
  <div
    className={clsx('mb-[14px] text-center font-main text-[12px] uppercase text-error0 dark:text-error0d', className)}>
    {children}
  </div>
)

export type SwapProps = {
  thorchainQuery: ThorchainQuery
  mayachainQuery: MayachainQuery
  keystore: KeystoreState
  poolAssets: AnyAsset[]
  assets: {
    source: SwapAsset
    target: SwapAsset
  }
  sourceKeystoreAddress: O.Option<Address>
  sourceLedgerAddress: O.Option<Address>
  sourceWalletType: WalletType
  targetWalletType: O.Option<WalletType>
  poolAddress: O.Option<PoolAddress>
  swap$: SwapHandler
  reloadTxStatus: FP.Lazy<void>
  poolsData: PoolsDataMap
  poolDetails: PoolDetails | PoolDetailsMaya
  walletBalances: Pick<BalancesState, 'balances' | 'loading'>
  goToTransaction: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  validatePassword$: ValidatePasswordHandler
  reloadFees: ReloadSwapFeesHandler
  reloadBalances: FP.Lazy<void>
  fees$: SwapFeesHandler
  reloadApproveFee: LoadApproveFeeHandler
  approveFee$: ApproveFeeHandler
  recipientAddress: O.Option<Address>
  targetKeystoreAddress: O.Option<Address>
  targetLedgerAddress: O.Option<Address>
  onChangeAsset: ({
    source,
    sourceWalletType,
    target,
    targetWalletType,
    recipientAddress
  }: {
    source: AnyAsset
    target: AnyAsset
    sourceWalletType: WalletType
    targetWalletType: O.Option<WalletType>
    recipientAddress: O.Option<Address>
  }) => void
  network: Network
  slipTolerance: SlipTolerance
  changeSlipTolerance: ChangeSlipToleranceHandler
  approveERC20Token$: (params: ApproveParams) => TxHashLD
  isApprovedERC20Token$: (params: IsApproveParams) => LiveData<ApiError, boolean>
  importWalletHandler: FP.Lazy<void>
  disableSwapAction: boolean
  addressValidator: AddressValidationAsync
  hidePrivateData: boolean
  dex: Dex
}

export const Swap = ({
  thorchainQuery,
  mayachainQuery,
  keystore,
  poolAssets,
  assets: {
    source: { asset: sourceAsset, decimal: sourceAssetDecimal, price: sourceAssetPrice },
    target: { asset: targetAsset, decimal: targetAssetDecimal, price: targetAssetPrice }
  },
  poolAddress: oPoolAddress,
  swap$,
  poolDetails,
  walletBalances,
  goToTransaction,
  getExplorerTxUrl,
  validatePassword$,
  reloadFees,
  reloadBalances = FP.constVoid,
  fees$,
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
  isApprovedERC20Token$,
  approveERC20Token$,
  reloadApproveFee,
  approveFee$,
  importWalletHandler,
  disableSwapAction,
  addressValidator,
  hidePrivateData,
  dex
}: SwapProps) => {
  const { estimateSwap } = useAggregator()
  const intl = useIntl()

  const { chain: sourceChain } = sourceAsset.type === AssetType.SYNTH ? dex.asset : sourceAsset
  const { chain: targetChain } = targetAsset.type === AssetType.SYNTH ? dex.asset : targetAsset

  const lockedWallet: boolean = useMemo(() => isLocked(keystore) || !hasImportedKeystore(keystore), [keystore])
  const [quoteOnly, setQuoteOnly] = useState<boolean>(false)

  const useSourceAssetLedger = isLedgerWallet(initialSourceWalletType)
  const prevChainFees = useRef<O.Option<SwapFees>>(O.none)

  const oSourceWalletAddress = useSourceAssetLedger ? oSourceLedgerAddress : oInitialSourceKeystoreAddress

  const useTargetAssetLedger = FP.pipe(
    oInitialTargetWalletType,
    O.map(isLedgerWallet),
    O.getOrElse(() => false)
  )

  const pricePoolThor = usePricePool()
  const pricePoolMaya = usePricePoolMaya()

  // // For normal quotes
  // const [oQuote, setQuote] = useState<O.Option<TxDetails>>(O.none)

  // // For maya quotes
  // const [oQuoteMaya, setQuoteMaya] = useState<O.Option<QuoteSwap>>(O.none)

  const [oQuoteProtocol, setQuoteProtocol] = useState<O.Option<QuoteSwapProtocol>>(O.none)
  const [oErrorProtocol, setErrorProtocol] = useState<O.Option<Error>>(O.none)

  // Default Streaming interval set to 1 blocks
  const [streamingInterval, setStreamingInterval] = useState<number>(dex.chain === THORChain ? 1 : 5)
  // Default Streaming quantity set to 0, network computes the optimum
  const [streamingQuantity, setStreamingQuantity] = useState<number>(0)
  // Slide use state
  const [slider, setSlider] = useState<number>(dex.chain === THORChain ? 26 : 50)

  const [oTargetWalletType, setTargetWalletType] = useState<O.Option<WalletType>>(oInitialTargetWalletType)

  const [isStreaming, setIsStreaming] = useState<Boolean>(true)

  // Update state needed - initial target walletAddress is loaded async and can be different at first run
  useEffect(() => {
    setTargetWalletType(oInitialTargetWalletType)
  }, [oInitialTargetWalletType])

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

  // ZERO `BaseAmount` for target Asset <= 1e8
  const zeroTargetBaseAmountMax1e8 = useMemo(() => max1e8BaseAmount(zeroTargetBaseAmountMax), [zeroTargetBaseAmountMax])

  const prevSourceAsset = useRef<O.Option<AnyAsset>>(O.none)
  const prevTargetAsset = useRef<O.Option<AnyAsset>>(O.none)

  const [customAddressEditActive, setCustomAddressEditActive] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [quoteExpired, setQuoteExpired] = useState<boolean>(false)

  const sourceWalletAddress = useMemo(() => {
    return FP.pipe(
      oSourceWalletAddress,
      O.fold(
        () => '', // Fallback
        (sourceAddress) => sourceAddress // Return t
      )
    )
  }, [oSourceWalletAddress])

  const destinationWalletAddress = useMemo(
    () =>
      FP.pipe(
        oRecipientAddress,
        O.fold(
          () => '', // Fallback
          (destinationAddress) => destinationAddress // Return t
        )
      ),
    [oRecipientAddress]
  )

  /**
   * All balances based on available assets to swap
   */
  const allBalances: WalletBalances = useMemo(
    () =>
      FP.pipe(
        oWalletBalances,
        // filter wallet balances to include assets available to swap only including synth balances
        O.map((balances) => filterWalletBalancesByAssetsForDex(balances, poolAssets, dex)),
        O.getOrElse<WalletBalances>(() => [])
      ),
    [dex, oWalletBalances, poolAssets]
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
        O.map((keystoreAddress) => eqAddress.equals(keystoreAddress, address)),
        O.getOrElse(() => false)
      )
      const isLedgerAddress = FP.pipe(
        oTargetLedgerAddress,
        O.map((ledgerAddress) => eqAddress.equals(ledgerAddress, address)),
        O.getOrElse(() => false)
      )

      return isKeystoreAddress ? O.some(WalletType.Keystore) : isLedgerAddress ? O.some(WalletType.Ledger) : O.none
    },
    [oTargetLedgerAddress, oTargetKeystoreAddress]
  )
  const sourceWalletType: WalletType = useMemo(
    () => (useSourceAssetLedger ? WalletType.Ledger : WalletType.Keystore),
    [useSourceAssetLedger]
  )

  // `AssetWB` of source asset - which might be none (user has no balances for this asset or wallet is locked)
  const oSourceAssetWB: O.Option<WalletBalance> = useMemo(() => {
    const oWalletBalances = NEA.fromArray(allBalances)
    return getWalletBalanceByAssetAndWalletType({
      oWalletBalances,
      asset: sourceAsset,
      walletType: sourceWalletType
    })
  }, [sourceAsset, allBalances, sourceWalletType])

  // User balance for source asset
  const sourceAssetAmount: BaseAmount = useMemo(
    () =>
      FP.pipe(
        oSourceAssetWB,
        O.map(({ amount }) => amount),
        O.getOrElse(() => baseAmount(0, sourceAssetDecimal))
      ),
    [oSourceAssetWB, sourceAssetDecimal]
  )

  /** Balance of source asset converted to <= 1e8 or 1e10 for maya */
  const sourceAssetAmountMax1e8: BaseAmount = useMemo(() => {
    const amount = max1e8BaseAmount(sourceAssetAmount)
    return amount
  }, [sourceAssetAmount])

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

  const {
    state: swapState,
    reset: resetSwapState,
    subscribe: subscribeSwapState
  } = useSubscriptionState<SwapTxState>(INITIAL_SWAP_STATE)

  const initialAmountToSwapMax1e8 = useMemo(
    () => baseAmount(0, sourceAssetAmountMax1e8.decimal),
    [sourceAssetAmountMax1e8]
  )

  const [
    /* max. 1e8 decimal */
    amountToSwapMax1e8,
    _setAmountToSwapMax1e8 /* private - never set it directly, use setAmountToSwapMax1e8() instead */
  ] = useState(initialAmountToSwapMax1e8)

  const [lockedAssetAmount, setLockedAssetAmount] = useState<CryptoAmount>(
    new CryptoAmount(baseAmount(0, sourceAssetDecimal), sourceAsset)
  )

  const priceAmountToSwapMax1e8: CryptoAmount = useMemo(() => {
    const result = FP.pipe(
      isPoolDetails(poolDetails)
        ? PoolHelpers.getUSDValue({
            balance: { asset: sourceAsset, amount: amountToSwapMax1e8 },
            poolDetails,
            pricePool: pricePoolThor
          })
        : FP.pipe(
            PoolHelpersMaya.getUSDValue({
              balance: { asset: sourceAsset, amount: amountToSwapMax1e8 },
              poolDetails,
              pricePool: pricePoolMaya
            })
          ),
      O.getOrElse(() => baseAmount(0, amountToSwapMax1e8.decimal))
    )
    return new CryptoAmount(result, pricePoolThor.asset)
  }, [amountToSwapMax1e8, poolDetails, pricePoolMaya, pricePoolThor, sourceAsset])

  const isZeroAmountToSwap = useMemo(() => amountToSwapMax1e8.amount().isZero(), [amountToSwapMax1e8])

  const [inboundDetails, setInboundDetails] = useState<Record<string, InboundDetail>>()

  const zeroSwapFees = useMemo(() => {
    if (inboundDetails) {
      const gasRate =
        isRuneNativeAsset(sourceAsset) || isSynthAsset(sourceAsset)
          ? baseAmount(2000000)
          : baseAmount(inboundDetails?.[sourceAsset.chain]?.gasRate) // Define defaultGasRate
      const outboundFee =
        isRuneNativeAsset(targetAsset) || isSynthAsset(targetAsset)
          ? baseAmount(2000000)
          : baseAmount(inboundDetails?.[targetAsset.chain]?.outboundFee) // Define defaultOutboundFee

      // Define defaultSwapFees based on the above fallbacks
      const defaultFees: SwapFees = {
        inFee: { asset: sourceAsset, amount: gasRate },
        outFee: { asset: targetAsset, amount: outboundFee }
      }

      return defaultFees
    } else {
      // Use getZeroSwapFees if the condition is not met
      return getZeroSwapFees({ inAsset: sourceAsset, outAsset: targetAsset })
    }
  }, [inboundDetails, sourceAsset, targetAsset])
  // PlaceHolder memo just to calc fees better
  const swapMemo = useMemo(() => {
    return O.fold(
      () => '',
      (recipientAddress: string) => {
        const toleranceBps = undefined
        const affiliateName = getAsgardexThorname(network)
        const affiliateBps = getAsgardexAffiliateFee(network)
        const isAffiliateValid = affiliateName !== undefined && affiliateBps !== undefined
        return getSwapMemo({
          targetAsset,
          targetAddress: recipientAddress,
          toleranceBps,
          streamingInterval,
          streamingQuantity,
          affiliateName: isAffiliateValid ? affiliateName : undefined,
          affiliateBps: isAffiliateValid ? affiliateBps : undefined
        })
      }
    )(oRecipientAddress)
  }, [oRecipientAddress, targetAsset, streamingInterval, streamingQuantity, network])

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

  // Max amount to swap == users balances of source asset
  // Decimal always <= 1e8 based
  const maxAmountToSwapMax1e8: BaseAmount = useMemo(() => {
    if (lockedWallet || quoteOnly) {
      return lockedAssetAmount.baseAmount
    }
    const feeAmount = swapFees.inFee.amount.amount().toNumber()
    const roundedFee = Math.ceil(feeAmount / 1000) * 1000
    const roundedFeebaseAmount = baseAmount(roundedFee, swapFees.inFee.amount.decimal)
    return Utils.maxAmountToSwapMax1e8({
      asset: sourceAsset,
      balanceAmountMax1e8: sourceAssetAmountMax1e8,
      feeAmount: roundedFeebaseAmount
    })
  }, [
    lockedAssetAmount.baseAmount,
    lockedWallet,
    quoteOnly,
    sourceAsset,
    sourceAssetAmountMax1e8,
    swapFees.inFee.amount
  ])

  const setAmountToSwapMax1e8 = useCallback(
    (amountToSwap: BaseAmount) => {
      // dirty check - do nothing if prev. and next amounts are equal
      if (eqBaseAmount.equals(amountToSwap, amountToSwapMax1e8)) return {}

      const newAmountToSwap = amountToSwap.gt(maxAmountToSwapMax1e8) ? maxAmountToSwapMax1e8 : amountToSwap
      /**
       * New object instance of `amountToSwap` is needed to make
       * AssetInput component react to the new value.
       * In case maxAmount has the same pointer
       * AssetInput will not be updated as a React-component
       * but native input element will change its
       * inner value and user will see inappropriate value
       */
      _setAmountToSwapMax1e8({ ...newAmountToSwap })
    },
    [amountToSwapMax1e8, maxAmountToSwapMax1e8]
  )

  // Price of swap IN fee
  const oPriceSwapInFee: O.Option<CryptoAmount> = useMemo(() => {
    const assetAmount = new CryptoAmount(swapFees.inFee.amount, swapFees.inFee.asset)
    const result = FP.pipe(
      isPoolDetails(poolDetails)
        ? PoolHelpers.getUSDValue({
            balance: { asset: assetAmount.asset, amount: assetAmount.baseAmount },
            poolDetails,
            pricePool: pricePoolThor
          })
        : FP.pipe(
            PoolHelpersMaya.getUSDValue({
              balance: { asset: assetAmount.asset, amount: assetAmount.baseAmount },
              poolDetails,
              pricePool: pricePoolMaya
            })
          ),
      O.getOrElse(() => baseAmount(0, amountToSwapMax1e8.decimal))
    )
    return O.some(new CryptoAmount(result, pricePoolThor.asset))
  }, [
    amountToSwapMax1e8.decimal,
    poolDetails,
    pricePoolMaya,
    pricePoolThor,
    swapFees.inFee.amount,
    swapFees.inFee.asset
  ])

  const priceSwapInFeeLabel = useMemo(() => {
    // Ensure swapFees is defined before proceeding
    if (!swapFees) {
      return loadingString // or noDataString, depending on how you want to handle this case
    }

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
      O.map(({ assetAmount, asset }) =>
        eqAsset.equals(feeAsset, asset)
          ? emptyString
          : formatAssetAmountCurrency({
              amount: assetAmount,
              asset: asset,
              decimal: isUSDAsset(asset) ? 2 : 6,
              trimZeros: !isUSDAsset(asset)
            })
      ),
      O.getOrElse(() => emptyString)
    )

    return price ? `${price} (${fee})` : fee
  }, [oPriceSwapInFee, swapFees])

  // get outbound fee from quote response
  const oSwapOutFee: CryptoAmount = useMemo(() => {
    const swapOutFee = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () =>
          new CryptoAmount(
            swapFees.outFee.amount,
            targetAsset.type === AssetType.SYNTH ? AssetRuneNative : targetAsset
          ),
        (txDetails) => {
          const txOutFee = txDetails.fees.outboundFee
          return txOutFee
        }
      )
    )
    // const swapOutFeeMaya = FP.pipe(
    //   oQuoteMaya,
    //   O.fold(
    //     () => new CryptoAmount(swapFees.outFee.amount, targetAsset.type === AssetType.SYNTH ? AssetCacao : targetAsset),
    //     (quoteSwap) => {
    //       const txOutFee = quoteSwap.fees.outboundFee
    //       return txOutFee
    //     }
    //   )
    // )
    return swapOutFee
  }, [oQuoteProtocol, swapFees.outFee.amount, targetAsset])

  const [outFeePriceValue, setOutFeePriceValue] = useState<CryptoAmount>(
    new CryptoAmount(swapFees.outFee.amount, targetAsset)
  )

  // useEffect to fetch data from query
  useEffect(() => {
    const swapOutFeePrice = isPoolDetails(poolDetails)
      ? PoolHelpers.getUSDValue({
          balance: { asset: oSwapOutFee.asset, amount: oSwapOutFee.baseAmount },
          poolDetails,
          pricePool: pricePoolThor
        })
      : PoolHelpersMaya.getUSDValue({
          balance: { asset: oSwapOutFee.asset, amount: oSwapOutFee.baseAmount },
          poolDetails,
          pricePool: pricePoolMaya
        })
    if (O.isSome(swapOutFeePrice)) {
      const swapOutFeeCryptoAmount = new CryptoAmount(swapOutFeePrice.value, pricePoolThor.asset)
      setOutFeePriceValue(swapOutFeeCryptoAmount)
    }
    const fetchData = async () => {
      setInboundDetails(
        dex.chain === THORChain
          ? await thorchainQuery.thorchainCache.getInboundDetails()
          : await mayachainQuery.getInboundDetails()
      )
    }

    if (quoteExpired) {
      fetchData()
    }
  }, [
    thorchainQuery,
    oSwapOutFee,
    poolDetails,
    network,
    dex,
    mayachainQuery,
    quoteExpired,
    pricePoolThor,
    pricePoolMaya
  ])

  const priceSwapOutFeeLabel = useMemo(() => {
    // Check if swapFees is defined
    if (!swapFees) {
      return loadingString // or noDataString, depending on how you want to handle this case
    }

    // Access the outFee from swapFees
    const {
      outFee: { amount, asset: feeAsset }
    } = swapFees

    const fee = formatAssetAmountCurrency({
      amount: baseToAsset(amount),
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
  }, [swapFees, outFeePriceValue])

  // Affiliate fee
  const affiliateFee: CryptoAmount = useMemo(() => {
    const affiliate = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => new CryptoAmount(baseAmount(0), AssetRuneNative), // default affiliate fee asset amount
        (txDetails) => {
          const fee = txDetails.fees.affiliateFee
          return fee
        }
      )
    )
    return affiliate
  }, [oQuoteProtocol])

  // store affiliate fee
  const [affiliatePriceValue, setAffiliatePriceValue] = useState<CryptoAmount>(
    new CryptoAmount(baseAmount(0, sourceAssetDecimal), sourceAsset)
  )

  // useEffect to fetch data from query
  useEffect(() => {
    const affiliatePriceValue = isPoolDetails(poolDetails)
      ? PoolHelpers.getUSDValue({
          balance: { asset: affiliateFee.asset, amount: affiliateFee.baseAmount },
          poolDetails,
          pricePool: pricePoolThor
        })
      : PoolHelpersMaya.getUSDValue({
          balance: { asset: affiliateFee.asset, amount: affiliateFee.baseAmount },
          poolDetails,
          pricePool: pricePoolMaya
        })
    if (O.isSome(affiliatePriceValue)) {
      const maxCryptoAmount = new CryptoAmount(affiliatePriceValue.value, pricePoolThor.asset)
      setAffiliatePriceValue(maxCryptoAmount)
    }
  }, [affiliateFee, network, poolDetails, pricePoolMaya, pricePoolThor])

  //Helper Affiliate function, swaps where tx is greater than affiliate aff is free
  // Apparently thornode bug is fixed.
  // https://gitlab.com/thorchain/thornode/-/commit/f96350ab3d5adda18c61d134caa98b6d5af2b006
  const applyBps = useMemo(() => {
    const txFeeCovered = priceAmountToSwapMax1e8.assetAmount.gt(ASGARDEX_AFFILIATE_FEE_MIN)
    const applyBps = txFeeCovered
    return applyBps
  }, [priceAmountToSwapMax1e8.assetAmount])

  const priceAffiliateFeeLabel = useMemo(() => {
    if (!swapFees) {
      return loadingString // or noDataString, depending on your needs
    }

    const fee = formatAssetAmountCurrency({
      amount: affiliateFee.assetAmount,
      asset: affiliateFee.asset,
      decimal: isUSDAsset(affiliateFee.asset) ? 2 : 6,
      trimZeros: !isUSDAsset(affiliateFee.asset)
    })

    const price = FP.pipe(
      O.some(affiliatePriceValue), // Assuming this is Option<CryptoAmount>
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
    const displayBps = applyBps && bps !== undefined ? `${bps / 100}%` : '0%'

    return price ? `${price} (${fee}) ${displayBps}` : fee
  }, [swapFees, affiliateFee.assetAmount, affiliateFee.asset, affiliatePriceValue, applyBps, network, sourceAsset])

  useEffect(() => {
    // Reset states on dependency change
    setQuoteProtocol(O.none)

    const fetchSwap = async () => {
      try {
        const result = await estimateSwap({
          fromAsset: sourceAsset,
          destinationAsset: targetAsset,
          amount: new CryptoAmount(convertBaseAmountDecimal(amountToSwapMax1e8, sourceAssetDecimal), sourceAsset),
          fromAddress: sourceWalletAddress,
          destinationAddress: quoteOnly ? undefined : destinationWalletAddress,
          streamingInterval: isStreaming ? streamingInterval : 0,
          streamingQuantity: isStreaming ? streamingQuantity : 0,
          toleranceBps: isStreaming || network === Network.Stagenet ? 10000 : slipTolerance * 100 // convert to basis points
        })
        setQuoteProtocol(O.some(result))
      } catch (err) {
        console.error('Failed to fetch estimate:', err)
        setErrorProtocol(O.some(err as Error))
      }
    }

    fetchSwap()
  }, [
    amountToSwapMax1e8,
    destinationWalletAddress,
    estimateSwap,
    isStreaming,
    network,
    quoteOnly,
    slipTolerance,
    sourceAsset,
    sourceAssetDecimal,
    sourceWalletAddress,
    streamingInterval,
    streamingQuantity,
    targetAsset
  ])

  // Swap boolean for use later
  const canSwap: boolean = useMemo(() => {
    const canSwapFromTxDetails = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => false, // default value if oQuote is None
        (txDetails) => {
          const canSwap = txDetails.canSwap
          return canSwap
        }
      )
    )
    return canSwapFromTxDetails
  }, [oQuoteProtocol])

  // // Reccommend amount in for use later
  // const reccommendedAmountIn: CryptoAmount = useMemo(
  //   () =>
  //     FP.pipe(
  //       oQuoteProtocol,
  //       O.fold(
  //         () => new CryptoAmount(baseAmount(0), sourceAsset), // default value if oQuote is None
  //         (txDetails) => new CryptoAmount(baseAmount(txDetails.), sourceAsset)
  //       )
  //     ),
  //   [oQuoteProtocol, sourceAsset]
  // )

  // Quote slippage returned as a percent
  const swapSlippage: number = useMemo(() => {
    const slipFromTxDetails = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => 0,
        (txDetails) => txDetails.slipBasisPoints / 100
      )
    )

    return slipFromTxDetails
  }, [oQuoteProtocol])

  // Quote expiry returned as a date
  const swapExpiry: Date = useMemo(() => {
    const expiry = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => new Date(), // default
        () => {
          const now = new Date()
          now.setMinutes(now.getMinutes() + 15)
          return now
        }
      )
    )
    return expiry
  }, [oQuoteProtocol])

  // Swap result from thornode
  const swapResultAmountMax: CryptoAmount = useMemo(() => {
    const expectedAmount = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => new CryptoAmount(baseAmount(0), targetAsset),
        (txDetails) => txDetails.expectedAmount
      )
    )
    return expectedAmount
  }, [oQuoteProtocol, targetAsset])

  // Swap streaming result from thornode
  // const maxStreamingQuantity: number = useMemo(
  //   () =>
  //     FP.pipe(
  //       sequenceTOption(oQuote),
  //       O.fold(
  //         () => 0,
  //         ([txDetails]) => txDetails.txEstimate.maxStreamingQuantity
  //       )
  //     ),
  //   [oQuote]
  // )

  // Quote Errors
  const quoteErrors: string[] = useMemo(() => {
    const protocolErrors = FP.pipe(
      oErrorProtocol,
      O.fold(
        () => [],
        (error) => [error.message]
      )
    )

    return [...protocolErrors]
  }, [oErrorProtocol])

  /**
   * Price of swap result in max 1e8 // boolean to convert between streaming and regular swaps
   */
  const priceSwapResultAmountMax1e8: AssetWithAmount = useMemo(() => {
    return FP.pipe(
      isPoolDetails(poolDetails)
        ? PoolHelpers.getUSDValue({
            balance: {
              asset: swapResultAmountMax.asset,
              amount: swapResultAmountMax.baseAmount
            },
            poolDetails,
            pricePool: pricePoolThor
          })
        : PoolHelpersMaya.getUSDValue({
            balance: {
              asset: swapResultAmountMax.asset,
              amount: swapResultAmountMax.baseAmount
            },
            poolDetails,
            pricePool: pricePoolMaya
          }),
      O.getOrElse(() => baseAmount(0, THORCHAIN_DECIMAL)), // default decimal
      (amount) => ({ asset: pricePoolThor.asset, amount })
    )
  }, [poolDetails, swapResultAmountMax.asset, swapResultAmountMax.baseAmount, pricePoolThor, pricePoolMaya])

  /**
   * Price sum of swap fees (IN + OUT) and affiliate
   */
  const oPriceSwapFees1e8: O.Option<AssetWithAmount> = useMemo(
    () =>
      FP.pipe(
        sequenceSOption({
          inFee: oPriceSwapInFee,
          outFee: O.some(outFeePriceValue),
          affiliateFee: O.some(affiliatePriceValue)
        }),
        O.map(({ inFee, outFee, affiliateFee }) => {
          const in1e8 = to1e8BaseAmount(inFee.baseAmount)
          const out1e8 = to1e8BaseAmount(outFee.baseAmount)
          const affiliate = to1e8BaseAmount(affiliateFee.baseAmount)
          const slipbps = swapSlippage
          const slip = to1e8BaseAmount(priceAmountToSwapMax1e8.baseAmount.times(slipbps / 100))
          // adding slip costs to total fees
          return { asset: inFee.asset, amount: in1e8.plus(out1e8).plus(affiliate).plus(slip) }
        })
      ),
    [oPriceSwapInFee, outFeePriceValue, affiliatePriceValue, swapSlippage, priceAmountToSwapMax1e8]
  )

  const priceSwapFeesLabel = useMemo(() => {
    return FP.pipe(
      oPriceSwapFees1e8,
      O.map(({ amount, asset }) => {
        return formatAssetAmountCurrency({
          amount: baseToAsset(amount),
          asset,
          decimal: isUSDAsset(asset) ? 2 : 6
        })
      }),
      O.getOrElse(() => noDataString)
    )
  }, [oPriceSwapFees1e8])

  // Disable slippage selection temporary for Ledger/BTC (see https://github.com/thorchain/asgardex-electron/issues/2068)
  const disableSlippage = useMemo(
    () =>
      (isBtcChain(sourceChain) || isLtcChain(sourceChain) || isBchChain(sourceChain) || isDogeChain(sourceChain)) &&
      useSourceAssetLedger,
    [useSourceAssetLedger, sourceChain]
  )

  const swapLimit1e8: O.Option<BaseAmount> = useMemo(() => {
    return FP.pipe(
      oQuoteProtocol,
      O.chain((txDetails) => {
        // Disable slippage protection temporary for Ledger/BTC (see https://github.com/thorchain/asgardex-electron/issues/2068)
        return !disableSlippage && swapResultAmountMax.baseAmount.gt(zeroTargetBaseAmountMax1e8)
          ? O.some(Utils.getSwapLimit1e8(txDetails.memo))
          : O.none
      })
    )
  }, [oQuoteProtocol, disableSlippage, swapResultAmountMax, zeroTargetBaseAmountMax1e8])

  // const swapLimitMaya1e8: O.Option<BaseAmount> = useMemo(() => {
  //   return FP.pipe(
  //     oQuoteMaya,
  //     O.chain((txDetails) => {
  //       // Disable slippage protection temporary for Ledger/BTC (see https://github.com/thorchain/asgardex-electron/issues/2068)
  //       return !disableSlippage && swapResultAmountMax.baseAmount.gt(zeroTargetBaseAmountMax1e8)
  //         ? O.some(Utils.getSwapLimit1e8(txDetails.memo))
  //         : O.none
  //     })
  //   )
  // }, [oQuoteMaya, disableSlippage, swapResultAmountMax, zeroTargetBaseAmountMax1e8])

  const oSwapParams: O.Option<SwapTxParams> = useMemo(() => {
    // const swapParamsThor = FP.pipe(
    //   sequenceTOption(oPoolAddress, oSourceAssetWB, oQuote),
    //   O.map(([poolAddress, { walletType, walletAddress, walletAccount, walletIndex, hdMode }, txDetails]) => {
    //     let amountToSwap = convertBaseAmountDecimal(amountToSwapMax1e8, sourceAssetAmount.decimal)
    //     if (!isTokenAsset(sourceAsset) && !isTradeAsset(sourceAsset) && !isSynthAsset(sourceAsset)) {
    //       if (sourceChainAssetAmount.lt(amountToSwap.plus(swapFees.inFee.amount))) {
    //         amountToSwap = sourceChainAssetAmount.minus(swapFees.inFee.amount)
    //       }
    //     }
    //     return {
    //       poolAddress,
    //       asset: sourceAsset,
    //       amount: amountToSwap,
    //       memo: shortenMemo(txDetails.memo), // short asset
    //       walletType,
    //       sender: walletAddress,
    //       walletAccount,
    //       walletIndex,
    //       hdMode,
    //       dex
    //     }
    //   })
    // )
    // const swapParamsMaya = FP.pipe(
    //   sequenceTOption(oPoolAddress, oSourceAssetWB, oQuoteMaya),
    //   O.map(([poolAddress, { walletType, walletAddress, walletAccount, walletIndex, hdMode }, quoteSwap]) => {
    //     let amountToSwap = convertBaseAmountDecimal(amountToSwapMax1e8, sourceAssetAmount.decimal)
    //     if (!isTokenAsset(sourceAsset) && !isTradeAsset(sourceAsset) && !isSynthAsset(sourceAsset)) {
    //       if (sourceChainAssetAmount.lt(amountToSwap.plus(swapFees.inFee.amount))) {
    //         amountToSwap = sourceChainAssetAmount.minus(swapFees.inFee.amount)
    //       }
    //     }
    //     return {
    //       poolAddress,
    //       asset: sourceAsset,
    //       amount: amountToSwap,
    //       memo: quoteSwap.memo, // The memo will be different based on the selected quote
    //       walletType,
    //       sender: walletAddress,
    //       walletAccount,
    //       walletIndex,
    //       hdMode,
    //       dex
    //     }
    //   })
    // )
    const oSwapParamsProtocol = FP.pipe(
      sequenceTOption(oPoolAddress, oSourceAssetWB, oQuoteProtocol),
      O.map(([poolAddress, { walletType, walletAddress, walletAccount, walletIndex, hdMode }, quoteSwap]) => {
        let amountToSwap = convertBaseAmountDecimal(amountToSwapMax1e8, sourceAssetAmount.decimal)
        if (!isTokenAsset(sourceAsset) && !isTradeAsset(sourceAsset) && !isSynthAsset(sourceAsset)) {
          if (sourceChainAssetAmount.lt(amountToSwap.plus(swapFees.inFee.amount))) {
            amountToSwap = sourceChainAssetAmount.minus(swapFees.inFee.amount)
          }
        }
        return {
          poolAddress,
          asset: sourceAsset,
          amount: amountToSwap,
          memo: updateMemo(quoteSwap.memo, applyBps, network),
          walletType,
          sender: walletAddress,
          walletAccount,
          walletIndex,
          hdMode,
          dex: quoteSwap.protocol === 'Thorchain' ? thorDetails : mayaDetails,
          toAddress: quoteSwap.toAddress
        }
      })
    )
    return oSwapParamsProtocol
  }, [
    oPoolAddress,
    oSourceAssetWB,
    oQuoteProtocol,
    amountToSwapMax1e8,
    sourceAssetAmount.decimal,
    sourceAsset,
    applyBps,
    network,
    sourceChainAssetAmount,
    swapFees.inFee.amount
  ])

  // Check to see slippage greater than tolerance
  // This is handled by thornode
  const isCausedSlippage = useMemo(() => {
    const result = isStreaming ? false : swapSlippage > slipTolerance
    return result
  }, [swapSlippage, slipTolerance, isStreaming])

  type RateDirection = 'fromSource' | 'fromTarget'
  const [rateDirection, setRateDirection] = useState<RateDirection>('fromSource')

  const rateLabel = useMemo(() => {
    switch (rateDirection) {
      case 'fromSource':
        return `${formatAssetAmountCurrency({
          asset: sourceAsset,
          amount: assetAmount(1),
          decimal: isUSDAsset(sourceAsset) ? 2 : 6,
          trimZeros: true
        })}${' '}=${' '}${formatAssetAmountCurrency({
          asset: targetAsset,
          amount: assetAmount(sourceAssetPrice.dividedBy(targetAssetPrice)),
          decimal: isUSDAsset(targetAsset) ? 2 : 6,
          trimZeros: true
        })}`
      case 'fromTarget':
        return `${formatAssetAmountCurrency({
          asset: targetAsset,
          decimal: isUSDAsset(targetAsset) ? 2 : 6,
          amount: assetAmount(1),
          trimZeros: true
        })}${' '}=${' '}${formatAssetAmountCurrency({
          asset: sourceAsset,
          decimal: isUSDAsset(sourceAsset) ? 2 : 6,
          amount: assetAmount(targetAssetPrice.dividedBy(sourceAssetPrice)),
          trimZeros: true
        })}`
    }
  }, [rateDirection, sourceAsset, sourceAssetPrice, targetAsset, targetAssetPrice])

  const needApprovement: O.Option<boolean> = useMemo(() => {
    return isEvmChain(sourceChain) && isEvmToken(sourceAsset)
      ? O.some(isEVMTokenAsset(sourceAsset as TokenAsset))
      : O.none
  }, [sourceAsset, sourceChain])

  const oApproveParams: O.Option<ApproveParams> = useMemo(() => {
    const oRouterAddress: O.Option<Address> = FP.pipe(
      oPoolAddress,
      O.chain(({ router }) => router)
    )

    const oTokenAddress: O.Option<string> = getEVMTokenAddressForChain(sourceChain, sourceAsset as TokenAsset)

    const oNeedApprovement: O.Option<boolean> = FP.pipe(
      needApprovement,
      // Keep the existing Option<boolean>, no need for O.fromPredicate
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
  }, [needApprovement, network, oPoolAddress, oSourceAssetWB, sourceAsset, sourceChain])

  const reloadFeesHandler = useCallback(() => {
    reloadFees({
      inAsset: sourceAsset,
      memo: swapMemo,
      outAsset: targetAsset
    })
  }, [reloadFees, sourceAsset, swapMemo, targetAsset])

  const prevApproveFee = useRef<O.Option<BaseAmount>>(O.none)

  const [approveFeeRD, approveFeeParamsUpdated] = useObservableState<FeeRD, ApproveParams>((approveFeeParam$) => {
    return approveFeeParam$.pipe(
      RxOp.switchMap((params) =>
        FP.pipe(
          approveFee$(params),
          RxOp.map((fee) => {
            // store every successfully loaded fees
            if (RD.isSuccess(fee)) {
              prevApproveFee.current = O.some(fee.value)
            }
            return fee
          })
        )
      )
    )
  }, RD.initial)

  const prevApproveParams = useRef<O.Option<ApproveParams>>(O.none)

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

  // State for values of `isApprovedERC20Token$`
  const {
    state: isApprovedState,
    reset: resetIsApprovedState,
    subscribe: subscribeIsApprovedState
  } = useSubscriptionState<IsApprovedRD>(RD.initial)

  const checkApprovedStatus = useCallback(
    ({ contractAddress, spenderAddress, fromAddress }: ApproveParams) => {
      subscribeIsApprovedState(
        isApprovedERC20Token$({
          contractAddress,
          spenderAddress,
          fromAddress
        })
      )
    },
    [isApprovedERC20Token$, subscribeIsApprovedState]
  )

  const reloadApproveFeesHandler = useCallback(() => {
    FP.pipe(oApproveParams, O.map(reloadApproveFee))
  }, [oApproveParams, reloadApproveFee])

  // Swap start time
  const [swapStartTime, setSwapStartTime] = useState<number>(0)

  const setSourceAsset = useCallback(
    async (asset: AnyAsset) => {
      // delay to avoid render issues while switching
      resetIsApprovedState()
      await delay(100)
      setAmountToSwapMax1e8(initialAmountToSwapMax1e8)
      // setQuote(O.none)
      // setQuoteMaya(O.none)
      onChangeAsset({
        source: asset,
        // back to default 'keystore' type
        sourceWalletType: WalletType.Keystore,
        target: targetAsset,
        targetWalletType: oTargetWalletType,
        recipientAddress: oRecipientAddress
      })
      await delay(100) // Optional delay to ensure state updates properly
      // Step 3: Check approval for the new asset
      FP.pipe(
        oApproveParams, // Use the new asset's approval parameters
        O.map((params) => checkApprovedStatus(params))
      )
    },
    [
      checkApprovedStatus,
      initialAmountToSwapMax1e8,
      oApproveParams,
      oRecipientAddress,
      oTargetWalletType,
      onChangeAsset,
      resetIsApprovedState,
      setAmountToSwapMax1e8,
      targetAsset
    ]
  )

  const setTargetAsset = useCallback(
    async (asset: AnyAsset) => {
      // Step 1: Reset approval state before changing the asset
      resetIsApprovedState()

      // Step 2: Switch target asset
      await delay(100) // Optional delay to ensure state updates properly

      onChangeAsset({
        source: sourceAsset,
        sourceWalletType,
        target: asset,
        // Reset the wallet type for the new target asset
        targetWalletType: O.some(WalletType.Keystore),
        recipientAddress: O.none
      })
      await delay(100) // Optional delay to ensure state updates properly
      // Step 3: Check approval for the new asset
      FP.pipe(
        oApproveParams, // Use the new asset's approval parameters
        O.map((params) => checkApprovedStatus(params))
      )
    },
    [onChangeAsset, resetIsApprovedState, sourceAsset, sourceWalletType, checkApprovedStatus, oApproveParams]
  )

  // whenever `oApproveParams` has been updated,
  // `approveFeeParamsUpdated` needs to be called to update `approveFeesRD`
  // + `checkApprovedStatus` needs to be called
  useEffect(() => {
    FP.pipe(
      oApproveParams,
      // Do nothing if prev. and current router are the same
      O.filter((params) => !eqOApproveParams.equals(O.some(params), prevApproveParams.current)),
      // update ref
      O.map((params) => {
        prevApproveParams.current = O.some(params) // Update reference to current params

        // Using setTimeout to delay the execution of subsequent actions
        setTimeout(() => {
          approveFeeParamsUpdated(params)
          checkApprovedStatus(params)
        }, 100) // Delay of 100 milliseconds

        return true
      })
    )
  }, [approveFeeParamsUpdated, checkApprovedStatus, oApproveParams, oPoolAddress])

  // const minAmountError = useMemo(() => {
  //   if (isZeroAmountToSwap) return false
  //   const minAmountIn = convertBaseAmountDecimal(reccommendedAmountIn.baseAmount, amountToSwapMax1e8.decimal)
  //   return amountToSwapMax1e8.lt(fe)
  // }, [amountToSwapMax1e8, isZeroAmountToSwap, reccommendedAmountIn.baseAmount])

  // sets the locked asset amount to be the asset pool depth
  useEffect(() => {
    if (lockedWallet) {
      setQuoteOnly(true)
      const poolAsset =
        (isRuneNativeAsset(sourceAsset) && dex.chain === THORChain) ||
        (isCacaoAsset(sourceAsset) && dex.chain === 'MAYA')
          ? targetAsset
          : sourceAsset
      const poolDetail = isPoolDetails(poolDetails)
        ? getPoolDetail(poolDetails, poolAsset)
        : getPoolDetailMaya(poolDetails, poolAsset)

      if (O.isSome(poolDetail)) {
        const detail = poolDetail.value
        let amount: BaseAmount
        if (isRuneNativeAsset(sourceAsset)) {
          amount = baseAmount(detail.runeDepth)
        } else if (isCacaoAsset(sourceAsset)) {
          amount = baseAmount(detail.runeDepth)
        } else {
          amount = dex.chain === THORChain ? baseAmount(detail.assetDepth) : baseAmount(detail.assetDepth)
        }
        setLockedAssetAmount(new CryptoAmount(convertBaseAmountDecimal(amount, sourceAssetDecimal), sourceAsset))
      } else {
        setLockedAssetAmount(new CryptoAmount(ONE_RUNE_BASE_AMOUNT, sourceAsset))
      }
    }
  }, [dex, lockedWallet, poolDetails, quoteOnly, sourceAsset, sourceAssetDecimal, targetAsset, thorchainQuery])

  /**
   * Selectable source assets to swap from.
   *
   * Based on users balances.
   * Zero balances are ignored.
   * Duplications of assets are merged.
   */
  const selectableSourceAssets: AnyAsset[] = useMemo(
    () =>
      FP.pipe(
        allBalances,
        // get asset
        A.map(({ asset }) => asset),
        // Remove target assets from source list
        A.filter((asset) => !eqAsset.equals(asset, targetAsset)),
        // Merge duplications
        (assets) => unionAssets(assets)(assets)
      ),

    [allBalances, targetAsset]
  )

  /**
   * Selectable target assets to swap to.
   *
   * Based on available pool assets.
   * Duplications of assets are merged.
   */
  const selectableTargetAssets = useMemo(
    (): AnyAsset[] =>
      FP.pipe(
        poolAssets,
        A.chain((asset) =>
          isRuneNativeAsset(asset) || isCacaoAsset(asset)
            ? [asset]
            : dex.chain === MayaChain
            ? [
                asset,
                {
                  ...asset,
                  type: AssetType.SYNTH,
                  synth: true
                } as SynthAsset
              ]
            : [asset]
        ),
        A.filter((asset) => !eqAsset.equals(asset, sourceAsset)),
        (assets) => unionAssets(assets)(assets)
      ),
    [poolAssets, sourceAsset, dex]
  )
  type ModalState = 'swap' | 'approve' | 'none'
  const [showPasswordModal, setShowPasswordModal] = useState<ModalState>('none')
  const [showLedgerModal, setShowLedgerModal] = useState<ModalState>('none')

  const setAmountToSwapFromPercentValue = useCallback(
    (percents: number) => {
      const amountFromPercentage = maxAmountToSwapMax1e8.amount().multipliedBy(percents / 100)
      return setAmountToSwapMax1e8(baseAmount(amountFromPercentage, maxAmountToSwapMax1e8.decimal))
    },
    [maxAmountToSwapMax1e8, setAmountToSwapMax1e8]
  )

  // Function to reset the slider to default position
  const resetToDefault = () => {
    setStreamingInterval(dex.chain === THORChain ? 1 : 5) // Default position
    setStreamingQuantity(0) // thornode | mayanode decides the swap quantity
    setSlider(dex.chain === THORChain ? 26 : 50)
    setIsStreaming(true)
  }

  const quoteOnlyButton = () => {
    setQuoteOnly(!quoteOnly)
    setAmountToSwapMax1e8(initialAmountToSwapMax1e8)
    // setQuote(O.none)
    // setQuoteMaya(O.none)
  }

  const labelMin = useMemo(
    () => (slider <= 0 ? `Limit Swap` : slider < 50 ? 'Time Optimised' : `Price Optimised`),
    [slider]
  )

  // Streaming Interval slider
  const renderStreamerInterval = useMemo(() => {
    const calculateStreamingInterval = (slider: number) => {
      if (dex.chain === THORChain) {
        if (slider >= 75) return 3
        if (slider >= 50) return 2
        if (slider >= 25) return 1
        return 0
      } else if (dex.chain === MAYAChain) {
        if (slider >= 90) return 10
        if (slider >= 70) return 8
        if (slider >= 50) return 5
        if (slider >= 30) return 3
        if (slider >= 10) return 1
        return 0
      }
      return 3 // Default for other chains
    }
    const streamingIntervalValue = calculateStreamingInterval(slider)
    const setInterval = (slider: number) => {
      setSlider(slider)
      setStreamingInterval(streamingIntervalValue)
      setStreamingQuantity(0)
      setIsStreaming(streamingIntervalValue !== 0)
    }
    const tipFormatter =
      slider === 0 ? 'Caution tx could be refunded' : `${streamingIntervalValue} Block interval between swaps`

    return (
      <div>
        <Slider
          key={'Streamer Interval slider'}
          value={slider}
          onChange={setInterval}
          included={false}
          max={100}
          tooltipVisible
          tipFormatter={() => `${tipFormatter} `}
          labels={[`${labelMin}`, `${streamingInterval}`]}
          tooltipPlacement={'top'}
        />
      </div>
    )
  }, [dex.chain, labelMin, slider, streamingInterval])

  // Streaming Quantity slider
  const renderStreamerQuantity = useMemo(() => {
    const quantity = streamingQuantity
    const setQuantity = (quantity: number) => {
      setStreamingQuantity(quantity)
    }
    let quantityLabel: string[]
    let toolTip: string
    if (streamingInterval === 0) {
      quantityLabel = [`Limit swap`]
      toolTip = `No Streaming interval set`
    } else {
      quantityLabel = quantity === 0 ? [`Auto swap count`] : [`Sub swaps`, `${quantity}`]
      toolTip = `Protocol decides the swap count`
    }
    return (
      <div>
        <Slider
          key={'Streamer Quantity slider'}
          value={quantity}
          onChange={setQuantity}
          tooltipVisible
          tipFormatter={() => `${toolTip}`}
          included={false}
          labels={quantityLabel}
          tooltipPlacement={'top'}
        />
      </div>
    )
  }, [streamingQuantity, streamingInterval])

  // swap expiry progress bar
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const renderSwapExpiry = useMemo(() => {
    const quoteValidTime = 15 * 60 * 1000 // 15 minutes in milliseconds

    const remainingTime = swapExpiry.getTime() - currentDate.getTime()
    const remainingTimeInMinutes = Math.floor(remainingTime / (60 * 1000))

    const progress = Math.max(0, (remainingTime / quoteValidTime) * 100)
    setQuoteExpired(remainingTimeInMinutes < 1)
    const expiryLabel =
      remainingTimeInMinutes < 0 ? `Quote Expired` : `Quote expiring in ${remainingTimeInMinutes} minutes`

    return (
      <ProgressBar
        key={'Quote expiry progress bar'}
        percent={progress}
        withLabel={true}
        labels={[`${expiryLabel}`, ``]}
      />
    )
  }, [swapExpiry, currentDate])

  // // Progress bar for swap return comparison
  // const renderStreamerReturns = useMemo(() => {
  //   // Initialize percentageDifference
  //   let percentageDifference = 0

  //   // Check if swapSlippage is not zero to avoid division by zero
  //   if (swapSlippage !== 0) {
  //     percentageDifference = ((swapSlippage - swapStreamingSlippage) / swapSlippage) * 100
  //   }

  //   if (!isStreaming) {
  //     percentageDifference = 0
  //   }

  //   // Check if percentageDifference is a number
  //   const isPercentageValid = !isNaN(percentageDifference) && isFinite(percentageDifference)
  //   const streamingVal = isStreaming ? 'Streaming' : 'Limit'
  //   const streamerComparison = isPercentageValid
  //     ? percentageDifference <= 1
  //       ? `Instant ${streamingVal} swap `
  //       : `${percentageDifference.toFixed(2)}% Better swap execution via streaming`
  //     : 'Invalid or zero slippage' // Default message for invalid or zero slippage

  //   return (
  //     <ProgressBar
  //       key={'Streamer Interval progress bar'}
  //       percent={percentageDifference}
  //       withLabel={true}
  //       labels={[`${streamerComparison}`, ``]}
  //       tooltipPlacement={'top'}
  //       hasError={!isStreaming}
  //     />
  //   )
  // }, [isStreaming, swapSlippage, swapStreamingSlippage])

  const submitSwapTx = useCallback(() => {
    FP.pipe(
      oSwapParams,
      O.map((swapParams) => {
        // set start time
        setSwapStartTime(Date.now())
        // subscribe to swap$

        subscribeSwapState(swap$(swapParams))

        return true
      })
    )
  }, [oSwapParams, subscribeSwapState, swap$])

  const {
    state: approveState,
    reset: resetApproveState,
    subscribe: subscribeApproveState
  } = useSubscriptionState<TxHashRD>(RD.initial)

  const submitApproveTx = useCallback(() => {
    FP.pipe(
      oApproveParams,
      O.map(({ walletAccount, walletIndex, walletType, hdMode, contractAddress, spenderAddress, fromAddress }) =>
        subscribeApproveState(
          approveERC20Token$({
            network,
            contractAddress,
            spenderAddress,
            fromAddress,
            walletAccount,
            walletIndex,
            hdMode,
            walletType
          })
        )
      )
    )
  }, [approveERC20Token$, network, oApproveParams, subscribeApproveState])

  const onSubmit = useCallback(() => {
    if (useSourceAssetLedger) {
      setShowLedgerModal('swap')
    } else {
      setShowPasswordModal('swap')
    }
  }, [setShowLedgerModal, useSourceAssetLedger])

  const extraTxModalContent = useMemo(() => {
    const { swapTx } = swapState
    // don't render TxModal in initial state
    if (RD.isInitial(swapTx)) return <></>
    const stepLabel = FP.pipe(
      swapState.swapTx,
      RD.fold(
        () => '',
        () => `${intl.formatMessage({ id: 'common.tx.sending' })}`,
        () => '',
        () => 'Sent!'
      )
    )

    return (
      <SwapAssets
        key="swap-assets"
        source={{ asset: sourceAsset, amount: amountToSwapMax1e8 }}
        target={{
          asset: targetAsset,
          amount: swapResultAmountMax.baseAmount
        }}
        stepDescription={stepLabel}
        network={network}
      />
    )
  }, [swapState, sourceAsset, amountToSwapMax1e8, targetAsset, swapResultAmountMax.baseAmount, network, intl])
  // assuming on a unsucessful tx that the swap state should remain the same
  const onCloseTxModal = useCallback(() => {
    resetSwapState()
  }, [resetSwapState])

  const onFinishTxModal = useCallback(() => {
    resetSwapState()
    reloadBalances()
    setAmountToSwapMax1e8(initialAmountToSwapMax1e8)
    setQuoteExpired(true)
    // setQuote(O.none)
    // setQuoteMaya(O.none)
    // Conditionally add asset if both conditions are true
    if (isEvmChain(targetChain) && isEvmToken(targetAsset)) {
      addAsset(targetAsset as TokenAsset)
    }
  }, [resetSwapState, reloadBalances, setAmountToSwapMax1e8, initialAmountToSwapMax1e8, targetChain, targetAsset])

  const renderTxModal = useMemo(() => {
    const { swapTx } = swapState

    // don't render TxModal in initial state
    if (RD.isInitial(swapTx)) return <></>

    // Get timer value
    const timerValue = FP.pipe(
      swapTx,
      RD.fold(
        () => 0,
        FP.flow(
          O.map(({ loaded }) => loaded),
          O.getOrElse(() => 0)
        ),
        () => 0,
        () => 100
      )
    )

    // title
    const txModalTitle = FP.pipe(
      swapTx,
      RD.fold(
        () => 'swap.state.sending',
        () => 'swap.state.pending',
        () => 'swap.state.error',
        () => 'swap.state.success'
      ),
      (id) => intl.formatMessage({ id })
    )

    const oTxHash = FP.pipe(
      RD.toOption(swapTx),
      // Note: As long as we link to `viewblock` to open tx details in a browser,
      // `0x` needs to be removed from tx hash in case of ETH
      // @see https://github.com/thorchain/asgardex-electron/issues/1787#issuecomment-931934508
      O.map((txHash) => (isEvmChain(sourceChain) ? txHash.replace(/0x/i, '') : txHash))
    )

    const txRDasBoolean = FP.pipe(
      swapTx,
      RD.map((txHash) => !!txHash)
    )
    return (
      <TxModal
        title={txModalTitle}
        onClose={onCloseTxModal}
        onFinish={onFinishTxModal}
        startTime={swapStartTime}
        txRD={txRDasBoolean}
        extraResult={
          <ViewTxButton
            txHash={oTxHash}
            onClick={goToTransaction}
            txUrl={FP.pipe(oTxHash, O.chain(getExplorerTxUrl))}
            network={network}
            trackable={dex.chain === THORChain ? true : false}
          />
        }
        timerValue={timerValue}
        extra={extraTxModalContent}
      />
    )
  }, [
    swapState,
    onCloseTxModal,
    onFinishTxModal,
    swapStartTime,
    goToTransaction,
    getExplorerTxUrl,
    dex,
    extraTxModalContent,
    intl,
    sourceChain,
    network
  ])

  const renderPasswordConfirmationModal = useMemo(() => {
    const onSuccess = () => {
      if (showPasswordModal === 'swap') submitSwapTx()
      if (showPasswordModal === 'approve') submitApproveTx()
      setShowPasswordModal('none')
    }
    const onClose = () => {
      setShowPasswordModal('none')
    }
    const render = showPasswordModal === 'swap' || showPasswordModal === 'approve'
    return (
      render && (
        <WalletPasswordConfirmationModal
          onSuccess={onSuccess}
          onClose={onClose}
          validatePassword$={validatePassword$}
        />
      )
    )
  }, [showPasswordModal, submitApproveTx, submitSwapTx, validatePassword$])

  const renderLedgerConfirmationModal = useMemo(() => {
    const visible = showLedgerModal === 'swap' || showLedgerModal === 'approve'

    const onClose = () => {
      setShowLedgerModal('none')
    }

    const onSucceess = () => {
      if (showLedgerModal === 'swap') submitSwapTx()
      if (showLedgerModal === 'approve') submitApproveTx()
      setShowLedgerModal('none')
    }

    const chainAsString = chainToString(sourceChain)
    const txtNeedsConnected = intl.formatMessage(
      {
        id: 'ledger.needsconnected'
      },
      { chain: chainAsString }
    )

    const description1 =
      // extra info for ERC20 assets only
      isEvmChain(sourceAsset.chain) && isEvmToken(sourceAsset)
        ? `${txtNeedsConnected} ${intl.formatMessage(
            {
              id: 'ledger.blindsign'
            },
            { chain: chainAsString }
          )}`
        : txtNeedsConnected

    const description2 = intl.formatMessage({ id: 'ledger.sign' })

    return (
      <LedgerConfirmationModal
        key="leder-conf-modal"
        network={network}
        onSuccess={onSucceess}
        onClose={onClose}
        visible={visible}
        chain={sourceChain}
        description1={description1}
        description2={description2}
        addresses={FP.pipe(
          oSwapParams,
          O.chain(({ poolAddress, sender }) => {
            const recipient = poolAddress.address
            if (useSourceAssetLedger) return O.some({ recipient, sender })
            return O.none
          })
        )}
      />
    )
  }, [
    showLedgerModal,
    sourceChain,
    intl,
    sourceAsset,
    network,
    oSwapParams,
    submitSwapTx,
    submitApproveTx,
    useSourceAssetLedger
  ])

  const sourceChainFeeError: boolean = useMemo(() => {
    // ignore error check by having zero amounts or min amount errors
    if (isZeroAmountToSwap) return false

    const {
      inFee: { amount: inFeeAmount }
    } = swapFees
    return inFeeAmount.gt(sourceChainAssetAmount)
  }, [isZeroAmountToSwap, swapFees, sourceChainAssetAmount])

  const quoteError: JSX.Element = useMemo(() => {
    if (quoteErrors.length === 0) {
      return <></>
    }

    if (lockedWallet || quoteOnly) {
      return <></>
    }
    const error = quoteErrors[0].split(':')
    const assetPart = error.length === 3 ? error[2].split('(')[1]?.split(')')[0] : undefined
    if (!lockedWallet && assetPart === `${targetAsset.chain}.${targetAsset.symbol}`) {
      return <ErrorLabel>{intl.formatMessage({ id: 'swap.errors.pool.notAvailable' }, { pool: assetPart })}</ErrorLabel>
    }

    // Extract numerical value from error string
    const match = error[1].match(/(\d+)/)
    const numberString = match ? match[1] : null
    const remainingText = error[1].replace(/\d+/g, '').trim()

    const assetAmount = numberString
      ? new CryptoAmount(convertBaseAmountDecimal(baseAmount(numberString), sourceAssetDecimal), sourceAsset)
      : new CryptoAmount(baseAmount(0), sourceAsset)

    return (
      <ErrorLabel>
        {numberString
          ? intl.formatMessage(
              { id: 'swap.errors.amount.thornodeQuoteError' },
              { error: `${assetAmount.formatedAssetString()} ${remainingText}` }
            )
          : intl.formatMessage({ id: 'swap.errors.amount.thornodeQuoteError' }, { error: error[1] })}
      </ErrorLabel>
    )
  }, [
    quoteErrors,
    lockedWallet,
    quoteOnly,
    targetAsset.chain,
    targetAsset.symbol,
    sourceAssetDecimal,
    sourceAsset,
    intl
  ])

  const sourceChainFeeErrorLabel: JSX.Element = useMemo(() => {
    if (!sourceChainFeeError) {
      return <></>
    }

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
  }, [sourceChainFeeError, swapFees, intl, sourceChainAsset, sourceChainAssetAmount])

  // Label: Min amount to swap (<= 1e8)
  const swapMinResultLabel = useMemo(() => {
    // for label we do need to convert decimal back to original decimal
    const amount: BaseAmount = FP.pipe(
      swapLimit1e8,
      O.fold(
        () => baseAmount(0, targetAssetDecimal) /* assetAmount1e8 */,
        (limit1e8) => convertBaseAmountDecimal(limit1e8, targetAssetDecimal)
      )
    )

    const amountMax1e8 = max1e8BaseAmount(amount)

    return disableSlippage
      ? noDataString
      : `${formatAssetAmountCurrency({
          asset: targetAsset,
          amount: baseToAsset(amountMax1e8),
          trimZeros: true
        })}`
  }, [swapLimit1e8, disableSlippage, targetAsset, targetAssetDecimal])

  const uiApproveFeesRD: UIFeesRD = useMemo(
    () =>
      FP.pipe(
        approveFeeRD,
        RD.map((approveFee) => [{ asset: sourceChainAsset, amount: approveFee }])
      ),
    [approveFeeRD, sourceChainAsset]
  )

  const isApproveFeeError = useMemo(() => {
    // ignore error check if we don't need to check allowance
    if (O.isNone(needApprovement)) return false

    return sourceChainAssetAmount.lt(approveFee)
  }, [needApprovement, sourceChainAssetAmount, approveFee])

  const renderApproveFeeError: JSX.Element = useMemo(() => {
    if (
      !isApproveFeeError ||
      // Don't render anything if chainAssetBalance is not available (still loading)
      O.isNone(oSourceAssetWB) ||
      // Don't render error if walletBalances are still loading
      walletBalancesLoading
    ) {
      return <></>
    }

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
    walletBalancesLoading,
    intl,
    sourceChainAsset,
    sourceChainAssetAmount,
    approveFee
  ])

  const onApprove = useCallback(() => {
    if (useSourceAssetLedger) {
      setShowLedgerModal('approve')
    } else {
      setShowPasswordModal('approve')
    }
  }, [setShowLedgerModal, useSourceAssetLedger])

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

  const isApproved = useMemo(
    () =>
      O.isNone(needApprovement) ||
      RD.isSuccess(approveState) ||
      FP.pipe(
        isApprovedState,
        // ignore other RD states and set to `true`
        // to avoid switch between approve and submit button
        // Submit button will still be disabled
        RD.getOrElse(() => true)
      ),
    [approveState, isApprovedState, needApprovement]
  )

  const checkIsApproved = useMemo(() => {
    if (O.isNone(needApprovement)) return false
    // ignore initial + loading states for `isApprovedState`
    return RD.isPending(isApprovedState)
  }, [isApprovedState, needApprovement])

  const checkIsApprovedError = useMemo(() => {
    // ignore error check if we don't need to check allowance
    if (O.isNone(needApprovement)) return false
    return RD.isFailure(isApprovedState)
  }, [needApprovement, isApprovedState])

  const renderIsApprovedError = useMemo(() => {
    if (!checkIsApprovedError) return <></>

    return FP.pipe(
      isApprovedState,
      RD.fold(
        () => <></>,
        () => <></>,
        (error) => (
          <ErrorLabel>
            {intl.formatMessage({ id: 'common.approve.error' }, { asset: sourceAsset.ticker, error: error.msg })}
          </ErrorLabel>
        ),
        (_) => <></>
      )
    )
  }, [checkIsApprovedError, intl, isApprovedState, sourceAsset.ticker])

  const priceApproveFee: CryptoAmount = useMemo(() => {
    const assetAmount = isApproved
      ? new CryptoAmount(approveFee, swapFees.inFee.asset)
      : new CryptoAmount(baseAmount(0), swapFees.inFee.asset)

    const result = FP.pipe(
      isPoolDetails(poolDetails)
        ? PoolHelpers.getUSDValue({
            balance: { asset: assetAmount.asset, amount: assetAmount.baseAmount },
            poolDetails,
            pricePool: pricePoolThor
          })
        : FP.pipe(
            PoolHelpersMaya.getUSDValue({
              balance: { asset: assetAmount.asset, amount: assetAmount.baseAmount },
              poolDetails,
              pricePool: pricePoolMaya
            })
          ),
      O.getOrElse(() => baseAmount(0, amountToSwapMax1e8.decimal))
    )
    return new CryptoAmount(result, pricePoolThor.asset)
  }, [
    isApproved,
    approveFee,
    swapFees.inFee.asset,
    poolDetails,
    pricePoolThor,
    pricePoolMaya,
    amountToSwapMax1e8.decimal
  ])

  const priceApproveFeeLabel = useMemo(
    () =>
      FP.pipe(
        approveFeeRD,
        RD.fold(
          () => loadingString,
          () => loadingString,
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
    // reset data whenever source asset has been changed
    if (O.some(prevSourceAsset.current) && !eqOAsset.equals(prevSourceAsset.current, O.some(sourceAsset))) {
      reloadFeesHandler()
      resetIsApprovedState()
      resetApproveState()
    } else {
      prevSourceAsset.current = O.some(sourceAsset)
    }
    if (!eqOAsset.equals(prevTargetAsset.current, O.some(targetAsset))) {
      prevTargetAsset.current = O.some(targetAsset)
    }
  }, [reloadFeesHandler, resetApproveState, resetIsApprovedState, resetSwapState, sourceAsset, targetAsset])

  const onSwitchAssets = useCallback(async () => {
    // delay to avoid render issues while switching
    await delay(100)
    setAmountToSwapMax1e8(initialAmountToSwapMax1e8)
    // setQuote(O.none)
    // setQuoteMaya(O.none)
    const walletType = FP.pipe(
      oTargetWalletType,
      O.getOrElse<WalletType>(() => WalletType.Keystore)
    )

    onChangeAsset({
      source: targetAsset,
      sourceWalletType: walletType,
      target: sourceAsset,
      targetWalletType: O.some(sourceWalletType),
      recipientAddress: oSourceWalletAddress
    })
  }, [
    initialAmountToSwapMax1e8,
    oSourceWalletAddress,
    oTargetWalletType,
    onChangeAsset,
    setAmountToSwapMax1e8,
    sourceAsset,
    sourceWalletType,
    targetAsset
  ])

  const disableSubmit: boolean = useMemo(
    () =>
      network !== Network.Stagenet &&
      (disableSwapAction ||
        lockedWallet ||
        quoteOnly ||
        isZeroAmountToSwap ||
        walletBalancesLoading ||
        sourceChainFeeError ||
        RD.isPending(swapFeesRD) ||
        RD.isPending(approveState) ||
        isCausedSlippage ||
        swapResultAmountMax.baseAmount.lte(zeroTargetBaseAmountMax1e8) ||
        O.isNone(oRecipientAddress) ||
        !canSwap ||
        customAddressEditActive ||
        quoteExpired ||
        isTargetChainDisabled ||
        isSourceChainDisabled),
    [
      network,
      disableSwapAction,
      lockedWallet,
      quoteOnly,
      isZeroAmountToSwap,
      walletBalancesLoading,
      sourceChainFeeError,
      swapFeesRD,
      approveState,
      isCausedSlippage,
      swapResultAmountMax.baseAmount,
      zeroTargetBaseAmountMax1e8,
      oRecipientAddress,
      canSwap,
      customAddressEditActive,
      quoteExpired,
      isTargetChainDisabled,
      isSourceChainDisabled
    ]
  )

  const disableSubmitApprove = useMemo(
    () => checkIsApprovedError || isApproveFeeError || walletBalancesLoading || O.isNone(oApproveParams),

    [checkIsApprovedError, isApproveFeeError, oApproveParams, walletBalancesLoading]
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
      // Check and show wallet type while typing a custom recipient address
      const walletType = getTargetWalletTypeByAddress(address)
      setTargetWalletType(walletType)
    },
    [getTargetWalletTypeByAddress]
  )

  const onClickUseSourceAssetLedger = useCallback(
    (useLedger: boolean) => {
      setAmountToSwapMax1e8(initialAmountToSwapMax1e8)
      onChangeAsset({
        source: sourceAsset,
        target: targetAsset,
        sourceWalletType: useLedger ? WalletType.Ledger : WalletType.Keystore,
        targetWalletType: oTargetWalletType,
        recipientAddress: oRecipientAddress
      })
    },
    [
      initialAmountToSwapMax1e8,
      oRecipientAddress,
      oTargetWalletType,
      onChangeAsset,
      setAmountToSwapMax1e8,
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
        targetWalletType: O.some(useLedger ? WalletType.Ledger : WalletType.Keystore),
        recipientAddress: useLedger ? oTargetLedgerAddress : oTargetKeystoreAddress
      })
    },
    [oTargetLedgerAddress, oTargetKeystoreAddress, onChangeAsset, sourceAsset, sourceWalletType, targetAsset]
  )

  const memoTitle = useMemo(
    () =>
      FP.pipe(
        oSwapParams,
        O.map(({ memo }) => memo),
        O.getOrElse(() => emptyString),
        (memo: string) => (
          <CopyLabel
            className="pl-0 !font-mainBold text-[14px] uppercase text-gray2 dark:text-gray2d"
            label={intl.formatMessage({ id: 'common.memo' })}
            key="memo-copy"
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
  // Time of transaction from source chain and quote details
  const TransactionTime = () => {
    const transactionTime = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => 0,
        (txDetails) => txDetails.totalSwapSeconds
      )
    )

    return (
      <>
        <div className={`flex w-full justify-between ${showDetails ? 'pt-10px' : ''} font-mainBold text-[14px]`}>
          <div>{intl.formatMessage({ id: 'common.time.title' })}</div>
          <div>{formatSwapTime(transactionTime)}</div>
        </div>
        {showDetails && (
          <>
            <div className="flex w-full justify-between pl-10px text-[12px]">
              <div className="flex items-center">{intl.formatMessage({ id: 'common.inbound.time' })}</div>
              <div>{formatSwapTime(Number(DefaultChainAttributes[sourceChain].avgBlockTimeInSecs))}</div>
            </div>
            <div className="flex w-full justify-between pl-10px text-[12px]">
              <div className="flex items-center">
                {intl.formatMessage(
                  { id: 'common.confirmation.time' },
                  { chain: targetAsset.type === AssetType.SYNTH ? THORChain : targetAsset.chain }
                )}
              </div>
              <div>{formatSwapTime(Number(DefaultChainAttributes[targetAsset.chain].avgBlockTimeInSecs))}</div>
            </div>
          </>
        )}
      </>
    )
  }

  const [showDetails, setShowDetails] = useState<boolean>(false)

  return (
    <div className="my-20px flex w-full max-w-[500px] flex-col justify-between">
      <div>
        {/* Note: Input value is shown as AssetAmount */}
        <Row>
          <FlatButton
            onClick={quoteOnlyButton}
            size="small"
            color={quoteOnly ? 'warning' : 'primary'}
            className="mb-20px  rounded-full hover:shadow-full group-hover:rotate-180 dark:hover:shadow-fulld">
            {quoteOnly ? 'Preview Only' : 'Preview & Swap'}
          </FlatButton>
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
        </Row>
        <AssetInput
          className="w-full"
          title={intl.formatMessage({ id: 'swap.input' })}
          amount={{ amount: amountToSwapMax1e8, asset: sourceAsset }}
          priceAmount={{ asset: priceAmountToSwapMax1e8.asset, amount: priceAmountToSwapMax1e8.baseAmount }}
          assets={selectableSourceAssets}
          walletBalance={sourceAssetAmountMax1e8}
          network={network}
          hasAmountShortcut
          onChangeAsset={setSourceAsset}
          onChange={setAmountToSwapMax1e8}
          onChangePercent={setAmountToSwapFromPercentValue}
          onBlur={reloadFeesHandler}
          // showError={minAmountError}
          hasLedger={hasSourceAssetLedger}
          useLedger={useSourceAssetLedger}
          useLedgerHandler={onClickUseSourceAssetLedger}
        />
        <div className="relative mt-1 flex flex-col">
          <AssetInput
            className="w-full md:w-auto"
            title={intl.formatMessage({ id: 'swap.output' })}
            // Show swap result <= 1e8
            amount={{
              amount: swapResultAmountMax.baseAmount,
              asset: targetAsset
            }}
            priceAmount={priceSwapResultAmountMax1e8}
            onChangeAsset={setTargetAsset}
            assets={selectableTargetAssets}
            network={network}
            asLabel
            useLedger={useTargetAssetLedger}
            useLedgerHandler={onClickUseTargetAssetLedger}
            hasLedger={hasTargetAssetLedger}
          />
          <div className="absolute -top-[32px] left-[calc(50%-30px)] flex w-full flex-col justify-center">
            <div className="w-60px h-60px">
              <BaseButton
                size="small"
                onClick={onSwitchAssets}
                className="group rounded-full border border-solid border-turquoise bg-bg0 !p-10px hover:rotate-180 hover:shadow-full dark:bg-bg0d dark:hover:shadow-fulld">
                <ArrowsUpDownIcon className="ease h-[40px] w-[40px] text-turquoise " />
              </BaseButton>
            </div>
          </div>
        </div>
        <div className="mt-1 space-y-1">
          <Collapse
            header={
              <div className="flex flex-row items-center justify-between">
                <span className="m-0 font-main text-[14px] text-gray2 dark:text-gray2d">
                  {intl.formatMessage({ id: 'common.swap' })} {intl.formatMessage({ id: 'common.settings' })} (
                  {labelMin})
                </span>
              </div>
            }>
            <div className="flex flex-col p-4">
              <div className="flex w-full flex-col space-y-4 px-2">
                <div>{renderStreamerInterval}</div>
                <div>{renderStreamerQuantity}</div>
              </div>
              <div className="flex justify-end">
                <TooltipAddress title="Reset to streaming default">
                  <BaseButton
                    onClick={resetToDefault}
                    className="rounded-full hover:shadow-full group-hover:rotate-180 dark:hover:shadow-fulld">
                    <ArrowPathIcon className="ease h-[25px] w-[25px] text-turquoise" />
                  </BaseButton>
                </TooltipAddress>
              </div>
            </div>
          </Collapse>
          <Collapse
            header={
              <div className="flex flex-row items-center justify-between">
                <span className="m-0 font-main text-[14px] text-gray2 dark:text-gray2d">
                  {intl.formatMessage({ id: 'common.swap' })} {intl.formatMessage({ id: 'common.details' })}
                </span>
              </div>
            }>
            {!isLocked(keystore) ? (
              <div className="w-full px-4 pb-4 font-main text-[12px] uppercase dark:border-gray1d">
                <BaseButton
                  className="group flex w-full justify-between !p-0 font-mainSemiBold text-[16px] text-text2 hover:text-turquoise dark:text-text2d dark:hover:text-turquoise"
                  onClick={() => setShowDetails((current) => !current)}>
                  {intl.formatMessage({ id: 'common.details' })}
                  {showDetails ? (
                    <MagnifyingGlassMinusIcon className="ease h-[20px] w-[20px] text-inherit group-hover:scale-125" />
                  ) : (
                    <MagnifyingGlassPlusIcon className="ease h-[20px] w-[20px] text-inherit group-hover:scale-125 " />
                  )}
                </BaseButton>

                <div className="pt-10px font-main text-[14px] text-gray2 dark:text-gray2d">
                  {/* Rate */}
                  <div className="flex w-full justify-between font-mainBold text-[14px]">
                    <BaseButton
                      className="group !p-0 !font-mainBold !text-gray2 dark:!text-gray2d"
                      onClick={() =>
                        // toggle rate
                        setRateDirection((current) => (current === 'fromSource' ? 'fromTarget' : 'fromSource'))
                      }>
                      {intl.formatMessage({ id: 'common.rate' })}
                      <ArrowsRightLeftIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
                    </BaseButton>
                    <div>{rateLabel}</div>
                  </div>
                  {/* fees */}
                  <div className="flex w-full items-center justify-between font-mainBold">
                    <BaseButton
                      disabled={RD.isPending(swapFeesRD) || RD.isInitial(swapFeesRD)}
                      className="group !p-0 !font-mainBold !text-gray2 dark:!text-gray2d"
                      onClick={reloadFeesHandler}>
                      {intl.formatMessage({ id: 'common.fees.estimated' })}
                      <ArrowPathIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
                    </BaseButton>
                    <div>{priceSwapFeesLabel}</div>
                  </div>

                  {showDetails && (
                    <>
                      {O.isSome(needApprovement) && (
                        <div className="flex w-full justify-between pl-10px text-[12px]">
                          <div>{intl.formatMessage({ id: 'common.approve' })}</div>
                          <div>{priceApproveFeeLabel}</div>
                        </div>
                      )}
                      <div className="flex w-full justify-between pl-10px text-[12px]">
                        <div>{intl.formatMessage({ id: 'common.fee.inbound' })}</div>
                        <div>{priceSwapInFeeLabel}</div>
                      </div>
                      <div className="flex w-full justify-between pl-10px text-[12px]">
                        <div>{intl.formatMessage({ id: 'common.fee.outbound' })}</div>
                        <div>{priceSwapOutFeeLabel}</div>
                      </div>
                      <div className="flex w-full justify-between pl-10px text-[12px]">
                        <div>{intl.formatMessage({ id: 'common.fee.affiliate' })}</div>
                        <div>{priceAffiliateFeeLabel}</div>
                      </div>
                    </>
                  )}
                  {/* Slippage */}
                  {!isStreaming ? (
                    <>
                      <div
                        className={`flex w-full justify-between ${
                          showDetails ? 'pt-10px' : ''
                        } font-mainBold text-[14px] ${isCausedSlippage ? 'text-error0 dark:text-error0d' : ''}`}>
                        <div>{intl.formatMessage({ id: 'swap.slip.title' })}</div>
                        <div>
                          {formatAssetAmountCurrency({
                            amount: priceAmountToSwapMax1e8.assetAmount.times(
                              (swapSlippage > 0 ? swapSlippage : slipTolerance) / 100
                            ), // Find the value of swap slippage
                            asset: priceAmountToSwapMax1e8.asset,
                            decimal: isUSDAsset(priceAmountToSwapMax1e8.asset) ? 2 : 6,
                            trimZeros: !isUSDAsset(priceAmountToSwapMax1e8.asset)
                          }) + ` (${swapSlippage.toFixed(2)}%)`}
                        </div>
                      </div>

                      {showDetails && (
                        <>
                          <div className="flex w-full justify-between pl-10px text-[12px]">
                            <div
                              className={`flex items-center ${
                                disableSlippage ? 'text-warning0 dark:text-warning0d' : ''
                              }`}>
                              {intl.formatMessage({ id: 'swap.slip.tolerance' })}
                              {disableSlippage ? (
                                <InfoIcon
                                  className="ml-[3px] h-[15px] w-[15px] text-inherit"
                                  tooltip={intl.formatMessage({ id: 'swap.slip.tolerance.ledger-disabled.info' })}
                                  color="warning"
                                />
                              ) : (
                                <InfoIcon
                                  className="ml-[3px] h-[15px] w-[15px] text-inherit"
                                  tooltip={intl.formatMessage({ id: 'swap.slip.tolerance.info' })}
                                />
                              )}
                            </div>
                            <div>
                              {/* we don't show slippage tolerance whenever slippage is disabled (e.g. due memo restriction for Ledger BTC) */}
                              {disableSlippage ? (
                                <>{noDataString}</>
                              ) : (
                                <SelectableSlipTolerance value={slipTolerance} onChange={changeSlipTolerance} />
                              )}
                            </div>
                          </div>
                          <div className="flex w-full justify-between pl-10px text-[12px]">
                            <div
                              className={`flex items-center ${
                                disableSlippage ? 'text-warning0 dark:text-warning0d' : ''
                              }`}>
                              {intl.formatMessage({ id: 'swap.min.result.protected' })}
                              <InfoIcon
                                className="ml-[3px] h-[15px] w-[15px] text-inherit"
                                tooltip={
                                  disableSlippage
                                    ? intl.formatMessage({ id: 'swap.slip.tolerance.ledger-disabled.info' })
                                    : intl.formatMessage({ id: 'swap.min.result.info' }, { tolerance: slipTolerance })
                                }
                              />
                            </div>
                            <div>{swapMinResultLabel}</div>
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div
                        className={`flex w-full justify-between ${
                          showDetails ? 'pt-10px' : ''
                        } font-mainBold text-[14px] ${isCausedSlippage ? 'text-error0 dark:text-error0d' : ''}`}>
                        <div>{intl.formatMessage({ id: 'swap.slip.title' })}</div>
                        <div>
                          {formatAssetAmountCurrency({
                            amount: priceAmountToSwapMax1e8.assetAmount.times(swapSlippage / 100), // Find the value of swap slippage
                            asset: priceAmountToSwapMax1e8.asset,
                            decimal: isUSDAsset(priceAmountToSwapMax1e8.asset) ? 2 : 6,
                            trimZeros: !isUSDAsset(priceAmountToSwapMax1e8.asset)
                          }) + ` (${swapSlippage.toFixed(2)}%)`}
                        </div>
                      </div>
                      {showDetails && (
                        <>
                          <div className="flex w-full justify-between pl-10px text-[12px]">
                            <div className={`flex items-center `}>
                              {intl.formatMessage({ id: 'swap.streaming.interval' })}
                              <InfoIcon
                                className="ml-[3px] h-[15px] w-[15px] text-inherit"
                                tooltip={intl.formatMessage({ id: 'swap.streaming.interval.info' })}
                              />
                            </div>
                            <div>{streamingInterval}</div>
                          </div>
                          <div className="flex w-full justify-between pl-10px text-[12px]">
                            <div className={`flex items-center`}>
                              {intl.formatMessage({ id: 'swap.streaming.quantity' })}
                              <InfoIcon
                                className="ml-[3px] h-[15px] w-[15px] text-inherit"
                                tooltip={intl.formatMessage({ id: 'swap.streaming.quantity.info' })}
                              />
                            </div>
                            <div>{streamingQuantity}</div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  {/* Swap Time Inbound / swap / Outbound */}
                  <TransactionTime />
                  {/* addresses */}
                  {showDetails && (
                    <>
                      <div className={`w-full pt-10px font-mainBold text-[14px]`}>
                        {intl.formatMessage({ id: 'common.addresses' })}
                      </div>
                      {/* sender address */}
                      <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                        <div>{intl.formatMessage({ id: 'common.sender' })}</div>
                        <div className="truncate pl-20px text-[13px] normal-case leading-normal">
                          {FP.pipe(
                            oSourceWalletAddress,
                            O.map((address) => (
                              <TooltipAddress title={address} key="tooltip-sender-addr">
                                {hidePrivateData ? hiddenString : address}
                              </TooltipAddress>
                            )),
                            O.getOrElse(() => <>{noDataString}</>)
                          )}
                        </div>
                      </div>
                      {/* recipient address */}
                      <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                        <div>{intl.formatMessage({ id: 'common.recipient' })}</div>
                        <div className="truncate pl-20px text-[13px] normal-case leading-normal">
                          {FP.pipe(
                            oRecipientAddress,
                            O.map((address) => (
                              <TooltipAddress title={address} key="tooltip-target-addr">
                                {hidePrivateData ? hiddenString : address}
                              </TooltipAddress>
                            )),
                            O.getOrElse(() => <>{noDataString}</>)
                          )}
                        </div>
                      </div>
                      {/* inbound address */}
                      {FP.pipe(
                        oSwapParams,
                        O.map(({ poolAddress: { address }, asset }) =>
                          address && asset.type !== AssetType.SYNTH ? (
                            <div
                              className="flex w-full items-center justify-between pl-10px text-[12px]"
                              key="pool-addr">
                              <div>{intl.formatMessage({ id: 'common.pool.inbound' })}</div>
                              <TooltipAddress title={address}>
                                <div className="truncate pl-20px text-[13px] normal-case leading-normal">{address}</div>
                              </TooltipAddress>
                            </div>
                          ) : null
                        ),
                        O.toNullable
                      )}
                    </>
                  )}

                  {/* balances */}
                  {showDetails && (
                    <>
                      <div className={`w-full pt-10px text-[14px]`}>
                        <BaseButton
                          disabled={walletBalancesLoading}
                          className="group !p-0 !font-mainBold !text-gray2 dark:!text-gray2d"
                          onClick={reloadBalances}>
                          {intl.formatMessage({ id: 'common.balances' })}
                          <ArrowPathIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
                        </BaseButton>
                      </div>
                      {/* sender balance */}
                      <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                        <div>{intl.formatMessage({ id: 'common.sender' })}</div>
                        <div className="truncate pl-20px text-[13px] normal-case leading-normal">
                          {walletBalancesLoading
                            ? loadingString
                            : hidePrivateData
                            ? hiddenString
                            : formatAssetAmountCurrency({
                                amount: baseToAsset(sourceAssetAmountMax1e8),
                                asset: sourceAsset,
                                decimal: 8,
                                trimZeros: true
                              })}
                        </div>
                      </div>
                    </>
                  )}
                  {/* memo */}
                  {showDetails && (
                    <>
                      <div className="ml-[-2px] flex w-full items-start pt-10px font-mainBold text-[14px]">
                        {memoTitle}
                      </div>
                      <div className="truncate pl-10px font-main text-[12px]">
                        {hidePrivateData ? hiddenString : memoLabel}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="w-full px-4 pb-4 font-main text-[12px] uppercase dark:border-gray1d">
                  <div className="font-main text-[14px] text-gray2 dark:text-gray2d">
                    {/* Rate */}
                    <div className={`flex w-full justify-between font-mainBold text-[14px]`}>
                      <BaseButton
                        className="group !p-0 !font-mainBold !text-gray2 dark:!text-gray2d"
                        onClick={() =>
                          // toggle rate
                          setRateDirection((current) => (current === 'fromSource' ? 'fromTarget' : 'fromSource'))
                        }>
                        {intl.formatMessage({ id: 'common.rate' })}
                        <ArrowsRightLeftIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
                      </BaseButton>
                      <div>{rateLabel}</div>
                    </div>
                    {/* fees */}
                    <div className="flex w-full items-center justify-between font-mainBold">
                      <BaseButton
                        disabled={RD.isPending(swapFeesRD) || RD.isInitial(swapFeesRD)}
                        className="group !p-0 !font-mainBold !text-gray2 dark:!text-gray2d"
                        onClick={reloadFeesHandler}>
                        {intl.formatMessage({ id: 'common.fees.estimated' })}
                        <ArrowPathIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
                      </BaseButton>
                      <div>{priceSwapFeesLabel}</div>
                    </div>
                    <div className="flex w-full justify-between pl-10px text-[12px]">
                      <div>{intl.formatMessage({ id: 'common.fee.inbound' })}</div>
                      <div>{priceSwapInFeeLabel}</div>
                    </div>
                    <div className="flex w-full justify-between pl-10px text-[12px]">
                      <div>{intl.formatMessage({ id: 'swap.slip.title' })}</div>
                      <div>
                        {formatAssetAmountCurrency({
                          amount: priceAmountToSwapMax1e8.assetAmount.times(swapSlippage / 100), // Find the value of swap slippage
                          asset: priceAmountToSwapMax1e8.asset,
                          decimal: isUSDAsset(priceAmountToSwapMax1e8.asset) ? 2 : 6,
                          trimZeros: !isUSDAsset(priceAmountToSwapMax1e8.asset)
                        }) + ` (${swapSlippage.toFixed(2)}%)`}
                      </div>
                    </div>
                    <div className="flex w-full justify-between pl-10px text-[12px]">
                      <div>{intl.formatMessage({ id: 'common.fee.outbound' })}</div>
                      <div>{priceSwapOutFeeLabel}</div>
                    </div>
                    <div className="flex w-full justify-between pl-10px text-[12px]">
                      <div>{intl.formatMessage({ id: 'common.fee.affiliate' })}</div>
                      <div>{priceAffiliateFeeLabel}</div>
                    </div>

                    {/* Transaction time */}
                    <TransactionTime />
                  </div>
                </div>
              </>
            )}
          </Collapse>
          {!lockedWallet &&
            FP.pipe(
              oRecipientAddress,
              O.map((address) => (
                <div
                  className="flex flex-col rounded-lg border border-solid border-gray1 px-4 py-2 dark:border-gray0d"
                  key="edit-address">
                  <div className="flex items-center">
                    <h3 className="font-[12px] !mb-0 mr-10px w-auto p-0 font-main uppercase text-gray2 dark:text-gray2d">
                      {intl.formatMessage({ id: 'common.recipient' })}
                    </h3>
                    <WalletTypeLabel key="target-w-type">{getWalletTypeLabel(oTargetWalletType, intl)}</WalletTypeLabel>
                  </div>
                  <EditableAddress
                    key={address}
                    asset={targetAsset}
                    network={network}
                    address={address}
                    onChangeAddress={onChangeRecipientAddress}
                    onChangeEditableAddress={onChangeEditableRecipientAddress}
                    onChangeEditableMode={(editModeActive) => setCustomAddressEditActive(editModeActive)}
                    addressValidator={addressValidator}
                    hidePrivateData={hidePrivateData}
                  />
                </div>
              )),
              O.toNullable
            )}
          {!isLocked(keystore) && amountToSwapMax1e8.gt(0) && <div className="w-full">{renderSwapExpiry}</div>}
        </div>
      </div>

      {(walletBalancesLoading || checkIsApproved) && (
        <LoadingView
          className="w-full pt-10px"
          label={
            // We show only one loading state at time
            // Order matters: Show states with shortest loading time before others
            // (approve state takes just a short time to load, but needs to be displayed)
            checkIsApproved
              ? intl.formatMessage({ id: 'common.approve.checking' }, { asset: sourceAsset.ticker })
              : walletBalancesLoading
              ? intl.formatMessage({ id: 'common.balance.loading' })
              : undefined
          }
        />
      )}
      <div className="flex flex-col items-center justify-center">
        {!isLocked(keystore) ? (
          <>
            {isApproved ? (
              <>
                <FlatButton
                  className="my-30px min-w-[200px]"
                  size="large"
                  color="primary"
                  onClick={onSubmit}
                  disabled={disableSubmit}>
                  {intl.formatMessage({ id: 'common.swap' })}
                </FlatButton>
                {sourceChainFeeErrorLabel}
                {quoteError}
              </>
            ) : (
              <>
                <FlatButton
                  className="my-30px min-w-[200px]"
                  size="large"
                  color="warning"
                  disabled={disableSubmitApprove}
                  onClick={onApprove}
                  loading={RD.isPending(approveState)}>
                  {intl.formatMessage({ id: 'common.approve' })}
                </FlatButton>

                {renderApproveFeeError}
                {renderApproveError}
                {renderIsApprovedError}

                {/* TODO(@veado) ADD ApproveFees to details */}

                {!RD.isInitial(uiApproveFeesRD) && (
                  <Fees fees={uiApproveFeesRD} reloadFees={reloadApproveFeesHandler} />
                )}
              </>
            )}
          </>
        ) : (
          <>
            <p className="center mb-0 mt-30px font-main text-[12px] uppercase text-text2 dark:text-text2d">
              {!hasImportedKeystore(keystore)
                ? intl.formatMessage({ id: 'swap.note.nowallet' })
                : isLocked(keystore) && intl.formatMessage({ id: 'swap.note.lockedWallet' })}
            </p>
            <FlatButton className="my-30px min-w-[200px]" size="large" onClick={importWalletHandler}>
              {!hasImportedKeystore(keystore)
                ? intl.formatMessage({ id: 'wallet.add.label' })
                : isLocked(keystore) && intl.formatMessage({ id: 'wallet.unlock.label' })}
            </FlatButton>
          </>
        )}
      </div>
      {renderPasswordConfirmationModal}
      {renderLedgerConfirmationModal}
      {renderTxModal}
    </div>
  )
}
