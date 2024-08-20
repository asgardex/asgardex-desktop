import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowPathIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { PoolDetails } from '@xchainjs/xchain-midgard'
import { EstimateAddSaver, ThorchainQuery } from '@xchainjs/xchain-thorchain-query'
import {
  Address,
  assetAmount,
  BaseAmount,
  baseAmount,
  assetToBase,
  formatAssetAmountCurrency,
  baseToAsset,
  eqAsset,
  delay,
  assetFromString,
  CryptoAmount,
  AnyAsset,
  TokenAsset,
  Asset
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/lib/function'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as O from 'fp-ts/lib/Option'
import debounce from 'lodash/debounce'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as RxOp from 'rxjs/operators'

import { Dex } from '../../../shared/api/types'
import { ASGARDEX_THORNAME } from '../../../shared/const'
import { chainToString } from '../../../shared/utils/chain'
import { isLedgerWallet } from '../../../shared/utils/guard'
import { WalletType } from '../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../const'
import {
  convertBaseAmountDecimal,
  getAvaxTokenAddress,
  getBscTokenAddress,
  getEthTokenAddress,
  isAethAsset,
  isArbTokenAsset,
  isAvaxAsset,
  isAvaxTokenAsset,
  isBscAsset,
  isBscTokenAsset,
  isEthAsset,
  isEthTokenAsset,
  isUSDAsset,
  max1e8BaseAmount
} from '../../helpers/assetHelper'
import { getChainAsset, isAvaxChain, isBscChain, isEthChain } from '../../helpers/chainHelper'
import { isEvmChain, isEvmToken } from '../../helpers/evmHelper'
import { eqBaseAmount, eqOApproveParams, eqOAsset } from '../../helpers/fp/eq'
import { sequenceTOption } from '../../helpers/fpHelpers'
import * as PoolHelpers from '../../helpers/poolHelper'
import { LiveData, liveData } from '../../helpers/rx/liveData'
import { emptyString, hiddenString, loadingString, noDataString } from '../../helpers/stringHelper'
import { calculateTransactionTime, formatSwapTime, Time } from '../../helpers/timeHelper'
import * as WalletHelper from '../../helpers/walletHelper'
import {
  filterWalletBalancesByAssets,
  getWalletBalanceByAssetAndWalletType,
  hasLedgerInBalancesByAsset
} from '../../helpers/walletHelper'
import { useSubscriptionState } from '../../hooks/useSubscriptionState'
import { INITIAL_SAVER_DEPOSIT_STATE } from '../../services/chain/const'
import {
  SaverDepositFees,
  SaverDepositFeesHandler,
  SaverDepositFeesRD,
  SaverDepositParams,
  SaverDepositState,
  SaverDepositStateHandler,
  FeeRD,
  ReloadSaverDepositFeesHandler
} from '../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl, WalletBalances } from '../../services/clients'
import {
  ApproveFeeHandler,
  ApproveParams,
  IsApprovedRD,
  IsApproveParams,
  LoadApproveFeeHandler
} from '../../services/evm/types'
import { PoolAddress } from '../../services/midgard/types'
import {
  ApiError,
  BalancesState,
  KeystoreState,
  ValidatePasswordHandler,
  WalletBalance,
  TxHashLD,
  TxHashRD
} from '../../services/wallet/types'
import { hasImportedKeystore, isLocked } from '../../services/wallet/util'
import { AssetWithAmount } from '../../types/asgardex'
import { PricePool } from '../../views/pools/Pools.types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../modal/confirmation'
import { TxModal } from '../modal/tx'
import { DepositAsset } from '../modal/tx/extra/DepositAsset'
import { ErrorLabel } from '../settings/AppSettings.styles'
import { LoadingView } from '../shared/loading'
import { AssetInput } from '../uielements/assets/assetInput'
import { BaseButton, FlatButton, ViewTxButton } from '../uielements/button'
import { MaxBalanceButton } from '../uielements/button/MaxBalanceButton'
import { Tooltip, TooltipAddress } from '../uielements/common/Common.styles'
import { Fees, UIFeesRD } from '../uielements/fees'
import { InfoIcon } from '../uielements/info'
import { Slider } from '../uielements/slider'
import * as Utils from './Saver.utils'

export const ASSET_SELECT_BUTTON_WIDTH = 'w-[180px]'

export type AddProps = {
  keystore: KeystoreState
  thorchainQuery: ThorchainQuery
  poolAssets: AnyAsset[]
  poolDetails: PoolDetails
  asset: CryptoAmount
  address: Address
  network: Network
  pricePool: PricePool
  poolAddress: O.Option<PoolAddress>
  fees$: SaverDepositFeesHandler
  sourceWalletType: WalletType
  onChangeAsset: ({ source, sourceWalletType }: { source: AnyAsset; sourceWalletType: WalletType }) => void
  walletBalances: Pick<BalancesState, 'balances' | 'loading'>
  saverDeposit$: SaverDepositStateHandler
  goToTransaction: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  reloadSelectedPoolDetail: (delay?: number) => void
  approveERC20Token$: (params: ApproveParams) => TxHashLD
  reloadApproveFee: LoadApproveFeeHandler
  approveFee$: ApproveFeeHandler
  isApprovedERC20Token$: (params: IsApproveParams) => LiveData<ApiError, boolean>
  validatePassword$: ValidatePasswordHandler
  reloadFees: ReloadSaverDepositFeesHandler
  reloadBalances: FP.Lazy<void>
  disableSaverAction: boolean
  hidePrivateData: boolean
  dex: Dex
}

export const AddSavers: React.FC<AddProps> = (props): JSX.Element => {
  const {
    keystore,
    thorchainQuery,
    poolDetails,
    asset,
    sourceWalletType: initialSourceWalletType,
    walletBalances,
    network,
    pricePool,
    poolAddress: oPoolAddress,
    onChangeAsset,
    fees$,
    saverDeposit$,
    validatePassword$,
    isApprovedERC20Token$,
    approveERC20Token$,
    reloadBalances = FP.constVoid,
    reloadFees,
    reloadApproveFee,
    approveFee$,
    reloadSelectedPoolDetail,
    goToTransaction,
    getExplorerTxUrl,
    disableSaverAction,
    hidePrivateData,
    dex
  } = props

  const intl = useIntl()

  const [oSaversQuote, setSaversQuote] = useState<O.Option<EstimateAddSaver>>(O.none)

  const { chain: sourceChain } = asset.asset

  const lockedWallet: boolean = useMemo(() => isLocked(keystore) || !hasImportedKeystore(keystore), [keystore])

  const useLedger = isLedgerWallet(initialSourceWalletType)

  // Deposit start time
  const [depositStartTime, setDepositStartTime] = useState<number>(0)

  const prevAsset = useRef<O.Option<AnyAsset>>(O.none)

  const {
    state: depositState,
    reset: resetDepositState,
    subscribe: subscribeDepositState
  } = useSubscriptionState<SaverDepositState>(INITIAL_SAVER_DEPOSIT_STATE)

  const { balances: oWalletBalances, loading: walletBalancesLoading } = walletBalances

  /**
   * Selectable source assets to add to savers.
   * Based on saver depth
   */
  const selectableAssets: AnyAsset[] = useMemo(() => {
    const result = FP.pipe(
      poolDetails,
      A.filter(({ saversDepth }) => Number(saversDepth) > 0),
      A.filterMap(({ asset: assetString }) => O.fromNullable(assetFromString(assetString)))
    )
    return result
  }, [poolDetails])

  /**
   * All balances based on available assets
   */
  const allBalances: WalletBalances = useMemo(() => {
    const balances = FP.pipe(
      oWalletBalances,
      // filter wallet balances
      O.map((balances) => filterWalletBalancesByAssets(balances, selectableAssets)),
      O.getOrElse<WalletBalances>(() => [])
    )
    return balances
  }, [selectableAssets, oWalletBalances])

  const hasLedger = useMemo(() => hasLedgerInBalancesByAsset(asset.asset, allBalances), [asset, allBalances])

  const sourceWalletType: WalletType = useMemo(() => (useLedger ? 'ledger' : 'keystore'), [useLedger])

  // `oSourceAssetWB` of source asset - which might be none (user has no balances for this asset or wallet is locked)
  const oSourceAssetWB: O.Option<WalletBalance> = useMemo(() => {
    const oWalletBalances = NEA.fromArray(allBalances)
    const result = getWalletBalanceByAssetAndWalletType({
      oWalletBalances,
      asset: asset.asset,
      walletType: sourceWalletType
    })
    return result
  }, [asset, allBalances, sourceWalletType])

  // User balance for source asset
  const sourceAssetAmount: BaseAmount = useMemo(
    () =>
      FP.pipe(
        oSourceAssetWB,
        O.map(({ amount }) => amount),
        O.getOrElse(() => baseAmount(0, asset.baseAmount.decimal))
      ),
    [oSourceAssetWB, asset]
  )
  /** Balance of source asset converted to <= 1e8 */
  const sourceAssetAmountMax1e8: BaseAmount = useMemo(() => max1e8BaseAmount(sourceAssetAmount), [sourceAssetAmount])

  // source chain asset
  const sourceChainAsset: AnyAsset = useMemo(() => getChainAsset(sourceChain), [sourceChain])

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
        O.getOrElse(() => baseAmount(0, asset.baseAmount.decimal))
      ),
    [oWalletBalances, asset, sourceChainAsset, sourceWalletType]
  )
  // *********** FEES **************
  const zeroSaverFees: SaverDepositFees = useMemo(() => Utils.getZeroSaverDepositFees(asset.asset), [asset])

  const prevSaverFees = useRef<O.Option<SaverDepositFees>>(O.none)

  const [saverFeesRD] = useObservableState<SaverDepositFeesRD>(
    () =>
      FP.pipe(
        fees$(asset.asset),
        liveData.map((fees) => {
          // store every successfully loaded fees
          prevSaverFees.current = O.some(fees)
          return fees
        })
      ),
    RD.success(zeroSaverFees)
  )

  const saverFees: SaverDepositFees = useMemo(
    () =>
      FP.pipe(
        saverFeesRD,
        RD.toOption,
        O.alt(() => prevSaverFees.current),
        O.getOrElse(() => zeroSaverFees)
      ),
    [saverFeesRD, zeroSaverFees]
  )

  const initialAmountToSendMax1e8 = useMemo(
    () => baseAmount(0, sourceAssetAmountMax1e8.decimal),
    [sourceAssetAmountMax1e8]
  )

  const [
    /* max. 1e8 decimal */
    amountToSendMax1e8,
    _setAmountToSendMax1e8 /* private - never set it directly, use setAmountToSendMax1e8() instead */
  ] = useState(initialAmountToSendMax1e8)

  const maxAmountToSendMax1e8: BaseAmount = useMemo(() => {
    if (lockedWallet) return assetToBase(assetAmount(10000, sourceAssetAmountMax1e8.decimal))

    return Utils.maxAmountToSendMax1e8({
      asset: asset.asset,
      balanceAmountMax1e8: sourceAssetAmountMax1e8,
      feeAmount: saverFees.asset.inFee
    })
  }, [lockedWallet, asset, sourceAssetAmountMax1e8, saverFees])

  // Set amount to send
  const setAmountToSendMax1e8 = useCallback(
    (amountToSend: BaseAmount) => {
      const newAmount = baseAmount(amountToSend.amount(), sourceAssetAmountMax1e8.decimal)
      // dirty check - do nothing if prev. and next amounts are equal
      if (eqBaseAmount.equals(newAmount, amountToSendMax1e8)) return {}

      const newAmountToSend = newAmount.gt(maxAmountToSendMax1e8) ? maxAmountToSendMax1e8 : newAmount

      _setAmountToSendMax1e8({ ...newAmountToSend })
    },
    [amountToSendMax1e8, maxAmountToSendMax1e8, sourceAssetAmountMax1e8]
  )
  // price of amount to send
  const priceAmountToSendMax1e8: CryptoAmount = useMemo(() => {
    const result = FP.pipe(
      PoolHelpers.getPoolPriceValue({
        balance: { asset: asset.asset, amount: amountToSendMax1e8 },
        poolDetails,
        pricePool
      }),
      O.getOrElse(() => baseAmount(0, amountToSendMax1e8.decimal)),
      (amount) => ({ asset: pricePool.asset, amount })
    )

    return new CryptoAmount(result.amount, result.asset)
  }, [amountToSendMax1e8, poolDetails, pricePool, asset])

  // price of amount to send
  const priceAmountMax1e8: CryptoAmount = useMemo(() => {
    const result = FP.pipe(
      PoolHelpers.getPoolPriceValue({
        balance: { asset: asset.asset, amount: maxAmountToSendMax1e8 },
        poolDetails,
        pricePool
      }),
      O.getOrElse(() => baseAmount(0, amountToSendMax1e8.decimal)),
      (amount) => ({ asset: pricePool.asset, amount })
    )

    return new CryptoAmount(result.amount, result.asset)
  }, [asset.asset, maxAmountToSendMax1e8, poolDetails, pricePool, amountToSendMax1e8.decimal])

  // Reccommend amount in for use later
  const reccommendedAmountIn: CryptoAmount = useMemo(
    () =>
      FP.pipe(
        oSaversQuote,
        O.fold(
          () => new CryptoAmount(baseAmount(0), asset.asset), // default value if oQuote is None
          (txDetails) => new CryptoAmount(baseAmount(txDetails.recommendedMinAmountIn), asset.asset)
        )
      ),
    [oSaversQuote, asset]
  )

  // Liquidity fee in for use later
  const liquidityFee: CryptoAmount = useMemo(
    () =>
      FP.pipe(
        oSaversQuote,
        O.fold(
          () => new CryptoAmount(baseAmount(0), asset.asset), // default value if oQuote is None
          (txDetails) => txDetails.fee.liquidity // already of type cryptoAmount
        )
      ),
    [oSaversQuote, asset]
  )

  // store liquidity fee
  const [liquidityPriceValue, setLiquidityPriceValue] = useState<CryptoAmount>(
    new CryptoAmount(baseAmount(0, asset.baseAmount.decimal), asset.asset)
  )

  // useEffect to fetch data from query
  useEffect(() => {
    const fetchData = async () => {
      setLiquidityPriceValue(await thorchainQuery.convert(liquidityFee, pricePool.asset))
    }

    fetchData()
  }, [thorchainQuery, liquidityFee, pricePool.asset])

  const formatAmount = (cryptoAmount: CryptoAmount) =>
    formatAssetAmountCurrency({
      amount: cryptoAmount.assetAmount,
      asset: cryptoAmount.asset,
      decimal: isUSDAsset(cryptoAmount.asset) ? 2 : 6,
      trimZeros: !isUSDAsset(cryptoAmount.asset)
    })

  const priceLiquidityFeeLabel = useMemo(() => {
    const getFormattedFee = () => (liquidityFee ? formatAmount(liquidityFee) : '')

    const getFormattedPrice = () =>
      FP.pipe(
        O.fromNullable(liquidityPriceValue),
        O.map((cryptoAmount: CryptoAmount) => formatAmount(cryptoAmount)),
        O.getOrElse(() => '')
      )

    const fee = getFormattedFee()
    const price = getFormattedPrice()

    return price ? `${price} (${fee})` : fee
  }, [liquidityFee, liquidityPriceValue])

  const oChainAssetBalance: O.Option<BaseAmount> = useMemo(() => {
    const chainAsset = getChainAsset(sourceChain)

    return FP.pipe(
      WalletHelper.getWalletBalanceByAssetAndWalletType({
        oWalletBalances,
        asset: chainAsset,
        walletType: sourceWalletType
      }),
      O.map(({ amount }) => amount)
    )
  }, [sourceChain, oWalletBalances, sourceWalletType])

  const chainAssetBalance: BaseAmount = useMemo(
    () =>
      FP.pipe(
        oChainAssetBalance,
        O.getOrElse(() => ZERO_BASE_AMOUNT)
      ),
    [oChainAssetBalance]
  )
  const needApprovement: O.Option<boolean> = useMemo(() => {
    // not needed for users with locked or not imported wallets
    if (!hasImportedKeystore(keystore) || isLocked(keystore)) return O.some(false)

    // ERC20 token does need approval only
    //tobeFixed
    switch (sourceChain) {
      case ETHChain:
        return isEthAsset(asset.asset) ? O.some(false) : O.some(isEthTokenAsset(asset.asset as TokenAsset))
      case AVAXChain:
        return isAvaxAsset(asset.asset) ? O.some(false) : O.some(isAvaxTokenAsset(asset.asset as TokenAsset))
      case BSCChain:
        return isBscAsset(asset.asset) ? O.some(false) : O.some(isBscTokenAsset(asset.asset as TokenAsset))
      case ARBChain:
        return isAethAsset(asset.asset) ? O.some(false) : O.some(isArbTokenAsset(asset.asset as TokenAsset))
      default:
        return O.none
    }
  }, [keystore, sourceChain, asset])

  const oApproveParams: O.Option<ApproveParams> = useMemo(() => {
    const oRouterAddress: O.Option<Address> = FP.pipe(
      oPoolAddress,
      O.chain(({ router }) => router)
    )

    const oTokenAddress: O.Option<string> = (() => {
      switch (sourceChain) {
        case ETHChain:
          return getEthTokenAddress(asset.asset as TokenAsset)
        case AVAXChain:
          return getAvaxTokenAddress(asset.asset as TokenAsset)
        case BSCChain:
          return getBscTokenAddress(asset.asset as TokenAsset)
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
  }, [needApprovement, network, oPoolAddress, oSourceAssetWB, asset.asset, sourceChain])
  // Boolean on if amount to send is zero
  const isZeroAmountToSend = useMemo(() => amountToSendMax1e8.amount().isZero(), [amountToSendMax1e8])
  const minAmountError = useMemo(() => {
    if (isZeroAmountToSend) return false

    return amountToSendMax1e8.lt(reccommendedAmountIn.baseAmount)
  }, [amountToSendMax1e8, isZeroAmountToSend, reccommendedAmountIn])

  const sourceChainFeeError: boolean = useMemo(() => {
    // ignore error check by having zero amounts or min amount errors
    if (minAmountError) return false

    const { inFee } = saverFees.asset

    return inFee.gt(sourceChainAssetAmount)
  }, [minAmountError, sourceChainAssetAmount, saverFees])

  // memo check disable submit if no memo
  const noMemo: boolean = useMemo(
    () =>
      FP.pipe(
        oSaversQuote,
        O.fold(
          () => false, // default value if oSaverWithdrawQuote is None
          (txDetails) => txDetails.memo === ''
        )
      ),
    [oSaversQuote]
  )
  // memo check disable submit if no memo
  const quoteError: JSX.Element = useMemo(() => {
    if (
      !O.isSome(oSaversQuote) ||
      oSaversQuote.value.canAddSaver ||
      !oSaversQuote.value.errors ||
      oSaversQuote.value.errors.length === 0
    ) {
      return <></>
    }
    // Select first error
    const error = oSaversQuote.value.errors[0].split(':')

    return (
      <ErrorLabel>
        {intl.formatMessage({ id: 'swap.errors.amount.thornodeQuoteError' }, { error: `${error}` })}
      </ErrorLabel>
    )
  }, [oSaversQuote, intl])

  // Disables the submit button
  const disableSubmit = useMemo(
    () =>
      sourceChainFeeError || isZeroAmountToSend || lockedWallet || minAmountError || walletBalancesLoading || noMemo,
    [isZeroAmountToSend, lockedWallet, minAmountError, noMemo, sourceChainFeeError, walletBalancesLoading]
  )

  const debouncedEffect = useRef(
    debounce((amountToSendMax1e8) => {
      thorchainQuery
        .estimateAddSaver(new CryptoAmount(amountToSendMax1e8, asset.asset as Asset | TokenAsset))
        .then((quote) => {
          setSaversQuote(O.some(quote)) // Wrapping the quote in an Option
        })
        .catch((error) => {
          console.error('Failed to get quote:', error)
        })
    }, 500)
  )

  useEffect(() => {
    if (!amountToSendMax1e8.eq(baseAmount(0)) && !sourceChainFeeError) {
      debouncedEffect.current(amountToSendMax1e8)
    }
  }, [amountToSendMax1e8, sourceChainFeeError])

  const setAsset = useCallback(
    async (asset: AnyAsset) => {
      // delay to avoid render issues while switching
      await delay(100)

      onChangeAsset({
        source: asset,
        // back to default 'keystore' type
        sourceWalletType: 'keystore'
      })
    },
    [onChangeAsset]
  )
  // Reload balances at `onMount`
  useEffect(() => {
    reloadBalances()
    reloadFees(asset.asset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const prevApproveFee = useRef<O.Option<BaseAmount>>(O.none)

  const [approveFeeRD, approveFeesParamsUpdated] = useObservableState<FeeRD, ApproveParams>((approveFeeParam$) => {
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

  const renderFeeError = useCallback(
    (fee: BaseAmount, amount: BaseAmount, asset: Asset) => {
      const msg = intl.formatMessage(
        { id: 'deposit.add.error.chainFeeNotCovered' },
        {
          fee: formatAssetAmountCurrency({
            asset: getChainAsset(sourceChain),
            trimZeros: true,
            amount: baseToAsset(fee)
          }),
          balance: formatAssetAmountCurrency({ amount: baseToAsset(amount), asset, trimZeros: true })
        }
      )

      return (
        <p className="mb-20px p-0 text-center font-main text-[12px] uppercase text-error0 dark:text-error0d">{msg}</p>
      )
    },
    [sourceChain, intl]
  )

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
  const uiApproveFeesRD: UIFeesRD = useMemo(
    () =>
      FP.pipe(
        approveFeeRD,
        RD.map((approveFee) => [{ asset: getChainAsset(sourceChain), amount: approveFee }])
      ),
    [approveFeeRD, sourceChain]
  )

  const isApproveFeeError = useMemo(() => {
    // ignore error check if we don't need to check allowance
    if (O.isNone(needApprovement)) return false

    return FP.pipe(
      oChainAssetBalance,
      O.fold(
        () => true,
        (balance) => FP.pipe(approveFee, balance.lt)
      )
    )
  }, [needApprovement, oChainAssetBalance, approveFee])

  const renderApproveFeeError = useMemo(() => {
    if (
      !isApproveFeeError ||
      // Don't render anything if chainAssetBalance is not available (still loading)
      O.isNone(oChainAssetBalance) ||
      // Don't render error if walletBalances are still loading
      walletBalancesLoading
    )
      return <></>

    return renderFeeError(approveFee, chainAssetBalance, getChainAsset(sourceChain))
  }, [
    isApproveFeeError,
    oChainAssetBalance,
    walletBalancesLoading,
    renderFeeError,
    approveFee,
    chainAssetBalance,
    sourceChain
  ])

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

  // Update `approveFeesRD` whenever `oApproveParams` has been changed
  useEffect(() => {
    FP.pipe(
      oApproveParams,
      // Do nothing if prev. and current router a the same
      O.filter((params) => !eqOApproveParams.equals(O.some(params), prevApproveParams.current)),
      // update ref
      O.map((params) => {
        prevApproveParams.current = O.some(params)
        return params
      }),
      // Trigger update for `approveFeesRD` + `checkApprove`
      O.map((params) => {
        approveFeesParamsUpdated(params)
        checkApprovedStatus(params)
        return true
      })
    )
  }, [approveFeesParamsUpdated, checkApprovedStatus, oApproveParams, oPoolAddress])

  const reloadApproveFeesHandler = useCallback(() => {
    FP.pipe(oApproveParams, O.map(reloadApproveFee))
  }, [oApproveParams, reloadApproveFee])

  const reloadFeesHandler = useCallback(() => {
    reloadFees(asset.asset)
  }, [reloadFees, asset])

  const zeroBaseAmountMax = useMemo(() => baseAmount(0, asset.baseAmount.decimal), [asset])

  const zeroBaseAmountMax1e8 = useMemo(() => max1e8BaseAmount(zeroBaseAmountMax), [zeroBaseAmountMax])

  const maxBalanceInfoTxt = useMemo(() => {
    const balanceLabel = formatAssetAmountCurrency({
      amount: baseToAsset(sourceAssetAmountMax1e8),
      asset: asset.asset,
      decimal: isUSDAsset(asset.asset) ? 2 : 8, // use 8 decimal as same we use in maxAmountToSendMax1e8
      trimZeros: !isUSDAsset(asset.asset)
    })

    const feeLabel = FP.pipe(
      saverFeesRD,
      RD.map(({ asset: { inFee, asset: feeAsset } }) =>
        formatAssetAmountCurrency({
          amount: baseToAsset(inFee),
          asset: feeAsset,
          decimal: isUSDAsset(feeAsset) ? 2 : 8, // use 8 decimal as same we use in maxAmountToSendMax1e8
          trimZeros: !isUSDAsset(feeAsset)
        })
      ),
      RD.getOrElse(() => noDataString)
    )

    return intl.formatMessage({ id: 'savers.info.max.balance' }, { balance: balanceLabel, fee: feeLabel })
  }, [sourceAssetAmountMax1e8, saverFeesRD, asset, intl])

  const resetEnteredAmounts = useCallback(() => {
    setAmountToSendMax1e8(initialAmountToSendMax1e8)
  }, [initialAmountToSendMax1e8, setAmountToSendMax1e8])

  const oEarnParams: O.Option<SaverDepositParams> = useMemo(() => {
    return FP.pipe(
      sequenceTOption(oPoolAddress, oSourceAssetWB, oSaversQuote),
      O.map(([poolAddress, { walletType, walletAddress, walletAccount, walletIndex, hdMode }, saversQuote]) => {
        const result = {
          poolAddress,
          asset: asset.asset,
          amount: convertBaseAmountDecimal(amountToSendMax1e8, asset.baseAmount.decimal),
          memo: saversQuote.memo !== '' ? saversQuote.memo.concat(`::${ASGARDEX_THORNAME}:0`) : '', // add tracking,
          walletType,
          sender: walletAddress,
          walletAccount,
          walletIndex,
          hdMode,
          dex
        }
        return result
      })
    )
  }, [oPoolAddress, oSourceAssetWB, oSaversQuote, asset.asset, asset.baseAmount.decimal, amountToSendMax1e8, dex])

  const onClickUseLedger = useCallback(
    (useLedger: boolean) => {
      const walletType: WalletType = useLedger ? 'ledger' : 'keystore'
      onChangeAsset({ source: asset.asset, sourceWalletType: walletType })
      resetEnteredAmounts()
    },
    [asset.asset, onChangeAsset, resetEnteredAmounts]
  )

  const txModalExtraContent = useMemo(() => {
    const stepDescriptions = [
      intl.formatMessage({ id: 'common.tx.healthCheck' }),
      intl.formatMessage({ id: 'common.tx.sendingAsset' }, { assetTicker: asset.asset.ticker }),
      intl.formatMessage({ id: 'common.tx.checkResult' })
    ]
    const stepDescription = FP.pipe(
      depositState.deposit,
      RD.fold(
        () => '',
        () =>
          `${intl.formatMessage(
            { id: 'common.step' },
            { current: depositState.step, total: depositState.stepsTotal }
          )}: ${stepDescriptions[depositState.step - 1]}`,
        () => '',
        () => `${intl.formatMessage({ id: 'common.done' })}!`
      )
    )

    return (
      <DepositAsset
        source={O.some({ asset: asset.asset, amount: amountToSendMax1e8 })}
        stepDescription={stepDescription}
        network={network}
      />
    )
  }, [intl, asset, depositState, amountToSendMax1e8, network])

  const onCloseTxModal = useCallback(() => {
    resetDepositState()
    reloadBalances()
    reloadSelectedPoolDetail(5000)
  }, [resetDepositState, reloadSelectedPoolDetail, reloadBalances])

  const onFinishTxModal = useCallback(() => {
    onCloseTxModal()
    reloadBalances()
    reloadSelectedPoolDetail(5000)
  }, [onCloseTxModal, reloadBalances, reloadSelectedPoolDetail])

  const renderTxModal = useMemo(() => {
    const { deposit: depositRD, depositTx } = depositState

    // don't render TxModal in initial state
    if (RD.isInitial(depositRD)) return <></>

    // Get timer value
    const timerValue = FP.pipe(
      depositRD,
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
      depositRD,
      RD.fold(
        () => 'savers.add.state.sending',
        () => 'savers.add.state.pending',
        () => 'savers.add.state.error',
        () => 'savers.add.state.success'
      ),
      (id) => intl.formatMessage({ id })
    )

    const oTxHash = FP.pipe(
      RD.toOption(depositTx),
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
        onClose={onCloseTxModal}
        onFinish={onFinishTxModal}
        startTime={depositStartTime}
        txRD={depositRD}
        timerValue={timerValue}
        extraResult={
          <ViewTxButton
            txHash={oTxHash}
            onClick={goToTransaction}
            txUrl={FP.pipe(oTxHash, O.chain(getExplorerTxUrl))}
            label={intl.formatMessage({ id: 'common.tx.view' }, { assetTicker: asset.asset.ticker })}
          />
        }
        extra={txModalExtraContent}
      />
    )
  }, [
    depositState,
    onCloseTxModal,
    onFinishTxModal,
    depositStartTime,
    goToTransaction,
    getExplorerTxUrl,
    intl,
    asset.asset.ticker,
    txModalExtraContent,
    sourceChain
  ])

  const submitDepositTx = useCallback(() => {
    FP.pipe(
      oEarnParams,
      O.map((earnParams) => {
        // set start time
        setDepositStartTime(Date.now())
        // subscribe to saverDeposit$
        subscribeDepositState(saverDeposit$(earnParams))

        return true
      })
    )
  }, [oEarnParams, subscribeDepositState, saverDeposit$])

  const {
    state: approveState,
    reset: resetApproveState,
    subscribe: subscribeApproveState
  } = useSubscriptionState<TxHashRD>(RD.initial)

  const onApprove = useCallback(() => {
    if (useLedger) {
      setShowLedgerModal('approve')
    } else {
      setShowPasswordModal('approve')
    }
  }, [useLedger])

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

  const renderApproveError = useMemo(
    () =>
      FP.pipe(
        approveState,
        RD.fold(
          () => <></>,
          () => <></>,
          (error) => (
            <p className="mb-20px p-0 text-center font-main uppercase text-error0 dark:text-error0d">{error.msg}</p>
          ),
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

  const reset = useCallback(() => {
    if (!eqOAsset.equals(prevAsset.current, O.some(asset.asset))) {
      prevAsset.current = O.some(asset.asset)
      // reset deposit state
      resetDepositState()
      // reset isApproved state
      resetIsApprovedState()
      // reset approve state
      resetApproveState()
      // reload fees
      reloadFeesHandler()
    }
  }, [asset, reloadFeesHandler, resetApproveState, resetIsApprovedState, resetDepositState])

  /**
   * Callback whenever assets have been changed
   */
  useEffect(() => {
    let doReset = false
    // reset data whenever source asset has been changed
    if (!eqOAsset.equals(prevAsset.current, O.some(asset.asset))) {
      prevAsset.current = O.some(asset.asset)
      doReset = true
    }

    // reset only once
    if (doReset) reset()

    // Note: useEffect does depend on `sourceAssetProp`, `targetAssetProp` - ignore other values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.asset])

  type ModalState = 'deposit' | 'approve' | 'none'
  const [showPasswordModal, setShowPasswordModal] = useState<ModalState>('none')
  const [showLedgerModal, setShowLedgerModal] = useState<ModalState>('none')

  const onSubmit = useCallback(() => {
    if (useLedger) {
      setShowLedgerModal('deposit')
    } else {
      setShowPasswordModal('deposit')
    }
  }, [setShowLedgerModal, useLedger]) // Dependencies array inside the useCallback hook

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
          <p className="mb-20px p-0 text-center font-main text-[12px] uppercase text-error0 dark:text-error0d">
            {intl.formatMessage({ id: 'common.approve.error' }, { asset: asset.asset.ticker, error: error.msg })}
          </p>
        ),
        (_) => <></>
      )
    )
  }, [checkIsApprovedError, intl, isApprovedState, asset])
  const disableSubmitApprove = useMemo(
    () => checkIsApprovedError || isApproveFeeError || walletBalancesLoading,

    [checkIsApprovedError, isApproveFeeError, walletBalancesLoading]
  )

  const renderMinAmount = useMemo(
    () => (
      <div className="flex w-full items-center pl-10px pt-5px">
        <p
          className={`m-0 pr-5px font-main text-[12px] uppercase ${
            minAmountError ? 'dark:error-0d text-error0' : 'text-gray2 dark:text-gray2d'
          }`}>
          {`${intl.formatMessage({ id: 'common.min' })}: ${formatAssetAmountCurrency({
            asset: asset.asset,
            amount: reccommendedAmountIn.assetAmount,
            trimZeros: true
          })}`}
        </p>
        <InfoIcon
          // override color
          className={`${minAmountError ? '' : 'text-gray2 dark:text-gray2d'}`}
          color={minAmountError ? 'error' : 'neutral'}
          tooltip={intl.formatMessage({ id: 'deposit.add.min.info' })}
        />
      </div>
    ),
    [intl, minAmountError, asset, reccommendedAmountIn]
  )

  const renderPasswordConfirmationModal = useMemo(() => {
    if (showPasswordModal === 'none') return <></>

    const onSuccess = () => {
      if (showPasswordModal === 'deposit') submitDepositTx()
      if (showPasswordModal === 'approve') submitApproveTx()
      setShowPasswordModal('none')
    }
    const onClose = () => {
      setShowPasswordModal('none')
    }

    return (
      <WalletPasswordConfirmationModal onSuccess={onSuccess} onClose={onClose} validatePassword$={validatePassword$} />
    )
  }, [showPasswordModal, submitApproveTx, submitDepositTx, validatePassword$])

  const renderLedgerConfirmationModal = useMemo(() => {
    const visible = showLedgerModal === 'deposit' || showLedgerModal === 'approve'

    const onClose = () => {
      setShowLedgerModal('none')
    }

    const onSucceess = () => {
      if (showLedgerModal === 'deposit') submitDepositTx()
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
      isEvmChain(asset.asset.chain) && isEvmToken(asset.asset)
        ? `${txtNeedsConnected} ${intl.formatMessage(
            {
              id: 'ledger.blindsign'
            },
            { chain: chainAsString }
          )}`
        : txtNeedsConnected

    const description2 = intl.formatMessage({ id: 'ledger.sign' })

    const addresses = FP.pipe(
      oEarnParams,
      O.chain(({ poolAddress, sender }) => {
        const recipient = poolAddress.address
        if (useLedger) return O.some({ recipient, sender })
        return O.none
      })
    )

    return (
      <LedgerConfirmationModal
        onSuccess={onSucceess}
        onClose={onClose}
        visible={visible}
        chain={sourceChain}
        network={network}
        description1={description1}
        description2={description2}
        addresses={addresses}
      />
    )
  }, [
    showLedgerModal,
    sourceChain,
    intl,
    asset.asset,
    oEarnParams,
    network,
    submitDepositTx,
    submitApproveTx,
    useLedger
  ])

  const renderSlider = useMemo(() => {
    const percentage = amountToSendMax1e8
      .amount()
      .dividedBy(maxAmountToSendMax1e8.amount())
      .multipliedBy(100)
      // Remove decimal of `BigNumber`s used within `BaseAmount` and always round down for currencies
      .decimalPlaces(0, BigNumber.ROUND_DOWN)
      .toNumber()

    const setAmountToSendFromPercentValue = (percents: number) => {
      const amountFromPercentage = maxAmountToSendMax1e8.amount().multipliedBy(percents / 100)
      return setAmountToSendMax1e8(baseAmount(amountFromPercentage, amountToSendMax1e8.decimal))
    }

    return (
      <Slider
        key={'swap percentage slider'}
        value={percentage}
        onChange={setAmountToSendFromPercentValue}
        onAfterChange={reloadFeesHandler}
        tooltipVisible
        tipFormatter={(value) => `${value}%`}
        withLabel
        tooltipPlacement={'top'}
        disabled={disableSaverAction}
      />
    )
  }, [amountToSendMax1e8, disableSaverAction, maxAmountToSendMax1e8, reloadFeesHandler, setAmountToSendMax1e8])

  // Price of asset IN fee
  const oPriceAssetInFee: O.Option<AssetWithAmount> = useMemo(() => {
    const asset = saverFees.asset.asset
    const amount = saverFees.asset.inFee

    return FP.pipe(
      PoolHelpers.getPoolPriceValue({
        balance: { asset, amount },
        poolDetails,
        pricePool
      }),
      O.map((amount) => ({ amount, asset: pricePool.asset }))
    )
  }, [poolDetails, pricePool, saverFees])

  const priceFeesLabel = useMemo(
    () =>
      FP.pipe(
        saverFeesRD,
        RD.fold(
          () => loadingString,
          () => loadingString,
          () => noDataString,
          ({ asset: { inFee, asset: feeAsset } }) => {
            const fee = formatAssetAmountCurrency({
              amount: baseToAsset(inFee),
              asset: feeAsset,
              decimal: isUSDAsset(feeAsset) ? 2 : 6,
              trimZeros: !isUSDAsset(feeAsset)
            })
            const price = FP.pipe(
              oPriceAssetInFee,
              O.map(({ amount, asset: priceAsset }) =>
                eqAsset(feeAsset, priceAsset)
                  ? emptyString
                  : formatAssetAmountCurrency({
                      amount: baseToAsset(amount),
                      asset: priceAsset,
                      decimal: isUSDAsset(priceAsset) ? 2 : 6,
                      trimZeros: !isUSDAsset(priceAsset)
                    })
              ),
              O.getOrElse(() => emptyString)
            )

            return price ? `${price} (${fee})` : fee
          }
        )
      ),

    [saverFeesRD, oPriceAssetInFee]
  )
  // label for Price in fee
  const priceInFeeLabel = useMemo(
    () =>
      FP.pipe(
        saverFeesRD,
        RD.fold(
          () => loadingString,
          () => loadingString,
          () => noDataString,
          ({ asset: { inFee, asset: feeAsset } }) => {
            const fee = formatAssetAmountCurrency({
              amount: baseToAsset(inFee),
              asset: feeAsset,
              decimal: isUSDAsset(feeAsset) ? 2 : 6,
              trimZeros: !isUSDAsset(feeAsset)
            })
            const price = FP.pipe(
              oPriceAssetInFee,
              O.map(({ amount, asset: priceAsset }) =>
                eqAsset(feeAsset, priceAsset)
                  ? emptyString
                  : formatAssetAmountCurrency({
                      amount: baseToAsset(amount),
                      asset: priceAsset,
                      decimal: isUSDAsset(priceAsset) ? 2 : 6,
                      trimZeros: !isUSDAsset(priceAsset)
                    })
              ),
              O.getOrElse(() => emptyString)
            )

            return price ? `${price} (${fee})` : fee
          }
        )
      ),

    [saverFeesRD, oPriceAssetInFee]
  )

  //calculating transaction time from chain & quote
  const transactionTime: Time = useMemo(() => {
    return calculateTransactionTime(sourceChain)
  }, [sourceChain])

  const oWalletAddress: O.Option<Address> = useMemo(() => {
    return FP.pipe(
      sequenceTOption(oSourceAssetWB),
      O.map(([{ walletAddress }]) => walletAddress)
    )
  }, [oSourceAssetWB])

  const [showDetails, setShowDetails] = useState<boolean>(true)

  return (
    <div className="flex w-full max-w-[500px] flex-col justify-between py-[60px]">
      <div>
        <div className="flex flex-col">
          <AssetInput
            className="w-full"
            amount={{ amount: amountToSendMax1e8, asset: asset.asset }}
            priceAmount={{ asset: priceAmountToSendMax1e8.asset, amount: priceAmountToSendMax1e8.baseAmount }}
            assets={selectableAssets}
            network={network}
            onChangeAsset={setAsset}
            onChange={setAmountToSendMax1e8}
            onBlur={reloadFeesHandler}
            showError={minAmountError}
            hasLedger={hasLedger}
            useLedger={useLedger}
            useLedgerHandler={onClickUseLedger}
            extraContent={
              <div className="flex flex-col">
                <MaxBalanceButton
                  className="ml-10px mt-5px"
                  classNameButton="!text-gray2 dark:!text-gray2d"
                  classNameIcon={
                    // show warn icon if maxAmountToSendMax1e8 <= 0
                    maxAmountToSendMax1e8.gt(zeroBaseAmountMax1e8)
                      ? `text-gray2 dark:text-gray2d`
                      : 'text-warning0 dark:text-warning0d'
                  }
                  size="medium"
                  balance={{ amount: maxAmountToSendMax1e8, asset: asset.asset }}
                  maxDollarValue={priceAmountMax1e8}
                  onClick={() => setAmountToSendMax1e8(maxAmountToSendMax1e8)}
                  maxInfoText={maxBalanceInfoTxt}
                />
                {minAmountError && renderMinAmount}
              </div>
            }
          />
          <div className="w-full px-20px">{renderSlider}</div>
          <div className="flex flex-col items-center justify-between py-30px">
            {renderIsApprovedError}
            {(walletBalancesLoading || checkIsApproved) && (
              <LoadingView
                className="mb-20px"
                label={
                  // We show only one loading state at time
                  // Order matters: Show states with shortest loading time before others
                  // (approve state takes just a short time to load, but needs to be displayed)
                  checkIsApproved
                    ? intl.formatMessage({ id: 'common.approve.checking' }, { asset: asset.asset.ticker })
                    : walletBalancesLoading
                    ? intl.formatMessage({ id: 'common.balance.loading' })
                    : undefined
                }
              />
            )}
            {isApproved ? (
              <>
                {' '}
                <div className="flex flex-col items-center justify-center">
                  <FlatButton
                    className="my-30px min-w-[200px]"
                    size="large"
                    color="primary"
                    onClick={onSubmit}
                    disabled={disableSubmit}>
                    {intl.formatMessage({ id: 'common.earn' })}
                  </FlatButton>
                  {quoteError}
                </div>
              </>
            ) : (
              <>
                {renderApproveFeeError}
                {renderApproveError}
                <FlatButton
                  className="mb-20px min-w-[200px]"
                  size="large"
                  color="warning"
                  disabled={disableSubmitApprove}
                  onClick={onApprove}
                  loading={RD.isPending(approveState)}>
                  {intl.formatMessage({ id: 'common.approve' })}
                </FlatButton>

                {!RD.isInitial(uiApproveFeesRD) && (
                  <Fees fees={uiApproveFeesRD} reloadFees={reloadApproveFeesHandler} />
                )}
              </>
            )}
          </div>

          <div className="w-full px-10px font-main text-[12px] uppercase dark:border-gray1d">
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
              {/* fees */}
              <div className="flex w-full items-center justify-between font-mainBold">
                <BaseButton
                  disabled={RD.isPending(saverFeesRD) || RD.isInitial(saverFeesRD)}
                  className="group !p-0 !font-mainBold !text-gray2 dark:!text-gray2d"
                  onClick={reloadFeesHandler}>
                  {intl.formatMessage({ id: 'common.fees.estimated' })}
                  <ArrowPathIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
                </BaseButton>
                <div>{priceFeesLabel}</div>
              </div>

              {showDetails && (
                <>
                  <div className="flex w-full justify-between pl-10px text-[12px]">
                    <div>{intl.formatMessage({ id: 'common.fee.inbound' })}</div>
                    <div>{priceInFeeLabel}</div>
                  </div>
                  <div className="flex w-full justify-between pl-10px text-[12px]">
                    <div>{intl.formatMessage({ id: 'common.fee.affiliate' })}</div>
                    <div>
                      {formatAssetAmountCurrency({
                        amount: assetAmount(0),
                        asset: pricePool.asset,
                        decimal: 0
                      })}
                    </div>
                  </div>
                  <div className="flex w-full justify-between pl-10px text-[12px]">
                    <div>{intl.formatMessage({ id: 'common.liquidity' })}</div>
                    <div>{priceLiquidityFeeLabel}</div>
                  </div>
                </>
              )}
              {/* Add saver transaction time only inbound */}
              <>
                <div
                  className={`flex w-full justify-between ${showDetails ? 'pt-10px' : ''} font-mainBold text-[14px]`}>
                  <div>{intl.formatMessage({ id: 'common.time.title' })}</div>
                  <div>{formatSwapTime(Number(transactionTime.inbound))}</div>
                </div>
                {showDetails && (
                  <>
                    <div className="flex w-full justify-between pl-10px text-[12px]">
                      <div className={`flex items-center`}>{intl.formatMessage({ id: 'common.inbound.time' })}</div>
                      <div>{formatSwapTime(Number(transactionTime.inbound))}</div>
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
                        oWalletAddress,
                        O.map((address) => (
                          <TooltipAddress title={address} key="tooltip-sender-addr">
                            {address}
                          </TooltipAddress>
                        )),
                        O.getOrElse(() => <>{noDataString}</>)
                      )}
                    </div>
                  </div>
                  {/* inbound address */}
                  {FP.pipe(
                    oEarnParams,
                    O.map(({ poolAddress: { address } }) =>
                      address ? (
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
                        : formatAssetAmountCurrency({
                            amount: baseToAsset(maxAmountToSendMax1e8),
                            asset: asset.asset,
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
                  <div className={`w-full pt-10px font-mainBold text-[14px]`}>
                    {intl.formatMessage({ id: 'common.memo' })}
                  </div>
                  <div className="truncate pl-10px font-main text-[12px]">
                    {FP.pipe(
                      oEarnParams,
                      O.map(({ memo }) => (
                        <Tooltip title={memo} key="tooltip-asset-memo">
                          {hidePrivateData ? hiddenString : memo}
                        </Tooltip>
                      )),
                      O.toNullable
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          {renderPasswordConfirmationModal}
          {renderLedgerConfirmationModal}
          {renderTxModal}
        </div>
      </div>
    </div>
  )
}
