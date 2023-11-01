import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import {
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  ArrowsUpDownIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon
} from '@heroicons/react/24/outline'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import {
  CryptoAmount,
  QuoteSwapParams,
  ThorchainQuery,
  TxDetails
  // ChainAttributes
} from '@xchainjs/xchain-thorchain-query'
import {
  Asset,
  baseToAsset,
  BaseAmount,
  baseAmount,
  formatAssetAmountCurrency,
  delay,
  assetToBase,
  assetAmount,
  Address
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as O from 'fp-ts/Option'
import debounce from 'lodash/debounce'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as RxOp from 'rxjs/operators'

import { Network } from '../../../shared/api/types'
import { ASGARDEX_AFFILIATE_FEE, ASGARDEX_THORNAME } from '../../../shared/const'
import { chainToString } from '../../../shared/utils/chain'
import { isLedgerWallet } from '../../../shared/utils/guard'
import { WalletType } from '../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../const'
import {
  getEthTokenAddress,
  isEthAsset,
  isEthTokenAsset,
  max1e8BaseAmount,
  convertBaseAmountDecimal,
  to1e8BaseAmount,
  THORCHAIN_DECIMAL,
  isUSDAsset,
  isChainAsset,
  isRuneNativeAsset,
  isAvaxTokenAsset,
  isBscTokenAsset,
  getAvaxTokenAddress,
  getBscTokenAddress,
  isAvaxAsset,
  isBscAsset
} from '../../helpers/assetHelper'
import {
  getChainAsset,
  isAvaxChain,
  isBchChain,
  isBscChain,
  isBtcChain,
  isDogeChain,
  isEthChain,
  isLtcChain
} from '../../helpers/chainHelper'
import { unionAssets } from '../../helpers/fp/array'
import { eqAsset, eqBaseAmount, eqOAsset, eqOApproveParams, eqAddress } from '../../helpers/fp/eq'
import { sequenceSOption, sequenceTOption } from '../../helpers/fpHelpers'
import * as PoolHelpers from '../../helpers/poolHelper'
import { liveData, LiveData } from '../../helpers/rx/liveData'
import { emptyString, hiddenString, loadingString, noDataString } from '../../helpers/stringHelper'
import { calculateTransactionTime, formatSwapTime, Time } from '../../helpers/timeHelper'
import {
  filterWalletBalancesByAssets,
  getWalletBalanceByAssetAndWalletType,
  getWalletTypeLabel,
  hasLedgerInBalancesByAsset
} from '../../helpers/walletHelper'
// import { useMimirConstants } from '../../hooks/useMimirConstants'
import { useSubscriptionState } from '../../hooks/useSubscriptionState'
import { ChangeSlipToleranceHandler } from '../../services/app/types'
import { INITIAL_SWAP_STATE } from '../../services/chain/const'
import { getZeroSwapFees } from '../../services/chain/fees/swap'
import {
  SwapState,
  SwapTxParams,
  SwapStateHandler,
  SwapFeesHandler,
  ReloadSwapFeesHandler,
  SwapFeesRD,
  SwapFees,
  FeeRD
} from '../../services/chain/types'
import { AddressValidationAsync, GetExplorerTxUrl, OpenExplorerTxUrl } from '../../services/clients'
import {
  ApproveFeeHandler,
  ApproveParams,
  IsApprovedRD,
  IsApproveParams,
  LoadApproveFeeHandler
} from '../../services/evm/types'
import { PoolAddress, PoolDetails, PoolsDataMap } from '../../services/midgard/types'
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
import { AssetWithAmount, SlipTolerance } from '../../types/asgardex'
import { PricePool } from '../../views/pools/Pools.types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../modal/confirmation'
import { TxModal } from '../modal/tx'
import { SwapAssets } from '../modal/tx/extra'
import { LoadingView } from '../shared/loading'
import { AssetInput } from '../uielements/assets/assetInput'
import { BaseButton, FlatButton, ViewTxButton } from '../uielements/button'
import { MaxBalanceButton } from '../uielements/button/MaxBalanceButton'
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
  <div className={`mb-[14px] text-center font-main uppercase text-error0 dark:text-error0d ${className} text-[12px]`}>
    {children}
  </div>
)

export type SwapProps = {
  thorchainQuery: ThorchainQuery
  keystore: KeystoreState
  poolAssets: Asset[]
  assets: {
    source: SwapAsset
    target: SwapAsset
  }
  sourceKeystoreAddress: O.Option<Address>
  sourceLedgerAddress: O.Option<Address>
  sourceWalletType: WalletType
  targetWalletType: O.Option<WalletType>
  poolAddress: O.Option<PoolAddress>
  swap$: SwapStateHandler
  poolsData: PoolsDataMap
  pricePool: PricePool
  poolDetails: PoolDetails
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
    source: Asset
    target: Asset
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
  clickAddressLinkHandler: (address: Address) => void
  addressValidator: AddressValidationAsync
  hidePrivateData: boolean
}

export const Swap = ({
  thorchainQuery,
  keystore,
  poolAssets,
  assets: {
    source: { asset: sourceAsset, decimal: sourceAssetDecimal, price: sourceAssetPrice },
    target: { asset: targetAsset, decimal: targetAssetDecimal, price: targetAssetPrice }
  },
  poolAddress: oPoolAddress,
  swap$,
  poolDetails,
  pricePool,
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
  clickAddressLinkHandler,
  addressValidator,
  hidePrivateData
}: SwapProps) => {
  const intl = useIntl()

  const { chain: sourceChain } = sourceAsset.synth ? AssetRuneNative : sourceAsset

  const lockedWallet: boolean = useMemo(() => isLocked(keystore) || !hasImportedKeystore(keystore), [keystore])

  const useSourceAssetLedger = isLedgerWallet(initialSourceWalletType)
  const oSourceWalletAddress = useSourceAssetLedger ? oSourceLedgerAddress : oInitialSourceKeystoreAddress

  const useTargetAssetLedger = FP.pipe(
    oInitialTargetWalletType,
    O.map(isLedgerWallet),
    O.getOrElse(() => false)
  )

  // For normal quotes
  const [oQuote, setQuote] = useState<O.Option<TxDetails>>(O.none)

  // Default Streaming interval set to 0 blocks
  const [streamingInterval, setStreamingInterval] = useState<number>(3)
  // Default Streaming quantity set to 0 network computes the optimum
  const [streamingQuantity, setStreamingQuantity] = useState<number>(0)
  // Slide use state
  const [slider, setSlider] = useState<number>(30)

  const [oTargetWalletType, setTargetWalletType] = useState<O.Option<WalletType>>(oInitialTargetWalletType)

  const [isStreaming, setIsStreaming] = useState<Boolean>(true)

  // Update state needed - initial target walletAddress is loaded async and can be different at first run
  useEffect(() => {
    setTargetWalletType(oInitialTargetWalletType)
  }, [oInitialTargetWalletType])

  const { balances: oWalletBalances, loading: walletBalancesLoading } = walletBalances

  // ZERO `BaseAmount` for target Asset - original decimal
  const zeroTargetBaseAmountMax = useMemo(() => baseAmount(0, targetAssetDecimal), [targetAssetDecimal])

  // ZERO `BaseAmount` for target Asset <= 1e8
  const zeroTargetBaseAmountMax1e8 = useMemo(() => max1e8BaseAmount(zeroTargetBaseAmountMax), [zeroTargetBaseAmountMax])

  const prevSourceAsset = useRef<O.Option<Asset>>(O.none)
  const prevTargetAsset = useRef<O.Option<Asset>>(O.none)

  const [customAddressEditActive, setCustomAddressEditActive] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [quoteExpired, setQuoteExpired] = useState<boolean>(false)

  /**
   * All balances based on available assets to swap
   */
  const allBalances: WalletBalances = useMemo(
    () =>
      FP.pipe(
        oWalletBalances,
        // filter wallet balances to include assets available to swap only including synth balances
        O.map((balances) => filterWalletBalancesByAssets(balances, poolAssets)),
        O.getOrElse<WalletBalances>(() => [])
      ),
    [poolAssets, oWalletBalances]
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

      return isKeystoreAddress ? O.some('keystore') : isLedgerAddress ? O.some('ledger') : O.none
    },
    [oTargetLedgerAddress, oTargetKeystoreAddress]
  )
  const sourceWalletType: WalletType = useMemo(
    () => (useSourceAssetLedger ? 'ledger' : 'keystore'),
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

  /** Balance of source asset converted to <= 1e8 */
  const sourceAssetAmountMax1e8: BaseAmount = useMemo(() => max1e8BaseAmount(sourceAssetAmount), [sourceAssetAmount])

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

  // Balance of target asset
  // Note: Users balances included in its wallet are checked only. Custom (not users) balances are ignored.
  const oTargetAssetAmount: O.Option<BaseAmount> = useMemo(
    () =>
      FP.pipe(
        allBalances,
        NEA.fromArray,
        (oWalletBalances) =>
          FP.pipe(
            oTargetWalletType,
            O.chain((walletType) =>
              getWalletBalanceByAssetAndWalletType({
                oWalletBalances,
                asset: targetAsset,
                walletType
              })
            )
          ),
        O.map(({ amount }) => amount)
      ),
    [allBalances, oTargetWalletType, targetAsset]
  )

  // Formatted balances of target asset.
  // Note: Users balances included in its wallet are checked only. Balances of custom (not users) balances are not shown.
  const targetAssetAmountLabel = useMemo(
    () =>
      FP.pipe(
        oTargetAssetAmount,
        O.map((amount) =>
          formatAssetAmountCurrency({
            amount: baseToAsset(amount),
            asset: targetAsset,
            decimal: 8,
            trimZeros: true
          })
        ),
        O.getOrElse(() =>
          O.isSome(oTargetWalletType)
            ? // Zero balances are hidden, but we show a zero amount for users wallets (ledger or keystore)
              formatAssetAmountCurrency({
                amount: assetAmount(0, targetAssetDecimal),
                asset: targetAsset,
                decimal: 0
              })
            : // for unknown recipient we show nothing (for privacy)
              noDataString
        )
      ),
    [oTargetAssetAmount, oTargetWalletType, targetAsset, targetAssetDecimal]
  )

  const {
    state: swapState,
    reset: resetSwapState,
    subscribe: subscribeSwapState
  } = useSubscriptionState<SwapState>(INITIAL_SWAP_STATE)

  const initialAmountToSwapMax1e8 = useMemo(
    () => baseAmount(0, sourceAssetAmountMax1e8.decimal),
    [sourceAssetAmountMax1e8]
  )

  const [
    /* max. 1e8 decimal */
    amountToSwapMax1e8,
    _setAmountToSwapMax1e8 /* private - never set it directly, use setAmountToSwapMax1e8() instead */
  ] = useState(initialAmountToSwapMax1e8)

  const priceAmountToSwapMax1e8: CryptoAmount = useMemo(() => {
    const result = FP.pipe(
      PoolHelpers.getPoolPriceValue({
        balance: { asset: sourceAsset, amount: amountToSwapMax1e8 },
        poolDetails,
        pricePool,
        network
      }),
      O.getOrElse(() => baseAmount(0, amountToSwapMax1e8.decimal)),
      (amount) => ({ asset: pricePool.asset, amount })
    )
    return new CryptoAmount(result.amount, result.asset)
  }, [amountToSwapMax1e8, network, poolDetails, pricePool, sourceAsset])

  const isZeroAmountToSwap = useMemo(() => amountToSwapMax1e8.amount().isZero(), [amountToSwapMax1e8])

  const zeroSwapFees = useMemo(
    () => getZeroSwapFees({ inAsset: sourceAsset, outAsset: targetAsset }),
    [sourceAsset, targetAsset]
  )

  const prevChainFees = useRef<O.Option<SwapFees>>(O.none)

  const [swapFeesRD] = useObservableState<SwapFeesRD>(() => {
    return FP.pipe(
      fees$({
        inAsset: sourceAsset,
        outAsset: targetAsset
      }),
      liveData.map((chainFees) => {
        // store every successfully loaded chainFees to the ref value
        prevChainFees.current = O.some(chainFees)
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

  // Price of swap IN fee
  const oPriceSwapInFee: O.Option<CryptoAmount> = useMemo(() => {
    const assetAmount = new CryptoAmount(swapFees.inFee.amount, swapFees.inFee.asset)
    return FP.pipe(
      PoolHelpers.getPoolPriceValue({
        balance: { asset: assetAmount.asset, amount: assetAmount.baseAmount },
        poolDetails,
        pricePool,
        network
      }),
      O.map((amount) => new CryptoAmount(amount, pricePool.asset))
    )
  }, [network, poolDetails, pricePool, swapFees])

  const priceSwapInFeeLabel = useMemo(
    () =>
      FP.pipe(
        swapFeesRD,
        RD.fold(
          () => loadingString,
          () => loadingString,
          () => noDataString,
          ({ inFee: { amount, asset: feeAsset } }) => {
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
          }
        )
      ),

    [oPriceSwapInFee, swapFeesRD]
  )
  // get outbound fee from quote response
  const oSwapOutFee: CryptoAmount = useMemo(() => {
    const amount = swapFees.outFee.amount
    const result = FP.pipe(
      sequenceTOption(oQuote),
      O.fold(
        () => new CryptoAmount(baseAmount(amount.amount(), targetAssetDecimal), targetAsset),
        ([txDetails]) => {
          const txOutFee = txDetails.txEstimate.totalFees.outboundFee
          return txOutFee
        }
      )
    )
    return result
  }, [oQuote, swapFees.outFee.amount, targetAsset, targetAssetDecimal])

  const [outFeePriceValue, setOutFeePriceValue] = useState<CryptoAmount>(
    new CryptoAmount(baseAmount(0, targetAssetDecimal), targetAsset)
  )

  // useEffect to fetch data from query
  useEffect(() => {
    const fetchData = async () => {
      setOutFeePriceValue(await thorchainQuery.convert(oSwapOutFee, pricePool.asset))
    }

    fetchData()
  }, [thorchainQuery, oSwapOutFee, pricePool.asset])

  const priceSwapOutFeeLabel = useMemo(
    () =>
      FP.pipe(
        swapFeesRD,
        RD.fold(
          () => loadingString,
          () => loadingString,
          () => noDataString,
          (_) =>
            FP.pipe(
              O.some(oSwapOutFee),
              O.fold(
                () => '',
                (outFee: CryptoAmount) => {
                  const fee = formatAssetAmountCurrency({
                    amount: outFee.assetAmount,
                    asset: outFee.asset,
                    decimal: isUSDAsset(outFee.asset) ? 2 : 6,
                    trimZeros: !isUSDAsset(outFee.asset)
                  })

                  const price = FP.pipe(
                    O.some(outFeePriceValue),
                    O.map((cryptoAmount: CryptoAmount) =>
                      eqAsset.equals(outFee.asset, cryptoAmount.asset)
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
    [swapFeesRD, oSwapOutFee, outFeePriceValue]
  )

  // Affiliate fee
  const affiliateFee: CryptoAmount = useMemo(
    () =>
      FP.pipe(
        oQuote,
        O.fold(
          () => new CryptoAmount(baseAmount(0), AssetRuneNative), // default affiliate fee asset amount
          (txDetails) => txDetails.txEstimate.totalFees.affiliateFee
        )
      ),
    [oQuote]
  )

  // store affiliate fee
  const [affiliatePriceValue, setAffiliatePriceValue] = useState<CryptoAmount>(
    new CryptoAmount(baseAmount(0, targetAssetDecimal), targetAsset)
  )

  // useEffect to fetch data from query
  useEffect(() => {
    const fetchData = async () => {
      setAffiliatePriceValue(await thorchainQuery.convert(affiliateFee, pricePool.asset))
    }

    fetchData()
  }, [thorchainQuery, affiliateFee, pricePool.asset])

  const priceAffiliateFeeLabel = useMemo(
    () =>
      FP.pipe(
        swapFeesRD,
        RD.fold(
          () => loadingString,
          () => loadingString,
          () => noDataString,
          (_) =>
            FP.pipe(
              O.some(affiliateFee),
              O.fold(
                () => '',
                (outFee: CryptoAmount) => {
                  const fee = formatAssetAmountCurrency({
                    amount: outFee.assetAmount,
                    asset: outFee.asset,
                    decimal: isUSDAsset(outFee.asset) ? 2 : 6,
                    trimZeros: !isUSDAsset(outFee.asset)
                  })
                  const price = FP.pipe(
                    O.some(affiliatePriceValue),
                    O.map((cryptoAmount: CryptoAmount) =>
                      eqAsset.equals(outFee.asset, cryptoAmount.asset)
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
    [swapFeesRD, affiliateFee, affiliatePriceValue]
  )

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
          return { asset: inFee.asset, amount: in1e8.plus(out1e8).plus(affiliate) }
        })
      ),
    [oPriceSwapInFee, outFeePriceValue, affiliatePriceValue]
  )

  const priceSwapFeesLabel = useMemo(
    () =>
      FP.pipe(
        swapFeesRD,
        RD.fold(
          () => loadingString,
          () => loadingString,
          () => noDataString,
          (_) =>
            FP.pipe(
              oPriceSwapFees1e8,
              O.map(({ amount, asset }) =>
                formatAssetAmountCurrency({ amount: baseToAsset(amount), asset, decimal: isUSDAsset(asset) ? 2 : 6 })
              ),
              O.getOrElse(() => noDataString)
            )
        )
      ),
    [oPriceSwapFees1e8, swapFeesRD]
  )

  const oQuoteSwapData: O.Option<QuoteSwapParams> = useMemo(
    () =>
      FP.pipe(
        sequenceTOption(oSourceWalletAddress, oRecipientAddress),
        O.map(([sourceAddress, destinationAddress]) => {
          const fromAsset = sourceAsset
          const destinationAsset = targetAsset
          const amount = new CryptoAmount(convertBaseAmountDecimal(amountToSwapMax1e8, sourceAssetDecimal), sourceAsset)
          const address = destinationAddress
          const walletAddress = sourceAddress
          const streamingInt = isStreaming ? streamingInterval : 0
          const streaminQuant = isStreaming ? streamingQuantity : 0
          const toleranceBps = isStreaming ? 10000 : slipTolerance * 100 // convert to basis points
          return {
            fromAsset: fromAsset,
            destinationAsset: destinationAsset,
            amount: amount,
            destinationAddress: address,
            streamingInterval: streamingInt,
            streamingQuantity: streaminQuant,
            fromAddress: fromAsset.synth ? walletAddress : undefined,
            toleranceBps: toleranceBps,
            affiliateAddress: ASGARDEX_THORNAME,
            affiliateBps: ASGARDEX_AFFILIATE_FEE
          }
        })
      ),
    [
      oSourceWalletAddress,
      oRecipientAddress,
      sourceAsset,
      targetAsset,
      amountToSwapMax1e8,
      sourceAssetDecimal,
      isStreaming,
      streamingInterval,
      streamingQuantity,
      slipTolerance
    ]
  )
  const debouncedEffect = useRef(
    debounce((quoteSwapData) => {
      // Include isStreaming as a parameter
      thorchainQuery
        .quoteSwap(quoteSwapData)
        .then((quote) => {
          setQuote(O.some(quote))
        })
        .catch((error) => {
          console.error('Failed to get quote:', error)
        })
    }, 500)
  )

  useEffect(() => {
    const currentDebouncedEffect = debouncedEffect.current
    FP.pipe(
      oQuoteSwapData,
      O.fold(
        () => {
          console.log('No quoteSwapData available')
        },
        (quoteSwapData) => {
          if (!quoteSwapData.amount.baseAmount.eq(baseAmount(0)) && !disableSwapAction) {
            currentDebouncedEffect(quoteSwapData) // Pass the isStreaming flag
          }
        }
      )
    )
    // Clean up the debounced function
    return () => {
      currentDebouncedEffect.cancel()
    }
  }, [oQuoteSwapData, disableSwapAction])

  // Swap boolean for use later
  const canSwap: boolean = useMemo(
    () =>
      FP.pipe(
        oQuote,
        O.fold(
          () => false, // default value if oQuote is None
          (txDetails) => txDetails.txEstimate.canSwap
        )
      ),
    [oQuote]
  )

  // Reccommend amount in for use later
  const reccommendedAmountIn: CryptoAmount = useMemo(
    () =>
      FP.pipe(
        oQuote,
        O.fold(
          () => new CryptoAmount(baseAmount(0), sourceAsset), // default value if oQuote is None
          (txDetails) => new CryptoAmount(baseAmount(txDetails.txEstimate.recommendedMinAmountIn), sourceAsset)
        )
      ),
    [oQuote, sourceAsset]
  )

  // Quote slippage returned as a percent
  const swapSlippage: number = useMemo(
    () =>
      FP.pipe(
        oQuote,
        O.fold(
          () => 0, // default affiliate fee asset amount return as number not as BP
          (txDetails) => txDetails.txEstimate.slipBasisPoints / 100
        )
      ),
    [oQuote]
  )

  // Quote slippage returned as a percent
  const swapStreamingSlippage: number = useMemo(
    () =>
      FP.pipe(
        oQuote,
        O.fold(
          () => 0, // default affiliate fee asset amount return as number not as BP
          (txDetails) => txDetails.txEstimate.streamingSlipBasisPoints / 100
        )
      ),
    [oQuote]
  )
  // Quote expiry returned as a date
  const swapExpiry: Date = useMemo(
    () =>
      FP.pipe(
        oQuote,
        O.fold(
          () => new Date(), // default to false
          (txDetails) => txDetails.expiry
        )
      ),
    [oQuote]
  )

  // Swap result from thornode
  const swapResultAmountMax: CryptoAmount = useMemo(
    () =>
      FP.pipe(
        sequenceTOption(oQuote),
        O.fold(
          () => new CryptoAmount(baseAmount(0), targetAsset),
          ([txDetails]) => txDetails.txEstimate.netOutput
        )
      ),
    [oQuote, targetAsset]
  )

  // Swap streaming result from thornode
  const swapStreamingNetOutput: CryptoAmount = useMemo(
    () =>
      FP.pipe(
        sequenceTOption(oQuote),
        O.fold(
          () => new CryptoAmount(baseAmount(0), targetAsset),
          ([txDetails]) => txDetails.txEstimate.netOutputStreaming
        )
      ),
    [oQuote, targetAsset]
  )
  // Swap streaming result from thornode
  const maxStreamingQuantity: number = useMemo(
    () =>
      FP.pipe(
        sequenceTOption(oQuote),
        O.fold(
          () => 0,
          ([txDetails]) => txDetails.txEstimate.maxStreamingQuantity
        )
      ),
    [oQuote]
  )

  /**
   * Price of swap result in max 1e8 // boolean to convert between streaming and regular swaps
   */
  const priceSwapResultAmountMax1e8: AssetWithAmount = useMemo(
    () =>
      FP.pipe(
        PoolHelpers.getPoolPriceValue({
          balance: {
            asset: swapResultAmountMax.asset,
            amount: isStreaming ? swapStreamingNetOutput.baseAmount : swapResultAmountMax.baseAmount
          },
          poolDetails,
          pricePool,
          network
        }),
        O.getOrElse(() => baseAmount(0, THORCHAIN_DECIMAL /* default decimal*/)),
        (amount) => ({ asset: pricePool.asset, amount })
      ),
    [
      swapResultAmountMax.asset,
      swapResultAmountMax.baseAmount,
      isStreaming,
      swapStreamingNetOutput.baseAmount,
      poolDetails,
      pricePool,
      network
    ]
  )

  // Disable slippage selection temporary for Ledger/BTC (see https://github.com/thorchain/asgardex-electron/issues/2068)
  const disableSlippage = useMemo(
    () =>
      (isBtcChain(sourceChain) || isLtcChain(sourceChain) || isBchChain(sourceChain) || isDogeChain(sourceChain)) &&
      useSourceAssetLedger,
    [useSourceAssetLedger, sourceChain]
  )
  // not sure how accurate this is
  const swapLimit1e8: O.Option<BaseAmount> = useMemo(() => {
    return FP.pipe(
      oQuote,
      O.chain((txDetails) => {
        // Disable slippage protection temporary for Ledger/BTC (see https://github.com/thorchain/asgardex-electron/issues/2068)
        return !disableSlippage && swapResultAmountMax.baseAmount.gt(zeroTargetBaseAmountMax1e8)
          ? O.some(Utils.getSwapLimit1e8(txDetails.memo))
          : O.none
      })
    )
  }, [oQuote, disableSlippage, swapResultAmountMax, zeroTargetBaseAmountMax1e8])

  const oSwapParams: O.Option<SwapTxParams> = useMemo(
    () =>
      FP.pipe(
        sequenceTOption(oPoolAddress, oSourceAssetWB, oQuote),
        O.map(([poolAddress, { walletType, walletAddress, walletIndex, hdMode }, txDetails]) => {
          return {
            poolAddress,
            asset: sourceAsset,
            amount: convertBaseAmountDecimal(amountToSwapMax1e8, sourceAssetDecimal),
            memo: txDetails.memo, // The memo will be different based on the selected quote
            walletType,
            sender: walletAddress,
            walletIndex,
            hdMode
          }
        })
      ),
    [oPoolAddress, oSourceAssetWB, sourceAsset, amountToSwapMax1e8, sourceAssetDecimal, oQuote] // Include both quote dependencies
  )
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
    // not needed for users with locked or not imported wallets
    if (!hasImportedKeystore(keystore) || isLocked(keystore)) return O.some(false)

    // ERC20 token does need approval only
    switch (sourceChain) {
      case ETHChain:
        return isEthAsset(sourceAsset) ? O.some(false) : O.some(isEthTokenAsset(sourceAsset))
      case AVAXChain:
        return isAvaxAsset(sourceAsset) ? O.some(false) : O.some(isAvaxTokenAsset(sourceAsset))
      case BSCChain:
        return isBscAsset(sourceAsset) ? O.some(false) : O.some(isBscTokenAsset(sourceAsset))
      default:
        return O.none
    }
  }, [keystore, sourceAsset, sourceChain])

  const oApproveParams: O.Option<ApproveParams> = useMemo(() => {
    const oRouterAddress: O.Option<Address> = FP.pipe(
      oPoolAddress,
      O.chain(({ router }) => router)
    )

    const oTokenAddress: O.Option<string> = (() => {
      switch (sourceChain) {
        case ETHChain:
          return getEthTokenAddress(sourceAsset)
        case AVAXChain:
          return getAvaxTokenAddress(sourceAsset)
        case BSCChain:
          return getBscTokenAddress(sourceAsset)
        default:
          return O.none
      }
    })()

    const oNeedApprovement: O.Option<boolean> = FP.pipe(
      needApprovement,
      // Keep the existing Option<boolean>, no need for O.fromPredicate
      O.map((v) => !!v)
    )

    return FP.pipe(
      sequenceTOption(oNeedApprovement, oTokenAddress, oRouterAddress, oSourceAssetWB),
      O.map(([_, tokenAddress, routerAddress, { walletAddress, walletIndex, walletType, hdMode }]) => ({
        network,
        spenderAddress: routerAddress,
        contractAddress: tokenAddress,
        fromAddress: walletAddress,
        walletIndex,
        hdMode,
        walletType
      }))
    )
  }, [needApprovement, network, oPoolAddress, oSourceAssetWB, sourceAsset, sourceChain])

  // Reload balances at `onMount`
  useEffect(() => {
    reloadBalances()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reloadFeesHandler = useCallback(() => {
    reloadFees({
      inAsset: sourceAsset,
      outAsset: targetAsset
    })
  }, [reloadFees, sourceAsset, targetAsset])

  const prevApproveFee = useRef<O.Option<BaseAmount>>(O.none)

  const [approveFeeRD, approveFeeParamsUpdated] = useObservableState<FeeRD, ApproveParams>((approveFeeParam$) => {
    return approveFeeParam$.pipe(
      RxOp.switchMap((params) =>
        FP.pipe(
          approveFee$(params),
          liveData.map((fee) => {
            // store every successfully loaded fees
            prevApproveFee.current = O.some(fee)
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

  const priceApproveFee: CryptoAmount = useMemo(() => {
    const assetAmount = new CryptoAmount(approveFee, swapFees.inFee.asset)

    return FP.pipe(
      PoolHelpers.getPoolPriceValue({
        balance: { asset: assetAmount.asset, amount: assetAmount.baseAmount },
        poolDetails,
        pricePool,
        network
      }),
      O.fold(
        () => new CryptoAmount(baseAmount(0), pricePool.asset), // Default value if None
        (amount) => new CryptoAmount(amount, pricePool.asset) // Value if Some
      )
    )
  }, [approveFee, swapFees.inFee.asset, poolDetails, pricePool, network])

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
        prevApproveParams.current = O.some(params)
        return params
      }),
      // Trigger update for `approveFeesRD` + `checkApprove`
      O.map((params) => {
        approveFeeParamsUpdated(params)
        checkApprovedStatus(params)
        return true
      })
    )
  }, [approveFeeParamsUpdated, checkApprovedStatus, oApproveParams, oPoolAddress])

  const reloadApproveFeesHandler = useCallback(() => {
    FP.pipe(oApproveParams, O.map(reloadApproveFee))
  }, [oApproveParams, reloadApproveFee])

  // Swap start time
  const [swapStartTime, setSwapStartTime] = useState<number>(0)

  const setSourceAsset = useCallback(
    async (asset: Asset) => {
      // delay to avoid render issues while switching
      await delay(100)

      onChangeAsset({
        source: asset,
        // back to default 'keystore' type
        sourceWalletType: 'keystore',
        target: targetAsset,
        targetWalletType: oTargetWalletType,
        recipientAddress: oRecipientAddress
      })
    },
    [oRecipientAddress, oTargetWalletType, onChangeAsset, targetAsset]
  )

  const setTargetAsset = useCallback(
    async (asset: Asset) => {
      // delay to avoid render issues while switching
      await delay(100)
      onChangeAsset({
        source: sourceAsset,
        sourceWalletType,
        target: asset,
        // back to default 'keystore' type
        targetWalletType: O.some('keystore'),
        // Set recipient address to 'none' will lead to use keystore address in `WalletView`
        recipientAddress: O.none
      })
    },
    [onChangeAsset, sourceAsset, sourceWalletType]
  )

  const minAmountError = useMemo(() => {
    if (isZeroAmountToSwap) return false
    const convertReccomended = convertBaseAmountDecimal(reccommendedAmountIn.baseAmount, amountToSwapMax1e8.decimal) // needed to make sure comparision is accurate
    return amountToSwapMax1e8.lt(convertReccomended)
  }, [amountToSwapMax1e8, isZeroAmountToSwap, reccommendedAmountIn])

  const renderMinAmount = useMemo(
    () => (
      <div className="flex w-full items-center pl-10px pt-5px">
        <p
          className={`m-0 pr-5px font-main text-[12px] uppercase ${
            minAmountError ? 'dark:error-0d text-error0' : 'text-gray2 dark:text-gray2d'
          }`}>
          {`${intl.formatMessage({ id: 'common.min' })}: ${formatAssetAmountCurrency({
            asset: sourceAsset,
            amount: reccommendedAmountIn.assetAmount,
            trimZeros: true
          })}`}
        </p>
        <InfoIcon
          // override color
          className={`${minAmountError ? '' : 'text-gray2 dark:text-gray2d'}`}
          color={minAmountError ? 'error' : 'neutral'}
          tooltip={intl.formatMessage({ id: 'swap.min.amount.info' })}
        />
      </div>
    ),
    [intl, minAmountError, sourceAsset, reccommendedAmountIn]
  )

  // Max amount to swap == users balances of source asset
  // Decimal always <= 1e8 based
  const maxAmountToSwapMax1e8: BaseAmount = useMemo(() => {
    if (lockedWallet) return assetToBase(assetAmount(10000, sourceAssetAmountMax1e8.decimal))

    return Utils.maxAmountToSwapMax1e8({
      asset: sourceAsset,
      balanceAmountMax1e8: sourceAssetAmountMax1e8,
      feeAmount: swapFees.inFee.amount
    })
  }, [lockedWallet, sourceAsset, sourceAssetAmountMax1e8, swapFees.inFee.amount])

  const setAmountToSwapMax1e8 = useCallback(
    (amountToSwap: BaseAmount) => {
      const newAmount = baseAmount(amountToSwap.amount(), sourceAssetAmountMax1e8.decimal)

      // dirty check - do nothing if prev. and next amounts are equal
      if (eqBaseAmount.equals(newAmount, amountToSwapMax1e8)) return {}

      const newAmountToSwap = newAmount.gt(maxAmountToSwapMax1e8) ? maxAmountToSwapMax1e8 : newAmount
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
    [amountToSwapMax1e8, maxAmountToSwapMax1e8, sourceAssetAmountMax1e8]
  )

  /**
   * Selectable source assets to swap from.
   *
   * Based on users balances.
   * Zero balances are ignored.
   * Duplications of assets are merged.
   */
  const selectableSourceAssets: Asset[] = useMemo(
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
    (): Asset[] =>
      FP.pipe(
        poolAssets,
        // Remove source assets from List
        A.filter((asset) => !eqAsset.equals(asset, sourceAsset)),
        // Create synth version of assets (excluding assetRuneNative)
        A.chain((asset) =>
          isRuneNativeAsset(asset)
            ? [asset]
            : [
                asset,
                {
                  ...asset,
                  synth: true
                }
              ]
        ),
        // Merge duplications
        (assets) => unionAssets(assets)(assets)
      ),
    [poolAssets, sourceAsset]
  )

  type ModalState = 'swap' | 'approve' | 'none'
  const [showPasswordModal, setShowPasswordModal] = useState<ModalState>('none')
  const [showLedgerModal, setShowLedgerModal] = useState<ModalState>('none')

  const renderSlider = useMemo(() => {
    const percentage = amountToSwapMax1e8
      .amount()
      .dividedBy(maxAmountToSwapMax1e8.amount())
      .multipliedBy(100)
      // Remove decimal of `BigNumber`s used within `BaseAmount` and always round down for currencies
      .decimalPlaces(0, BigNumber.ROUND_DOWN)
      .toNumber()

    const setAmountToSwapFromPercentValue = (percents: number) => {
      const amountFromPercentage = maxAmountToSwapMax1e8.amount().multipliedBy(percents / 100)
      return setAmountToSwapMax1e8(baseAmount(amountFromPercentage, maxAmountToSwapMax1e8.decimal))
    }

    return (
      <Slider
        key={'swap percentage slider'}
        value={percentage}
        onChange={setAmountToSwapFromPercentValue}
        onAfterChange={reloadFeesHandler}
        tooltipVisible
        tipFormatter={(value) => `${value}%`}
        withLabel
        tooltipPlacement={'top'}
        disabled={disableSwapAction}
      />
    )
  }, [amountToSwapMax1e8, maxAmountToSwapMax1e8, reloadFeesHandler, disableSwapAction, setAmountToSwapMax1e8])

  // Function to reset the slider to default position
  const resetToDefault = () => {
    setStreamingInterval(3) // Default position
    setStreamingQuantity(0) // thornode decides the swap quantity
    setSlider(30)
    setIsStreaming(true)
  }

  // Streaming Interval slider
  const renderStreamerInterval = useMemo(() => {
    const setInterval = (slider: number) => {
      setSlider(slider)
      const streamingIntervalValue = Math.floor(slider / 10) // Mapping slider value to range 0 to 10
      setStreamingInterval(streamingIntervalValue)
      setStreamingQuantity(0)
      setIsStreaming(streamingIntervalValue !== 0)
    }
    const tipFormatter = slider === 0 ? 'Instant swap' : `${Math.floor(slider / 10)} Block interval between swaps`
    const labelMin = slider <= 0 ? `Instant Swap` : `` || slider < 50 ? 'Time Optimised' : `Price Optimised`

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
  }, [slider, streamingInterval])

  // Streaming Quantity slider
  const renderStreamerQuantity = useMemo(() => {
    const quantity = streamingQuantity
    const setQuantity = (quantity: number) => {
      setStreamingQuantity(quantity)
    }
    let quantityLabel: string[]
    let toolTip: string
    if (streamingInterval === 0) {
      quantityLabel = [`Instant swap`]
      toolTip = `No Streaming interval set`
    } else {
      quantityLabel = quantity === 0 ? [`Auto swap count`] : [`Sub swaps`, `${quantity}`]
      toolTip =
        quantity === 0
          ? `Thornode decides the swap count`
          : `` || quantity === maxStreamingQuantity
          ? `Max sub swaps ${maxStreamingQuantity}`
          : ''
    }
    return (
      <div>
        <Slider
          key={'Streamer Quantity slider'}
          value={quantity}
          onChange={setQuantity}
          max={maxStreamingQuantity}
          tooltipVisible
          tipFormatter={() => `${toolTip}`}
          included={false}
          labels={quantityLabel}
          tooltipPlacement={'top'}
        />
      </div>
    )
  }, [maxStreamingQuantity, streamingQuantity, streamingInterval])

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

  // Progress bar for swap return comparison
  const renderStreamerReturns = useMemo(() => {
    // Initialize percentageDifference
    let percentageDifference = 0

    // Check if swapSlippage is not zero to avoid division by zero
    if (swapSlippage !== 0) {
      percentageDifference = ((swapSlippage - swapStreamingSlippage) / swapSlippage) * 100
    }

    // Check if percentageDifference is a number
    const isPercentageValid = !isNaN(percentageDifference) && isFinite(percentageDifference)

    const streamerComparison = isPercentageValid
      ? percentageDifference <= 1
        ? 'Instant swap'
        : `${percentageDifference.toFixed(2)}% Better swap execution via streaming`
      : 'Invalid or zero slippage' // Default message for invalid or zero slippage

    return (
      <ProgressBar
        key={'Streamer Interval progress bar'}
        percent={percentageDifference}
        withLabel={true}
        labels={[`${streamerComparison}`, ``]}
        tooltipPlacement={'top'}
      />
    )
  }, [swapSlippage, swapStreamingSlippage])

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
      O.map(({ walletIndex, walletType, hdMode, contractAddress, spenderAddress, fromAddress }) =>
        subscribeApproveState(
          approveERC20Token$({
            network,
            contractAddress,
            spenderAddress,
            fromAddress,
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
    const stepLabels = [
      intl.formatMessage({ id: 'common.tx.healthCheck' }),
      intl.formatMessage({ id: 'common.tx.sending' }),
      intl.formatMessage({ id: 'common.tx.checkResult' })
    ]
    const stepLabel = FP.pipe(
      swapState.swap,
      RD.fold(
        () => '',
        () =>
          `${intl.formatMessage({ id: 'common.step' }, { current: swapState.step, total: swapState.stepsTotal })}: ${
            stepLabels[swapState.step - 1]
          }`,
        () => '',
        () => 'Done!'
      )
    )

    return (
      <SwapAssets
        key="swap-assets"
        source={{ asset: sourceAsset, amount: amountToSwapMax1e8 }}
        target={{
          asset: targetAsset,
          amount: isStreaming ? swapStreamingNetOutput.baseAmount : swapResultAmountMax.baseAmount
        }}
        stepDescription={stepLabel}
        network={network}
      />
    )
  }, [
    intl,
    swapState.swap,
    swapState.step,
    swapState.stepsTotal,
    sourceAsset,
    amountToSwapMax1e8,
    targetAsset,
    isStreaming,
    swapStreamingNetOutput.baseAmount,
    swapResultAmountMax.baseAmount,
    network
  ])

  const onFinishTxModal = useCallback(() => {
    resetSwapState()
    reloadBalances()
    setAmountToSwapMax1e8(initialAmountToSwapMax1e8)
  }, [resetSwapState, reloadBalances, setAmountToSwapMax1e8, initialAmountToSwapMax1e8])

  const renderTxModal = useMemo(() => {
    const { swapTx, swap } = swapState

    // don't render TxModal in initial state
    if (RD.isInitial(swap)) return <></>

    // Get timer value
    const timerValue = FP.pipe(
      swap,
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
      swap,
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
      O.map((txHash) =>
        isEthChain(sourceChain) || isAvaxChain(sourceChain) || isBscChain(sourceChain)
          ? txHash.replace(/0x/i, '')
          : txHash
      )
    )

    return (
      <TxModal
        title={txModalTitle}
        onClose={resetSwapState}
        onFinish={onFinishTxModal}
        startTime={swapStartTime}
        txRD={swap}
        extraResult={
          <ViewTxButton
            txHash={oTxHash}
            onClick={goToTransaction}
            txUrl={FP.pipe(oTxHash, O.chain(getExplorerTxUrl))}
          />
        }
        timerValue={timerValue}
        extra={extraTxModalContent}
      />
    )
  }, [
    swapState,
    resetSwapState,
    onFinishTxModal,
    swapStartTime,
    goToTransaction,
    getExplorerTxUrl,
    extraTxModalContent,
    intl,
    sourceChain
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
      isEthChain(sourceChain) && !isEthAsset(sourceAsset)
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
    if (isZeroAmountToSwap || minAmountError) return false

    const {
      inFee: { amount: inFeeAmount }
    } = swapFees

    return inFeeAmount.gt(sourceChainAssetAmount)
  }, [isZeroAmountToSwap, minAmountError, swapFees, sourceChainAssetAmount])

  const quoteError: JSX.Element = useMemo(() => {
    if (
      !O.isSome(oQuote) ||
      !oQuote.value.txEstimate ||
      !oQuote.value.txEstimate.errors ||
      oQuote.value.txEstimate.errors.length === 0
    ) {
      return <></>
    }
    // Select first error
    const error = oQuote.value.txEstimate.errors[0].split(':')

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
  }, [oQuote, sourceAsset, sourceAssetDecimal, intl])

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
  }, [disableSlippage, swapLimit1e8, targetAssetDecimal, targetAsset])

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
  }, [isApproveFeeError, walletBalancesLoading, intl, sourceChainAsset, sourceChainAssetAmount, approveFee])

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

  const reset = useCallback(() => {
    // reset swap state
    resetSwapState()
    // reset isApproved state
    resetIsApprovedState()
    // reset approve state
    resetApproveState()
    // zero amount to swap
    setAmountToSwapMax1e8(initialAmountToSwapMax1e8)
    // reload fees
    reloadFeesHandler()
  }, [
    initialAmountToSwapMax1e8,
    reloadFeesHandler,
    resetApproveState,
    resetIsApprovedState,
    resetSwapState,
    setAmountToSwapMax1e8
  ])

  /**
   * Callback whenever assets have been changed
   */
  useEffect(() => {
    let doReset = false
    // reset data whenever source asset has been changed
    if (!eqOAsset.equals(prevSourceAsset.current, O.some(sourceAsset))) {
      prevSourceAsset.current = O.some(sourceAsset)
      doReset = true
    }
    // reset data whenever target asset has been changed
    if (!eqOAsset.equals(prevTargetAsset.current, O.some(targetAsset))) {
      prevTargetAsset.current = O.some(targetAsset)
      doReset = true
    }
    // reset only once
    if (doReset) reset()

    // Note: useEffect does depend on `sourceAssetProp`, `targetAssetProp` - ignore other values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceAsset, targetAsset])

  const onSwitchAssets = useCallback(async () => {
    // delay to avoid render issues while switching
    await delay(100)

    const walletType = FP.pipe(
      oTargetWalletType,
      O.getOrElse<WalletType>(() => 'keystore')
    )

    onChangeAsset({
      source: targetAsset,
      sourceWalletType: walletType,
      target: sourceAsset,
      targetWalletType: O.some(sourceWalletType),
      recipientAddress: oSourceWalletAddress
    })
  }, [oSourceWalletAddress, oTargetWalletType, onChangeAsset, sourceAsset, sourceWalletType, targetAsset])

  const disableSubmit: boolean = useMemo(
    () =>
      disableSwapAction ||
      lockedWallet ||
      isZeroAmountToSwap ||
      walletBalancesLoading ||
      sourceChainFeeError ||
      RD.isPending(swapFeesRD) ||
      RD.isPending(approveState) ||
      minAmountError ||
      isCausedSlippage ||
      swapResultAmountMax.baseAmount.lte(zeroTargetBaseAmountMax1e8) ||
      O.isNone(oRecipientAddress) ||
      !canSwap ||
      customAddressEditActive ||
      quoteExpired,
    [
      disableSwapAction,
      lockedWallet,
      isZeroAmountToSwap,
      walletBalancesLoading,
      sourceChainFeeError,
      swapFeesRD,
      approveState,
      minAmountError,
      isCausedSlippage,
      swapResultAmountMax,
      zeroTargetBaseAmountMax1e8,
      oRecipientAddress,
      canSwap,
      customAddressEditActive,
      quoteExpired
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
      onChangeAsset({
        source: sourceAsset,
        target: targetAsset,
        sourceWalletType: useLedger ? 'ledger' : 'keystore',
        targetWalletType: oTargetWalletType,
        recipientAddress: oRecipientAddress
      })
    },
    [oRecipientAddress, oTargetWalletType, onChangeAsset, sourceAsset, targetAsset]
  )

  const onClickUseTargetAssetLedger = useCallback(
    (useLedger: boolean) => {
      onChangeAsset({
        source: sourceAsset,
        target: targetAsset,
        sourceWalletType,
        targetWalletType: O.some(useLedger ? 'ledger' : 'keystore'),
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
        (memo) => (
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
  const transactionTime: Time = useMemo(
    () =>
      FP.pipe(
        sequenceTOption(oQuote),
        O.fold(
          () => ({}),
          ([txDetails]) =>
            calculateTransactionTime(
              sourceChain,
              {
                outboundDelaySeconds: txDetails.txEstimate.outboundDelaySeconds,
                totalTransactionSeconds: txDetails.txEstimate.totalSwapSeconds,
                streamingTransactionSeconds: txDetails.txEstimate.streamingSwapSeconds
              },
              targetAsset
            )
        )
      ),
    [oQuote, sourceChain, targetAsset]
  )

  const maxBalanceInfoTxt = useMemo(() => {
    const balanceLabel = formatAssetAmountCurrency({
      amount: baseToAsset(sourceAssetAmountMax1e8),
      asset: sourceAsset,
      decimal: isUSDAsset(sourceAsset) ? 2 : 8, // use 8 decimal as same we use in maxAmountToSwapMax1e8
      trimZeros: !isUSDAsset(sourceAsset)
    })

    const feeLabel = FP.pipe(
      swapFeesRD,
      RD.map(({ inFee: { amount, asset: feeAsset } }) =>
        formatAssetAmountCurrency({
          amount: baseToAsset(amount),
          asset: feeAsset,
          decimal: isUSDAsset(feeAsset) ? 2 : 8, // use 8 decimal as same we use in maxAmountToSwapMax1e8
          trimZeros: !isUSDAsset(feeAsset)
        })
      ),
      RD.getOrElse(() => noDataString)
    )

    return isChainAsset(sourceAsset)
      ? intl.formatMessage({ id: 'swap.info.max.balanceMinusFee' }, { balance: balanceLabel, fee: feeLabel })
      : intl.formatMessage({ id: 'swap.info.max.balance' }, { balance: balanceLabel })
  }, [sourceAssetAmountMax1e8, sourceAsset, swapFeesRD, intl])

  const [showDetails, setShowDetails] = useState<boolean>(false)

  return (
    <div className="my-50px flex w-full max-w-[500px] flex-col justify-between">
      <div>
        {/* Note: Input value is shown as AssetAmount */}

        <AssetInput
          className="w-full"
          title={intl.formatMessage({ id: 'swap.input' })}
          amount={{ amount: amountToSwapMax1e8, asset: sourceAsset }}
          priceAmount={{ asset: priceAmountToSwapMax1e8.asset, amount: priceAmountToSwapMax1e8.baseAmount }}
          assets={selectableSourceAssets}
          network={network}
          onChangeAsset={setSourceAsset}
          onChange={setAmountToSwapMax1e8}
          onBlur={reloadFeesHandler}
          showError={minAmountError}
          hasLedger={hasSourceAssetLedger}
          useLedger={useSourceAssetLedger}
          useLedgerHandler={onClickUseSourceAssetLedger}
          extraContent={
            <div className="flex flex-col">
              <MaxBalanceButton
                className="ml-10px mt-5px"
                classNameButton="!text-gray2 dark:!text-gray2d"
                classNameIcon={
                  // show warn icon if maxAmountToSwapMax <= 0
                  maxAmountToSwapMax1e8.gt(zeroTargetBaseAmountMax1e8)
                    ? `text-gray2 dark:text-gray2d`
                    : 'text-warning0 dark:text-warning0d'
                }
                size="medium"
                balance={{ amount: maxAmountToSwapMax1e8, asset: sourceAsset }}
                onClick={() => setAmountToSwapMax1e8(maxAmountToSwapMax1e8)}
                maxInfoText={maxBalanceInfoTxt}
                hidePrivateData={hidePrivateData}
              />
              {minAmountError && renderMinAmount}
            </div>
          }
        />
        <div className="w-full px-20px">{renderSlider}</div>
        <div>
          <div className="flex w-full pt-20px pb-20px">
            <div className="w-full ">
              <div className="w-9/10 px-20px pb-20px">{renderStreamerInterval}</div>
              <div className="w-9/10 px-20px pb-20px">{renderStreamerQuantity}</div>
              <div className="w-9/10 px-20px">{renderStreamerReturns}</div>
            </div>
            <div className="flex">
              <TooltipAddress title="Reset to streaming default">
                <BaseButton
                  onClick={resetToDefault}
                  className=" rounded-full hover:shadow-full group-hover:rotate-180 dark:hover:shadow-fulld">
                  <ArrowPathIcon className="ease h-[25px] w-[25px] text-turquoise" />
                </BaseButton>
              </TooltipAddress>
            </div>
            <div className="m-40px flex flex-col justify-center ">
              <div className=" border-gray1 dark:border-gray1d"></div>
              <BaseButton
                onClick={onSwitchAssets}
                className="group rounded-full !p-10px hover:rotate-180 hover:shadow-full dark:hover:shadow-fulld">
                <ArrowsUpDownIcon className="ease h-[40px] w-[40px] text-turquoise " />
              </BaseButton>
            </div>
          </div>
        </div>
        <div className="flex flex-col">
          <AssetInput
            className="w-full md:w-auto"
            title={intl.formatMessage({ id: 'swap.output' })}
            // Show swap result <= 1e8
            amount={{
              amount: isStreaming ? swapStreamingNetOutput.baseAmount : swapResultAmountMax.baseAmount,
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
        </div>
        {!lockedWallet &&
          FP.pipe(
            oRecipientAddress,
            O.map((address) => (
              <div className="mt-20px flex flex-col  px-10px" key="edit-address">
                <div className="flex items-center">
                  <h3 className="font-[12px] !mb-0 mr-10px w-auto p-0 font-main uppercase text-text2 dark:text-text2d">
                    {intl.formatMessage({ id: 'common.recipient' })}
                  </h3>
                  <WalletTypeLabel key="target-w-type">{getWalletTypeLabel(oTargetWalletType, intl)}</WalletTypeLabel>
                </div>
                <EditableAddress
                  key={address}
                  asset={targetAsset}
                  network={network}
                  address={address}
                  onClickOpenAddress={(address) => clickAddressLinkHandler(address)}
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
            <div className="w-full px-20px pb-10px">{renderSwapExpiry}</div>
            <div className={`mx-50px w-full px-10px font-main text-[12px] uppercase dark:border-gray1d`}>
              <BaseButton
                className="goup flex w-full justify-between !p-0 font-mainSemiBold text-[16px] text-text2 hover:text-turquoise dark:text-text2d dark:hover:text-turquoise"
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

                {showDetails && (
                  <>
                    <div className="flex w-full justify-between pl-10px text-[12px]">
                      <div>{intl.formatMessage({ id: 'common.approve' })}</div>
                      <div>{priceApproveFeeLabel}</div>
                    </div>
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
                          amount: priceAmountToSwapMax1e8.assetAmount.times(swapStreamingSlippage / 100), // Find the value of swap slippage
                          asset: priceAmountToSwapMax1e8.asset,
                          decimal: isUSDAsset(priceAmountToSwapMax1e8.asset) ? 2 : 6,
                          trimZeros: !isUSDAsset(priceAmountToSwapMax1e8.asset)
                        }) + ` (${swapStreamingSlippage.toFixed(2)}%)`}
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
                <>
                  <div
                    className={`flex w-full justify-between ${showDetails ? 'pt-10px' : ''} font-mainBold text-[14px]`}>
                    <div>{intl.formatMessage({ id: 'common.time.title' })}</div>
                    <div>
                      {formatSwapTime(Number(transactionTime.totalSwap) + Number(transactionTime.confirmation))}
                    </div>
                  </div>
                  {showDetails && (
                    <>
                      <div className="flex w-full justify-between pl-10px text-[12px]">
                        <div className={`flex items-center`}>{intl.formatMessage({ id: 'common.inbound.time' })}</div>
                        <div>{formatSwapTime(Number(transactionTime.inbound))}</div>
                      </div>
                      <div className="flex w-full justify-between pl-10px text-[12px]">
                        <div className={`flex items-center`}>{intl.formatMessage({ id: 'common.streaming.time' })}</div>
                        <div>{formatSwapTime(Number(transactionTime.streaming))}</div>
                      </div>
                      <div className="flex w-full justify-between pl-10px text-[12px]">
                        <div className={`flex items-center`}>{intl.formatMessage({ id: 'common.outbound.time' })}</div>
                        <div>{formatSwapTime(Number(transactionTime.outbound))}</div>
                      </div>
                      <div className="flex w-full justify-between pl-10px text-[12px]">
                        <div className={`flex items-center`}>
                          {intl.formatMessage({ id: 'common.confirmation.time' }, { chain: targetAsset.chain })}
                        </div>
                        <div>{formatSwapTime(Number(transactionTime.confirmation))}</div>
                      </div>
                    </>
                  )}
                </>
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
                        address && !asset.synth ? (
                          <div className="flex w-full items-center justify-between pl-10px text-[12px]" key="pool-addr">
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
                    {/* recipient balance */}
                    <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                      <div>{intl.formatMessage({ id: 'common.recipient' })}</div>
                      <div className="truncate pl-20px text-[13px] normal-case leading-normal">
                        {walletBalancesLoading ? loadingString : targetAssetAmountLabel}
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
