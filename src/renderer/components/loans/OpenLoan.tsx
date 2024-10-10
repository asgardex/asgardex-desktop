import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowPathIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { PoolDetails } from '@xchainjs/xchain-midgard'
import {
  Address,
  Asset,
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
  TokenAsset
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/lib/function'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as RxOp from 'rxjs/operators'

import { Dex } from '../../../shared/api/types'
import { ASGARDEX_ADDRESS, ASGARDEX_THORNAME } from '../../../shared/const'
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
import { LiveData } from '../../helpers/rx/liveData'
import { emptyString, hiddenString, loadingString, noDataString } from '../../helpers/stringHelper'
import { calculateTransactionTime, formatSwapTime, Time } from '../../helpers/timeHelper'
import * as WalletHelper from '../../helpers/walletHelper'
import {
  filterWalletBalancesByAssets,
  getWalletBalanceByAssetAndWalletType,
  hasLedgerInBalancesByAsset
} from '../../helpers/walletHelper'
import { useSubscriptionState } from '../../hooks/useSubscriptionState'
import { INITIAL_BORROWER_DEPOSIT_STATE } from '../../services/chain/const'
import {
  BorrowerDepositFees,
  BorrowerDepositFeesHandler,
  BorrowerDepositFeesRD,
  BorrowerDepositParams,
  BorrowerDepositStateHandler,
  FeeRD,
  ReloadBorrowerDepositFeesHandler,
  BorrowerDepositState
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
import { LoanOpenParams, LoanOpenQuote, LoanOpenQuoteLD } from '../../services/thorchain/types'
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
import { AssetWithAmount, AssetWithDecimal } from '../../types/asgardex'
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
import * as Utils from './Loan.utils'

export const ASSET_SELECT_BUTTON_WIDTH = 'w-[180px]'

export type BorrowProps = {
  keystore: KeystoreState
  getLoanQuoteOpen$: (
    asset: AnyAsset,
    amount: BaseAmount,
    targetAsset: AnyAsset,
    destination: string,
    minOut?: string,
    affiliateBps?: number,
    affiliate?: string,
    height?: number
  ) => LoanOpenQuoteLD
  reloadLoanQuoteOpen: FP.Lazy<void>
  poolAssets: AnyAsset[]
  poolDetails: PoolDetails
  collateralAsset: AssetWithDecimal
  borrowAsset: AssetWithDecimal
  collateralAddress: Address
  borrowAddress: Address
  network: Network
  pricePool: PricePool
  poolAddress: O.Option<PoolAddress>
  fees$: BorrowerDepositFeesHandler
  collateralWalletType: WalletType
  borrowWalletType: O.Option<WalletType>
  onChangeAsset: ({
    collateral,
    collateralWalletType,
    borrow,
    borrowWalletType,
    recipientAddress
  }: {
    collateral: AnyAsset
    borrow: AnyAsset
    collateralWalletType: WalletType
    borrowWalletType: O.Option<WalletType>
    recipientAddress: O.Option<Address>
  }) => void
  walletBalances: Pick<BalancesState, 'balances' | 'loading'>
  borrowDeposit$: BorrowerDepositStateHandler
  goToTransaction: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  reloadSelectedPoolDetail: (delay?: number) => void
  approveERC20Token$: (params: ApproveParams) => TxHashLD
  reloadApproveFee: LoadApproveFeeHandler
  approveFee$: ApproveFeeHandler
  isApprovedERC20Token$: (params: IsApproveParams) => LiveData<ApiError, boolean>
  validatePassword$: ValidatePasswordHandler
  reloadFees: ReloadBorrowerDepositFeesHandler
  reloadBalances: FP.Lazy<void>
  disableLoanAction: boolean
  hidePrivateData: boolean
  dex: Dex
}

export const Borrow: React.FC<BorrowProps> = (props): JSX.Element => {
  const {
    keystore,
    getLoanQuoteOpen$,
    // reloadLoanQuoteOpen,
    poolDetails,
    collateralAsset,
    collateralWalletType: initialSourceWalletType,
    borrowAsset,
    borrowWalletType: oInitialBorrowWalletType,
    borrowAddress,
    walletBalances,
    network,
    pricePool,
    poolAddress: oPoolAddress,
    onChangeAsset,
    fees$,
    borrowDeposit$,
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
    disableLoanAction,
    hidePrivateData,
    dex
  } = props

  const intl = useIntl()

  const [oLoanQuote, setLoanQuote] = useState<O.Option<LoanOpenQuote>>(O.none)

  const [collaterizationRatio] = useState<number>(50)

  const { chain: sourceChain } = collateralAsset.asset
  const featureDisabled = true // feature not ready
  const lockedWallet: boolean = useMemo(() => isLocked(keystore) || !hasImportedKeystore(keystore), [keystore])

  const [oBorrowWalletType, setBorrowWalletType] = useState<O.Option<WalletType>>(oInitialBorrowWalletType)

  useEffect(() => {
    setBorrowWalletType(oInitialBorrowWalletType)
  }, [oInitialBorrowWalletType])
  const useLedger = isLedgerWallet(initialSourceWalletType)

  // Deposit start time
  const [depositStartTime, setDepositStartTime] = useState<number>(0)

  const prevAsset = useRef<O.Option<AnyAsset>>(O.none)

  const {
    state: depositState,
    reset: resetDepositState,
    subscribe: subscribeDepositState
  } = useSubscriptionState<BorrowerDepositState>(INITIAL_BORROWER_DEPOSIT_STATE)

  const { balances: oWalletBalances, loading: walletBalancesLoading } = walletBalances

  /**
   * Selectable source assets to loan.
   * Based on loan depth
   */
  const selectableAssets: AnyAsset[] = useMemo(() => {
    const result = FP.pipe(
      poolDetails,
      A.filter(({ totalCollateral }) => Number(totalCollateral) > 0),
      A.filterMap(({ asset: assetString }) => O.fromNullable(assetFromString(assetString)))
    )
    return result
  }, [poolDetails])

  /**
   * Selectable source assets to loan.
   * Based on loan depth
   */
  const selectableTargetAssets: AnyAsset[] = useMemo(() => {
    const result = FP.pipe(
      poolDetails,
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

  const hasLedger = useMemo(
    () => hasLedgerInBalancesByAsset(collateralAsset.asset, allBalances),
    [collateralAsset, allBalances]
  )

  const sourceWalletType: WalletType = useMemo(() => (useLedger ? 'ledger' : 'keystore'), [useLedger])

  // `oSourceAssetWB` of source asset - which might be none (user has no balances for this asset or wallet is locked)
  const oSourceAssetWB: O.Option<WalletBalance> = useMemo(() => {
    const oWalletBalances = NEA.fromArray(allBalances)
    const result = getWalletBalanceByAssetAndWalletType({
      oWalletBalances,
      asset: collateralAsset.asset,
      walletType: sourceWalletType
    })
    return result
  }, [collateralAsset, allBalances, sourceWalletType])

  // User balance for source asset
  const sourceAssetAmount: BaseAmount = useMemo(
    () =>
      FP.pipe(
        oSourceAssetWB,
        O.map(({ amount }) => amount),
        O.getOrElse(() => baseAmount(0, collateralAsset.decimal))
      ),
    [oSourceAssetWB, collateralAsset]
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
        O.getOrElse(() => baseAmount(0, collateralAsset.decimal))
      ),
    [oWalletBalances, collateralAsset, sourceChainAsset, sourceWalletType]
  )
  // *********** FEES **************
  const zeroBorrowerFees: BorrowerDepositFees = useMemo(
    () => Utils.getZeroLoanDepositFees(collateralAsset.asset),
    [collateralAsset]
  )

  const prevBorrowerFees = useRef<O.Option<BorrowerDepositFees>>(O.none)

  const [loanFeesRD] = useObservableState<BorrowerDepositFeesRD>(
    () =>
      FP.pipe(
        fees$(collateralAsset.asset as Asset),
        RxOp.map((fees) => {
          // store every successfully loaded fees
          if (RD.isSuccess(fees)) {
            prevBorrowerFees.current = O.some(fees.value)
          }
          return fees
        })
      ),
    RD.success(zeroBorrowerFees)
  )

  const loanFees: BorrowerDepositFees = useMemo(
    () =>
      FP.pipe(
        loanFeesRD,
        RD.toOption,
        O.alt(() => prevBorrowerFees.current),
        O.getOrElse(() => zeroBorrowerFees)
      ),
    [loanFeesRD, zeroBorrowerFees]
  )

  const initialAmountToLoanMax1e8 = useMemo(
    () => baseAmount(0, sourceAssetAmountMax1e8.decimal),
    [sourceAssetAmountMax1e8]
  )

  const [
    /* max. 1e8 decimal */
    amountToLoanMax1e8,
    _setAmountToLoanMax1e8 /* private - never set it directly, use setAmountToLoanMax1e8() instead */
  ] = useState(initialAmountToLoanMax1e8)

  const maxAmountToLoanMax1e8: BaseAmount = useMemo(() => {
    if (lockedWallet) return assetToBase(assetAmount(10000, sourceAssetAmountMax1e8.decimal))

    return Utils.maxAmountToLoanMax1e8({
      asset: collateralAsset.asset,
      balanceAmountMax1e8: sourceAssetAmountMax1e8,
      feeAmount: loanFees.asset.inFee
    })
  }, [lockedWallet, collateralAsset, sourceAssetAmountMax1e8, loanFees])

  // Set amount to loan
  const setAmountToLoanMax1e8 = useCallback(
    (amountToLoan: BaseAmount) => {
      const newAmount = baseAmount(amountToLoan.amount(), sourceAssetAmountMax1e8.decimal)
      // dirty check - do nothing if prev. and next amounts are equal
      if (eqBaseAmount.equals(newAmount, amountToLoanMax1e8)) return {}

      const newAmountToLoan = newAmount.gt(maxAmountToLoanMax1e8) ? maxAmountToLoanMax1e8 : newAmount

      _setAmountToLoanMax1e8({ ...newAmountToLoan })
    },
    [amountToLoanMax1e8, maxAmountToLoanMax1e8, sourceAssetAmountMax1e8]
  )
  // price of amount to send
  const priceAmountToLoanMax1e8: CryptoAmount = useMemo(() => {
    const result = FP.pipe(
      PoolHelpers.getPoolPriceValue({
        balance: { asset: collateralAsset.asset, amount: amountToLoanMax1e8 },
        poolDetails,
        pricePool
      }),
      O.getOrElse(() => baseAmount(0, amountToLoanMax1e8.decimal)),
      (amount) => ({ asset: pricePool.asset, amount })
    )

    return new CryptoAmount(result.amount, result.asset)
  }, [amountToLoanMax1e8, poolDetails, pricePool, collateralAsset])

  // price of amount to send
  const priceAmountMax1e8: CryptoAmount = useMemo(() => {
    const result = FP.pipe(
      PoolHelpers.getPoolPriceValue({
        balance: { asset: collateralAsset.asset, amount: maxAmountToLoanMax1e8 },
        poolDetails,
        pricePool
      }),
      O.getOrElse(() => baseAmount(0, amountToLoanMax1e8.decimal)),
      (amount) => ({ asset: pricePool.asset, amount })
    )

    return new CryptoAmount(result.amount, result.asset)
  }, [collateralAsset.asset, maxAmountToLoanMax1e8, poolDetails, pricePool, amountToLoanMax1e8.decimal])

  // Reccommend amount in for use later
  const reccommendedAmountIn: CryptoAmount = useMemo(
    () =>
      FP.pipe(
        oLoanQuote,
        O.fold(
          () => new CryptoAmount(baseAmount(0), collateralAsset.asset), // default value if oQuote is None
          (txDetails) => new CryptoAmount(txDetails.recommendedMinAmountIn, collateralAsset.asset)
        )
      ),
    [oLoanQuote, collateralAsset]
  )

  // Reccommend amount in for use later
  const amountToBorrow: CryptoAmount = useMemo(
    () =>
      FP.pipe(
        oLoanQuote,
        O.fold(
          () => new CryptoAmount(baseAmount(0), collateralAsset.asset), // default value if oQuote is None
          (txDetails) => new CryptoAmount(txDetails.expectedAmountOut, collateralAsset.asset)
        )
      ),
    [oLoanQuote, collateralAsset]
  )

  // Expected debt issued
  const debtAmount: CryptoAmount = useMemo(
    () =>
      FP.pipe(
        oLoanQuote,
        O.fold(
          () => new CryptoAmount(baseAmount(0), collateralAsset.asset), // default value if oQuote is None
          (txDetails) => new CryptoAmount(baseAmount(txDetails.expectedDebtIssued), collateralAsset.asset)
        )
      ),
    [oLoanQuote, collateralAsset]
  )

  // price of amount to send
  const priceAmountToBorrow: CryptoAmount = useMemo(() => {
    const result = FP.pipe(
      PoolHelpers.getPoolPriceValue({
        balance: { asset: amountToBorrow.asset, amount: amountToBorrow.baseAmount },
        poolDetails,
        pricePool
      }),
      O.getOrElse(() => baseAmount(0, amountToBorrow.baseAmount.decimal)),
      (amount) => ({ asset: pricePool.asset, amount })
    )

    return new CryptoAmount(result.amount, result.asset)
  }, [amountToBorrow.asset, amountToBorrow.baseAmount, poolDetails, pricePool])

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
        return isEthAsset(collateralAsset.asset)
          ? O.some(false)
          : O.some(isEthTokenAsset(collateralAsset.asset as TokenAsset))
      case AVAXChain:
        return isAvaxAsset(collateralAsset.asset)
          ? O.some(false)
          : O.some(isAvaxTokenAsset(collateralAsset.asset as TokenAsset))
      case BSCChain:
        return isBscAsset(collateralAsset.asset)
          ? O.some(false)
          : O.some(isBscTokenAsset(collateralAsset.asset as TokenAsset))
      case ARBChain:
        return isAethAsset(collateralAsset.asset)
          ? O.some(false)
          : O.some(isArbTokenAsset(collateralAsset.asset as TokenAsset))
      default:
        return O.none
    }
  }, [keystore, sourceChain, collateralAsset])

  const oApproveParams: O.Option<ApproveParams> = useMemo(() => {
    const oRouterAddress: O.Option<Address> = FP.pipe(
      oPoolAddress,
      O.chain(({ router }) => router)
    )

    const oTokenAddress: O.Option<string> = (() => {
      switch (sourceChain) {
        case ETHChain:
          return getEthTokenAddress(collateralAsset.asset as TokenAsset)
        case AVAXChain:
          return getAvaxTokenAddress(collateralAsset.asset as TokenAsset)
        case BSCChain:
          return getBscTokenAddress(collateralAsset.asset as TokenAsset)
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
  }, [needApprovement, network, oPoolAddress, oSourceAssetWB, collateralAsset.asset, sourceChain])
  // Boolean on if amount to send is zero
  const isZeroAmountToLoan = useMemo(() => amountToLoanMax1e8.amount().isZero(), [amountToLoanMax1e8])
  const minAmountError = useMemo(() => {
    if (isZeroAmountToLoan) return false

    return amountToLoanMax1e8.lt(reccommendedAmountIn.baseAmount)
  }, [amountToLoanMax1e8, isZeroAmountToLoan, reccommendedAmountIn])

  const sourceChainFeeError: boolean = useMemo(() => {
    // ignore error check by having zero amounts or min amount errors
    if (minAmountError) return false

    const { inFee } = loanFees.asset

    return inFee.gt(sourceChainAssetAmount)
  }, [minAmountError, sourceChainAssetAmount, loanFees])

  // memo check disable submit if no memo
  const noMemo: boolean = useMemo(
    () =>
      FP.pipe(
        oLoanQuote,
        O.fold(
          () => false, // default value if oSaverWithdrawQuote is None
          (txDetails) => txDetails.memo === ''
        )
      ),
    [oLoanQuote]
  )
  // memo check disable submit if no memo
  const quoteError: JSX.Element = useMemo(() => {
    if (!O.isSome(oLoanQuote) || oLoanQuote.value.notes || !oLoanQuote.value.warning) {
      return <></>
    }
    // Select first error
    const error = oLoanQuote.value.warning[0].split(':')

    return (
      <ErrorLabel>
        {intl.formatMessage({ id: 'swap.errors.amount.thornodeQuoteError' }, { error: `${error}` })}
      </ErrorLabel>
    )
  }, [oLoanQuote, intl])

  // Disables the submit button
  const disableSubmit = useMemo(
    () =>
      sourceChainFeeError ||
      isZeroAmountToLoan ||
      featureDisabled ||
      lockedWallet ||
      minAmountError ||
      walletBalancesLoading ||
      noMemo,
    [
      isZeroAmountToLoan,
      lockedWallet,
      minAmountError,
      noMemo,
      sourceChainFeeError,
      walletBalancesLoading,
      featureDisabled
    ]
  )

  const oQuoteLoanOpenData: O.Option<LoanOpenParams> = useMemo(
    () =>
      FP.pipe(
        sequenceTOption(O.some(borrowAddress), oSourceAssetWB),
        O.map(([borrowAddress, { walletAddress }]) => {
          const address = borrowAddress
          const affiliateAddress = ASGARDEX_ADDRESS === walletAddress ? undefined : ASGARDEX_THORNAME
          const affiliateBps = 0
          const minOut = '0'
          return {
            asset: collateralAsset.asset,
            amount: amountToLoanMax1e8,
            targetAsset: borrowAsset.asset,
            destination: address,
            minOut,
            affiliateBps,
            affiliate: affiliateAddress
          }
        })
      ),
    [amountToLoanMax1e8, collateralAsset.asset, borrowAddress, borrowAsset, oSourceAssetWB]
  )

  const hasFetched = useRef<boolean>(false)
  const previousAmount = useRef<BaseAmount | null>(null)

  useEffect(() => {
    FP.pipe(
      oQuoteLoanOpenData,
      O.fold(
        () => {
          hasFetched.current = false
        },
        (params) => {
          // Only fetch if amount has changed and is greater than 0
          if (params.amount.lte(0) || hasFetched.current) {
            setLoanQuote(O.none)
          } else {
            hasFetched.current = true
            previousAmount.current = params.amount

            getLoanQuoteOpen$(
              params.asset,
              params.amount,
              params.targetAsset,
              params.destination,
              params.minOut,
              params.affiliateBps,
              params.affiliate
            ).subscribe((loanOpenQuoteLD) => {
              if (RD.isSuccess(loanOpenQuoteLD)) {
                const loanQuote = loanOpenQuoteLD.value
                setLoanQuote(O.some(loanQuote))
              }
            })
          }
        }
      )
    )
  }, [getLoanQuoteOpen$, oLoanQuote, oQuoteLoanOpenData, oSourceAssetWB])

  const setCollateralAsset = useCallback(
    async (asset: AnyAsset) => {
      // delay to avoid render issues while switching
      await delay(100)

      onChangeAsset({
        collateral: asset,
        collateralWalletType: 'keystore',
        borrow: borrowAsset.asset,
        borrowWalletType: oBorrowWalletType,
        recipientAddress: O.some(borrowAddress)
      })
    },
    [borrowAddress, borrowAsset.asset, oBorrowWalletType, onChangeAsset]
  )

  const setBorrowAsset = useCallback(
    async (asset: AnyAsset) => {
      // delay to avoid render issues while switching
      await delay(100)

      onChangeAsset({
        collateral: collateralAsset.asset,
        collateralWalletType: 'keystore',
        borrow: asset,
        borrowWalletType: oBorrowWalletType,
        recipientAddress: O.some(borrowAddress)
      })
    },
    [borrowAddress, collateralAsset.asset, oBorrowWalletType, onChangeAsset]
  )

  const prevApproveFee = useRef<O.Option<BaseAmount>>(O.none)

  const [approveFeeRD, approveFeesParamsUpdated] = useObservableState<FeeRD, ApproveParams>((approveFeeParam$) => {
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

  // const reloadQuoteLoanOpenHandler = useCallback(() => {
  //   FP.pipe(oQuoteLoanOpenData, O.map(reloadLoanQuoteOpen))
  // }, [oQuoteLoanOpenData, reloadLoanQuoteOpen])

  const reloadFeesHandler = useCallback(() => {
    reloadFees(collateralAsset.asset as Asset)
  }, [reloadFees, collateralAsset])

  const zeroBaseAmountMax = useMemo(() => baseAmount(0, collateralAsset.decimal), [collateralAsset])

  const zeroBaseAmountMax1e8 = useMemo(() => max1e8BaseAmount(zeroBaseAmountMax), [zeroBaseAmountMax])

  const maxBalanceInfoTxt = useMemo(() => {
    const balanceLabel = formatAssetAmountCurrency({
      amount: baseToAsset(sourceAssetAmountMax1e8),
      asset: collateralAsset.asset,
      decimal: isUSDAsset(collateralAsset.asset) ? 2 : 8, // use 8 decimal as same we use in maxAmountToLoanMax1e8
      trimZeros: !isUSDAsset(collateralAsset.asset)
    })

    const feeLabel = FP.pipe(
      loanFeesRD,
      RD.map(({ asset: { inFee, asset: feeAsset } }) =>
        formatAssetAmountCurrency({
          amount: baseToAsset(inFee),
          asset: feeAsset,
          decimal: isUSDAsset(feeAsset) ? 2 : 8, // use 8 decimal as same we use in maxAmountToLoanMax1e8
          trimZeros: !isUSDAsset(feeAsset)
        })
      ),
      RD.getOrElse(() => noDataString)
    )

    return intl.formatMessage({ id: 'loan.info.max.balance' }, { balance: balanceLabel, fee: feeLabel })
  }, [sourceAssetAmountMax1e8, loanFeesRD, collateralAsset, intl])

  const resetEnteredAmounts = useCallback(() => {
    setAmountToLoanMax1e8(initialAmountToLoanMax1e8)
  }, [initialAmountToLoanMax1e8, setAmountToLoanMax1e8])

  const oBorrowParams: O.Option<BorrowerDepositParams> = useMemo(() => {
    return FP.pipe(
      sequenceTOption(oPoolAddress, oSourceAssetWB, oLoanQuote),
      O.map(([poolAddress, { walletType, walletAddress, walletAccount, walletIndex, hdMode }, loansQuote]) => {
        const result = {
          poolAddress,
          asset: collateralAsset.asset,
          amount: convertBaseAmountDecimal(amountToLoanMax1e8, collateralAsset.decimal),
          memo: loansQuote.memo !== '' ? loansQuote.memo.concat(`::${ASGARDEX_THORNAME}:0`) : '', // add tracking,
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
  }, [oPoolAddress, oSourceAssetWB, oLoanQuote, collateralAsset, amountToLoanMax1e8, dex])

  const onClickUseLedger = useCallback(
    (useLedger: boolean) => {
      const walletType: WalletType = useLedger ? 'ledger' : 'keystore'
      console.log(oBorrowWalletType)
      onChangeAsset({
        collateral: collateralAsset.asset,
        collateralWalletType: walletType,
        borrow: borrowAsset.asset,
        borrowWalletType: oBorrowWalletType,
        recipientAddress: O.some(borrowAddress)
      })
      resetEnteredAmounts()
    },
    [borrowAddress, borrowAsset.asset, collateralAsset.asset, oBorrowWalletType, onChangeAsset, resetEnteredAmounts]
  )

  const onClickUseBorrowAssetLedger = useCallback(
    (useLedger: boolean) => {
      const walletType: WalletType = useLedger ? 'ledger' : 'keystore'
      onChangeAsset({
        collateral: collateralAsset.asset,
        collateralWalletType: initialSourceWalletType,
        borrow: borrowAsset.asset,
        borrowWalletType: O.some(walletType),
        recipientAddress: O.some(borrowAddress)
      })
      resetEnteredAmounts()
    },
    [
      borrowAddress,
      borrowAsset.asset,
      collateralAsset.asset,
      initialSourceWalletType,
      onChangeAsset,
      resetEnteredAmounts
    ]
  )

  const txModalExtraContent = useMemo(() => {
    const stepDescriptions = [
      intl.formatMessage({ id: 'common.tx.healthCheck' }),
      intl.formatMessage({ id: 'common.tx.sendingAsset' }, { assetTicker: collateralAsset.asset.ticker }),
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
        source={O.some({ asset: collateralAsset.asset, amount: amountToLoanMax1e8 })}
        stepDescription={stepDescription}
        network={network}
      />
    )
  }, [intl, collateralAsset, depositState, amountToLoanMax1e8, network])

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
        () => 'loan.borrow.state.sending',
        () => 'loan.borrow.state.pending',
        () => 'loan.borrow.state.error',
        () => 'loan.borrow.state.success'
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
            label={intl.formatMessage({ id: 'common.tx.view' }, { assetTicker: collateralAsset.asset.ticker })}
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
    collateralAsset.asset.ticker,
    txModalExtraContent,
    sourceChain
  ])

  const submitDepositTx = useCallback(() => {
    FP.pipe(
      oBorrowParams,
      O.map((borrowParams) => {
        // set start time
        setDepositStartTime(Date.now())
        // subscribe to borrowDeposit$
        subscribeDepositState(borrowDeposit$(borrowParams))

        return true
      })
    )
  }, [oBorrowParams, subscribeDepositState, borrowDeposit$])

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
    if (!eqOAsset.equals(prevAsset.current, O.some(collateralAsset.asset))) {
      prevAsset.current = O.some(collateralAsset.asset)
      // reset deposit state
      resetDepositState()
      // reset isApproved state
      resetIsApprovedState()
      // reset approve state
      resetApproveState()
      // reload fees
      reloadFeesHandler()
    }
  }, [collateralAsset, reloadFeesHandler, resetApproveState, resetIsApprovedState, resetDepositState])

  /**
   * Callback whenever assets have been changed
   */
  useEffect(() => {
    let doReset = false
    // reset data whenever source asset has been changed
    if (!eqOAsset.equals(prevAsset.current, O.some(collateralAsset.asset))) {
      prevAsset.current = O.some(collateralAsset.asset)
      doReset = true
    }

    // reset only once
    if (doReset) reset()

    // Note: useEffect does depend on `sourceAssetProp`, `targetAssetProp` - ignore other values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collateralAsset.asset])

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
            {intl.formatMessage(
              { id: 'common.approve.error' },
              { asset: collateralAsset.asset.ticker, error: error.msg }
            )}
          </p>
        ),
        (_) => <></>
      )
    )
  }, [checkIsApprovedError, intl, isApprovedState, collateralAsset])
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
            asset: collateralAsset.asset,
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
    [intl, minAmountError, collateralAsset, reccommendedAmountIn]
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
      isEvmChain(collateralAsset.asset.chain) && isEvmToken(collateralAsset.asset)
        ? `${txtNeedsConnected} ${intl.formatMessage(
            {
              id: 'ledger.blindsign'
            },
            { chain: chainAsString }
          )}`
        : txtNeedsConnected

    const description2 = intl.formatMessage({ id: 'ledger.sign' })

    const addresses = FP.pipe(
      oBorrowParams,
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
    collateralAsset.asset,
    oBorrowParams,
    network,
    submitDepositTx,
    submitApproveTx,
    useLedger
  ])

  const renderSlider = useMemo(() => {
    const percentage = amountToLoanMax1e8
      .amount()
      .dividedBy(maxAmountToLoanMax1e8.amount())
      .multipliedBy(100)
      // Remove decimal of `BigNumber`s used within `BaseAmount` and always round down for currencies
      .decimalPlaces(0, BigNumber.ROUND_DOWN)
      .toNumber()

    const setAmountToLoanFromPercentValue = (percents: number) => {
      const amountFromPercentage = maxAmountToLoanMax1e8.amount().multipliedBy(percents / 100)
      return setAmountToLoanMax1e8(baseAmount(amountFromPercentage, amountToLoanMax1e8.decimal))
    }

    return (
      <Slider
        key={'swap percentage slider'}
        value={percentage}
        onChange={setAmountToLoanFromPercentValue}
        onAfterChange={reloadFeesHandler}
        tooltipVisible
        tipFormatter={(value) => `${value}%`}
        withLabel
        tooltipPlacement={'top'}
        disabled={disableLoanAction}
      />
    )
  }, [amountToLoanMax1e8, disableLoanAction, maxAmountToLoanMax1e8, reloadFeesHandler, setAmountToLoanMax1e8])

  // Price of asset IN fee
  const oPriceAssetInFee: O.Option<AssetWithAmount> = useMemo(() => {
    const asset = loanFees.asset.asset
    const amount = loanFees.asset.inFee

    return FP.pipe(
      PoolHelpers.getPoolPriceValue({
        balance: { asset, amount },
        poolDetails,
        pricePool
      }),
      O.map((amount) => ({ amount, asset: pricePool.asset }))
    )
  }, [poolDetails, pricePool, loanFees])

  const priceFeesLabel = useMemo(
    () =>
      FP.pipe(
        loanFeesRD,
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

    [loanFeesRD, oPriceAssetInFee]
  )
  // label for Price in fee
  const priceInFeeLabel = useMemo(
    () =>
      FP.pipe(
        loanFeesRD,
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

    [loanFeesRD, oPriceAssetInFee]
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
          <div className="text-12 text-gray2 dark:border-gray1d dark:text-gray2d">
            <div className="rounded text-warning0 dark:text-warning0d">
              {intl.formatMessage({ id: 'common.featureUnderDevelopment' })}
            </div>
            <div className="flex pb-4"></div>
          </div>
          <AssetInput
            className="w-full"
            title={intl.formatMessage({ id: 'common.collateral' })}
            amount={{ amount: amountToLoanMax1e8, asset: collateralAsset.asset }}
            priceAmount={{ asset: priceAmountToLoanMax1e8.asset, amount: priceAmountToLoanMax1e8.baseAmount }}
            assets={selectableAssets}
            network={network}
            onChangeAsset={setCollateralAsset}
            onChange={setAmountToLoanMax1e8}
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
                    // show warn icon if maxAmountToLoanMax1e8 <= 0
                    maxAmountToLoanMax1e8.gt(zeroBaseAmountMax1e8)
                      ? `text-gray2 dark:text-gray2d`
                      : 'text-warning0 dark:text-warning0d'
                  }
                  size="medium"
                  balance={{ amount: maxAmountToLoanMax1e8, asset: collateralAsset.asset }}
                  maxDollarValue={priceAmountMax1e8}
                  onClick={() => setAmountToLoanMax1e8(maxAmountToLoanMax1e8)}
                  maxInfoText={maxBalanceInfoTxt}
                />
                {minAmountError && renderMinAmount}
              </div>
            }
          />

          <div className="w-full px-20px">{renderSlider}</div>
          <div className="flex w-full flex-col items-center justify-center px-5">
            <div className="flex pt-6 text-gray2 dark:text-gray2d">
              {intl.formatMessage({ id: 'loan.detail.collaterizationRatio' })}
            </div>
            <div className="w-1/2">{`${collaterizationRatio}%`}</div>
          </div>
          <div className="flex flex-col pt-20px">
            <AssetInput
              className="w-full"
              title={intl.formatMessage({ id: 'common.borrow' })}
              amount={{ amount: amountToBorrow.baseAmount, asset: borrowAsset.asset }}
              priceAmount={{ asset: priceAmountToBorrow.asset, amount: priceAmountToBorrow.baseAmount }}
              assets={selectableTargetAssets}
              network={network}
              onChangeAsset={setBorrowAsset}
              onChange={setAmountToLoanMax1e8}
              onBlur={reloadFeesHandler}
              showError={minAmountError}
              hasLedger={hasLedger}
              useLedger={useLedger}
              useLedgerHandler={onClickUseBorrowAssetLedger}
            />
          </div>
          <div className="flex flex-col items-center justify-between py-30px">
            {renderIsApprovedError}
            {(walletBalancesLoading || checkIsApproved) && (
              <LoadingView
                className="mb-20px"
                label={
                  checkIsApproved
                    ? intl.formatMessage({ id: 'common.approve.checking' }, { asset: collateralAsset.asset.ticker })
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
                    {intl.formatMessage({ id: 'common.borrow' })}
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
              {/* debt */}
              <div className="flex w-full items-center justify-between font-mainBold">
                {intl.formatMessage({ id: 'common.debt' })}
                <div>
                  {formatAssetAmountCurrency({
                    amount: debtAmount.assetAmount,
                    asset: collateralAsset.asset,
                    decimal: 0
                  })}
                </div>
              </div>
              {/* fees */}
              <div className="flex w-full items-center justify-between font-mainBold">
                <BaseButton
                  disabled={RD.isPending(loanFeesRD) || RD.isInitial(loanFeesRD)}
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
                </>
              )}
              {/* Add loan transaction time only inbound */}
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
                  <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                    <div>{`${intl.formatMessage({ id: 'common.debt' })} ${intl.formatMessage({
                      id: 'common.address'
                    })}`}</div>
                    <div className="truncate pl-20px text-[13px] normal-case leading-normal">
                      <TooltipAddress title={borrowAddress} key="tooltip-recipient-addr">
                        {borrowAddress}
                      </TooltipAddress>
                    </div>
                  </div>
                  {/* inbound address */}
                  {FP.pipe(
                    oBorrowParams,
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
                            amount: baseToAsset(maxAmountToLoanMax1e8),
                            asset: collateralAsset.asset,
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
                      oBorrowParams,
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
