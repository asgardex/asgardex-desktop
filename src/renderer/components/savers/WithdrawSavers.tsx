import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowPathIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { PoolDetails } from '@xchainjs/xchain-midgard'
import { EstimateWithdrawSaver, ThorchainQuery } from '@xchainjs/xchain-thorchain-query'
import {
  Address,
  Asset,
  assetAmount,
  assetFromString,
  BaseAmount,
  baseAmount,
  baseToAsset,
  assetToBase,
  delay,
  formatAssetAmountCurrency,
  eqAsset,
  CryptoAmount,
  AnyAsset,
  TokenAsset
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
import { chainToString } from '../../../shared/utils/chain'
import { isLedgerWallet } from '../../../shared/utils/guard'
import { WalletType } from '../../../shared/wallet/types'
import { AssetUSDC, ZERO_BASE_AMOUNT } from '../../const'
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
import { sequenceTOption, sequenceTOptionFromArray } from '../../helpers/fpHelpers'
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
import { INITIAL_SAVER_WITHDRAW_STATE } from '../../services/chain/const'
import {
  FeeRD,
  ReloadSaverDepositFeesHandler,
  SaverWithdrawFeesHandler,
  SaverWithdrawFeesRD,
  SaverWithdrawParams,
  SaverWithdrawStateHandler,
  WithdrawAssetFees,
  WithdrawState
} from '../../services/chain/types'
import { OpenExplorerTxUrl, GetExplorerTxUrl, WalletBalances } from '../../services/clients'
import {
  ApproveFeeHandler,
  ApproveParams,
  IsApprovedRD,
  IsApproveParams,
  LoadApproveFeeHandler
} from '../../services/evm/types'
import { PoolAddress } from '../../services/midgard/types'
import { SaverProviderLD } from '../../services/thorchain/types'
import {
  KeystoreState,
  BalancesState,
  TxHashLD,
  ApiError,
  ValidatePasswordHandler,
  WalletBalance,
  TxHashRD
} from '../../services/wallet/types'
import { hasImportedKeystore, isLocked } from '../../services/wallet/util'
import { PricePool } from '../../views/pools/Pools.types'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../modal/confirmation'
import { TxModal } from '../modal/tx'
import { DepositAsset } from '../modal/tx/extra/DepositAsset'
import { LoadingView } from '../shared/loading'
import { AssetInput } from '../uielements/assets/assetInput'
import { BaseButton, FlatButton, ViewTxButton } from '../uielements/button'
import { MaxBalanceButton } from '../uielements/button/MaxBalanceButton'
import { Tooltip, TooltipAddress } from '../uielements/common/Common.styles'
import { Fees, UIFeesRD } from '../uielements/fees'
import { Slider } from '../uielements/slider'
import * as Utils from './Saver.utils'

export const ASSET_SELECT_BUTTON_WIDTH = 'w-[180px]'

export type WithDrawProps = {
  keystore: KeystoreState
  thorchainQuery: ThorchainQuery
  poolAssets: AnyAsset[]
  poolDetails: PoolDetails
  asset: CryptoAmount
  address: Address
  network: Network
  pricePool: PricePool
  poolAddress: O.Option<PoolAddress>
  saverPosition: (asset: AnyAsset, address: string) => SaverProviderLD
  fees$: SaverWithdrawFeesHandler
  sourceWalletType: WalletType
  onChangeAsset: ({ source, sourceWalletType }: { source: AnyAsset; sourceWalletType: WalletType }) => void
  walletBalances: Pick<BalancesState, 'balances' | 'loading'>
  goToTransaction: OpenExplorerTxUrl
  getExplorerTxUrl: GetExplorerTxUrl
  reloadSelectedPoolDetail: (delay?: number) => void
  approveERC20Token$: (params: ApproveParams) => TxHashLD
  reloadApproveFee: LoadApproveFeeHandler
  approveFee$: ApproveFeeHandler
  isApprovedERC20Token$: (params: IsApproveParams) => LiveData<ApiError, boolean>
  validatePassword$: ValidatePasswordHandler
  reloadFees: ReloadSaverDepositFeesHandler
  saverWithdraw$: SaverWithdrawStateHandler
  reloadBalances: FP.Lazy<void>
  disableSaverAction: boolean
  hidePrivateData: boolean
  dex: Dex
}

export const WithdrawSavers: React.FC<WithDrawProps> = (props): JSX.Element => {
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
    saverPosition,
    onChangeAsset,
    address,
    fees$,
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
    saverWithdraw$,
    disableSaverAction,
    hidePrivateData,
    dex
  } = props

  const intl = useIntl()

  const [oSaverWithdrawQuote, setSaverWithdrawQuote] = useState<O.Option<EstimateWithdrawSaver>>(O.none)

  const { chain: sourceChain } = asset.asset
  const { asset: sourceAsset } = asset

  const lockedWallet: boolean = useMemo(() => isLocked(keystore) || !hasImportedKeystore(keystore), [keystore])

  const useLedger = isLedgerWallet(initialSourceWalletType)

  const sourceWalletType: WalletType = useMemo(() => (useLedger ? 'ledger' : 'keystore'), [useLedger])

  const [withdrawStartTime, setWithdrawStartTime] = useState<number>(0)

  const prevAsset = useRef<O.Option<AnyAsset>>(O.none)

  const {
    state: withdrawState,
    reset: resetWithdrawState,
    subscribe: subscribeWithdrawState
  } = useSubscriptionState<WithdrawState>(INITIAL_SAVER_WITHDRAW_STATE)

  const { balances: oWalletBalances, loading: walletBalancesLoading } = walletBalances

  // Observable chain asset balance
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

  // Chain asset balance
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
        return isEthAsset(sourceAsset) ? O.some(false) : O.some(isEthTokenAsset(sourceAsset as TokenAsset))
      case AVAXChain:
        return isAvaxAsset(sourceAsset) ? O.some(false) : O.some(isAvaxTokenAsset(sourceAsset as TokenAsset))
      case BSCChain:
        return isBscAsset(sourceAsset) ? O.some(false) : O.some(isBscTokenAsset(sourceAsset as TokenAsset))
      case ARBChain:
        return isAethAsset(sourceAsset) ? O.some(false) : O.some(isArbTokenAsset(sourceAsset as TokenAsset))
      default:
        return O.none
    }
  }, [keystore, sourceAsset, sourceChain])
  /**
   * Selectable source assets to add to savers.
   * Based on savers the address has
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

  const hasLedger = useMemo(() => hasLedgerInBalancesByAsset(sourceAsset, allBalances), [sourceAsset, allBalances])

  // *********** FEES **************
  const zeroSaverFees: WithdrawAssetFees = useMemo(() => Utils.getZeroSaverWithdrawFees(sourceAsset), [sourceAsset])

  const prevSaverFees = useRef<O.Option<WithdrawAssetFees>>(O.none)

  const [saverFeesRD] = useObservableState<SaverWithdrawFeesRD>(
    () =>
      FP.pipe(
        fees$(sourceAsset),
        RxOp.map((fees) => {
          // store every successfully loaded fees
          if (RD.isSuccess(fees)) {
            prevSaverFees.current = O.some(fees.value)
          }
          return fees
        })
      ),
    RD.success(zeroSaverFees)
  )

  const saverFees: WithdrawAssetFees = useMemo(
    () =>
      FP.pipe(
        saverFeesRD,
        RD.toOption,
        O.alt(() => prevSaverFees.current),
        O.getOrElse(() => zeroSaverFees)
      ),
    [saverFeesRD, zeroSaverFees]
  )
  // source chain asset
  const sourceChainAsset: Asset = useMemo(() => getChainAsset(sourceChain), [sourceChain])

  // `oSourceAssetWB` of source asset - which might be none (user has no balances for this asset or wallet is locked)
  const oSourceAssetWB: O.Option<WalletBalance> = useMemo(() => {
    const oWalletBalances = NEA.fromArray(allBalances)
    const result = getWalletBalanceByAssetAndWalletType({
      oWalletBalances,
      asset: sourceChainAsset,
      walletType: sourceWalletType
    })
    return result
  }, [allBalances, sourceChainAsset, sourceWalletType])

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

  // User Saver redeem Amount for source asset
  const [saverAssetAmount, setSaverAssetAmount] = useState<CryptoAmount>(
    new CryptoAmount(baseAmount(0, asset.baseAmount.decimal), sourceAsset)
  )

  useEffect(() => {
    const subscription = saverPosition(sourceAsset, address).subscribe((saverProviderRD) => {
      if (RD.isSuccess(saverProviderRD)) {
        // Replace with the actual check for RemoteData's success state
        const saverProvider = saverProviderRD.value // Replace 'value' with the correct property if needed
        setSaverAssetAmount(new CryptoAmount(saverProvider.redeemValue, sourceAsset))
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [address, saverPosition, sourceAsset])

  // set init amount
  const initialAmountToWithdrawMax1e8 = useMemo(
    () => baseAmount(0, saverAssetAmount.baseAmount.decimal),
    [saverAssetAmount]
  )

  const [
    /* max. 1e8 decimal */
    amountToWithdrawMax1e8,
    _setAmountToWithdrawMax1e8 /* private - never set it directly, use setAmountToSendMax1e8() instead */
  ] = useState(initialAmountToWithdrawMax1e8)

  /** Balance of source asset converted to <= 1e8 */
  const saverAssetAmountMax1e8: BaseAmount = useMemo(
    () => max1e8BaseAmount(saverAssetAmount.baseAmount),
    [saverAssetAmount]
  )
  // max amount to withdraw is 100% saver position
  const maxAmountToWithdrawMax1e8: BaseAmount = useMemo(() => {
    if (lockedWallet) return assetToBase(assetAmount(10000, saverAssetAmountMax1e8.decimal))

    return saverAssetAmountMax1e8
  }, [lockedWallet, saverAssetAmountMax1e8])

  // store maxAmountValue
  const [maxAmountPriceValue, setMaxAmountPriceValue] = useState<CryptoAmount>(
    new CryptoAmount(baseAmount(0), sourceAsset)
  )

  // useEffect to fetch data from query
  useEffect(() => {
    const maxCryptoAmount = new CryptoAmount(maxAmountToWithdrawMax1e8, sourceAsset)
    const fetchData = async () => {
      setMaxAmountPriceValue(await thorchainQuery.convert(maxCryptoAmount, AssetUSDC))
    }

    fetchData()
  }, [sourceAsset, maxAmountPriceValue, maxAmountToWithdrawMax1e8, thorchainQuery])

  // Set amount to send
  const setAmountToWithdrawMax1e8 = useCallback(
    (amountToSend: BaseAmount) => {
      const newAmount = baseAmount(amountToSend.amount(), saverAssetAmountMax1e8.decimal)
      // dirty check - do nothing if prev. and next amounts are equal
      if (eqBaseAmount.equals(newAmount, amountToWithdrawMax1e8)) return {}

      const newAmountToSend = newAmount.gt(saverAssetAmountMax1e8) ? saverAssetAmountMax1e8 : newAmount

      _setAmountToWithdrawMax1e8({ ...newAmountToSend })
    },
    [amountToWithdrawMax1e8, saverAssetAmountMax1e8]
  )

  // Chain Dust threshold, can't send less than this amount.
  const dustThreshold: CryptoAmount = useMemo(
    () =>
      FP.pipe(
        oSaverWithdrawQuote,
        O.fold(
          () => new CryptoAmount(baseAmount(0), sourceAsset), // default value if oSaverWithdrawQuote is None
          (txDetails) => txDetails.dustThreshold
        )
      ),
    [oSaverWithdrawQuote, sourceAsset]
  )
  const [sourceChainAssetDecimals, setSourceChainAssetDecimals] = useState<number>(0)

  // useEffect to fetch data from query
  useEffect(() => {
    const fetchData = async () => {
      setSourceChainAssetDecimals(await thorchainQuery.thorchainCache.midgardQuery.getDecimalForAsset(sourceChainAsset))
    }

    fetchData()
  }, [thorchainQuery, sourceChainAsset])

  const dustAmount: BaseAmount = useMemo(
    () =>
      FP.pipe(
        oSaverWithdrawQuote,
        O.fold(
          () => baseAmount(0), // default value if oSaverWithdrawQuote is None
          (txDetails) => {
            const amount = convertBaseAmountDecimal(txDetails.dustAmount.baseAmount, sourceChainAssetDecimals)
            return amount
          }
        )
      ),
    [oSaverWithdrawQuote, sourceChainAssetDecimals]
  )

  const memoInvalid: boolean = useMemo(
    () =>
      FP.pipe(
        oSaverWithdrawQuote,
        O.fold(
          () => false, // default value if oSaverWithdrawQuote is None
          (txDetails) => txDetails.memo === ''
        )
      ),
    [oSaverWithdrawQuote]
  )

  // price of amount to withdraw
  const priceAmountToWithdrawMax1e8: CryptoAmount = useMemo(() => {
    const result = FP.pipe(
      PoolHelpers.getPoolPriceValue({
        balance: { asset: sourceAsset, amount: amountToWithdrawMax1e8 },
        poolDetails,
        pricePool
      }),
      O.getOrElse(() => baseAmount(0, amountToWithdrawMax1e8.decimal)),
      (amount) => ({ asset: pricePool.asset, amount })
    )

    return new CryptoAmount(result.amount, result.asset)
  }, [amountToWithdrawMax1e8, poolDetails, pricePool, sourceAsset])

  // Boolean on if amount to send is zero
  const isZeroAmountToSend = useMemo(() => amountToWithdrawMax1e8.amount().isZero(), [amountToWithdrawMax1e8])

  const sourceChainFeeError: boolean = useMemo(() => {
    // ignore error check by having zero amounts
    if (amountToWithdrawMax1e8) return false

    const { inFee } = saverFees
    // check against in fee and dust threshold
    return inFee.gt(chainAssetBalance) || dustThreshold.baseAmount.gt(chainAssetBalance)
  }, [amountToWithdrawMax1e8, saverFees, chainAssetBalance, dustThreshold.baseAmount])

  const [oWithdrawBps, setWithdrawBps] = useState<O.Option<number>>(O.none) // init state

  // Disables the submit button
  const disableSubmit = useMemo(
    () =>
      sourceChainFeeError ||
      isZeroAmountToSend ||
      lockedWallet ||
      walletBalancesLoading ||
      !O.isSome(oSaverWithdrawQuote) ||
      memoInvalid,
    [sourceChainFeeError, isZeroAmountToSend, lockedWallet, walletBalancesLoading, oSaverWithdrawQuote, memoInvalid]
  )

  const debouncedEffect = useRef(
    debounce((asset, address, withdrawBps) => {
      thorchainQuery
        .estimateWithdrawSaver({ asset: asset, address: address, withdrawBps: Number(withdrawBps) })
        .then((quote) => {
          setSaverWithdrawQuote(O.some(quote))
        })
        .catch((error) => {
          console.error('Failed to get quote:', error)
          setSaverWithdrawQuote(O.none)
        })
    }, 500)
  )

  useEffect(() => {
    // Check if oWithdrawBps is Some and its value is not 0, and also if there's no sourceChainFeeError
    if (O.isSome(oWithdrawBps) && oWithdrawBps.value !== 0 && !sourceChainFeeError) {
      debouncedEffect.current(sourceAsset, address, oWithdrawBps.value)
    }
  }, [oWithdrawBps, sourceChainFeeError, sourceAsset, address])

  // Outbound fee in for use later
  // quote fee is returned in the withdraw asset
  const outboundFee: CryptoAmount = useMemo(
    () =>
      FP.pipe(
        oSaverWithdrawQuote,
        O.fold(
          () => new CryptoAmount(saverFees.outFee, sourceChainAsset), // default value if oQuote is None
          (txDetails) => {
            const outboundFee = convertBaseAmountDecimal(txDetails.fee.outbound.baseAmount, sourceChainAssetDecimals)
            return new CryptoAmount(outboundFee, txDetails.fee.asset)
          }
          // already of type cryptoAmount
        )
      ),
    [oSaverWithdrawQuote, saverFees.outFee, sourceChainAsset, sourceChainAssetDecimals]
  )

  // Outbound fee in for use later
  const liquidityFee: CryptoAmount = useMemo(
    () =>
      FP.pipe(
        oSaverWithdrawQuote,
        O.fold(
          () => new CryptoAmount(baseAmount(0, saverFees.inFee.decimal), sourceChainAsset), // default value if oQuote is None
          (txDetails) => {
            const liquidityFee = convertBaseAmountDecimal(txDetails.fee.liquidity.baseAmount, sourceChainAssetDecimals)
            return new CryptoAmount(liquidityFee, txDetails.fee.asset)
          }
        )
      ),
    [oSaverWithdrawQuote, saverFees.inFee.decimal, sourceChainAsset, sourceChainAssetDecimals]
  )

  // Boolean on if amount to send is zero
  const zeroBaseAmountMax = useMemo(() => baseAmount(0, asset.baseAmount.decimal), [asset])

  const zeroBaseAmountMax1e8 = useMemo(() => max1e8BaseAmount(zeroBaseAmountMax), [zeroBaseAmountMax])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const maxBalanceInfoTxt = useMemo(() => {
    const balanceLabel = formatAssetAmountCurrency({
      amount: baseToAsset(saverAssetAmountMax1e8),
      asset: sourceAsset,
      decimal: isUSDAsset(sourceAsset) ? 2 : 8, // use 8 decimal as same we use in maxAmountToSwapMax1e8
      trimZeros: !isUSDAsset(sourceAsset)
    })
    const feeLabel = FP.pipe(
      saverFeesRD,
      RD.map(({ asset: feeAsset, inFee }) =>
        formatAssetAmountCurrency({
          amount: baseToAsset(inFee),
          asset: feeAsset,
          decimal: isUSDAsset(feeAsset) ? 2 : 8, // use 8 decimal as same we use in maxAmountToSwapMax1e8
          trimZeros: !isUSDAsset(feeAsset)
        })
      ),
      RD.getOrElse(() => noDataString)
    )

    return intl.formatMessage({ id: 'savers.info.max.redeem.value' }, { balance: balanceLabel, fee: feeLabel })
  }, [saverAssetAmountMax1e8, sourceAsset, saverFeesRD, intl])

  // State for values of `isApprovedERC20Token$`
  const {
    state: isApprovedState,
    reset: resetIsApprovedState,
    subscribe: subscribeIsApprovedState
  } = useSubscriptionState<IsApprovedRD>(RD.initial)

  // State for values of Approved
  const {
    state: approveState,
    reset: resetApproveState,
    subscribe: subscribeApproveState
  } = useSubscriptionState<TxHashRD>(RD.initial)

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

  const oApproveParams: O.Option<ApproveParams> = useMemo(() => {
    const oRouterAddress: O.Option<Address> = FP.pipe(
      oPoolAddress,
      O.chain(({ router }) => router)
    )
    //tobeFixed
    const oTokenAddress: O.Option<string> = (() => {
      switch (sourceChain) {
        case ETHChain:
          return getEthTokenAddress(sourceAsset as TokenAsset)
        case AVAXChain:
          return getAvaxTokenAddress(sourceAsset as TokenAsset)
        case BSCChain:
          return getBscTokenAddress(sourceAsset as TokenAsset)
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
  }, [needApprovement, network, oPoolAddress, oSourceAssetWB, sourceAsset, sourceChain])

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

  const reloadFeesHandler = useCallback(() => {
    reloadFees(sourceAsset)
  }, [reloadFees, sourceAsset])

  const reloadApproveFeesHandler = useCallback(() => {
    FP.pipe(oApproveParams, O.map(reloadApproveFee))
  }, [oApproveParams, reloadApproveFee])

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

  type ModalState = 'withdraw' | 'approve' | 'none'
  const [showPasswordModal, setShowPasswordModal] = useState<ModalState>('none')
  const [showLedgerModal, setShowLedgerModal] = useState<ModalState>('none')

  const onSubmit = useCallback(() => {
    if (useLedger) {
      setShowLedgerModal('withdraw')
    } else {
      setShowPasswordModal('withdraw')
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
            {intl.formatMessage({ id: 'common.approve.error' }, { asset: sourceAsset.ticker, error: error.msg })}
          </p>
        ),
        (_) => <></>
      )
    )
  }, [checkIsApprovedError, intl, isApprovedState, sourceAsset])
  const disableSubmitApprove = useMemo(
    () => checkIsApprovedError || isApproveFeeError || walletBalancesLoading,

    [checkIsApprovedError, isApproveFeeError, walletBalancesLoading]
  )

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

  useEffect(() => {
    if (!eqOAsset.equals(prevAsset.current, O.some(sourceAsset))) {
      prevAsset.current = O.some(sourceAsset)
      // reset deposit state
      resetWithdrawState()
      // reset isApproved state
      resetIsApprovedState()
      // reset approve state
      resetApproveState()
      // reload fees
      reloadFeesHandler()
      // Set quote to none
      setSaverWithdrawQuote(O.none)
    }
  }, [
    sourceAsset,
    reloadFeesHandler,
    resetApproveState,
    resetIsApprovedState,
    reloadSelectedPoolDetail,
    resetWithdrawState
  ])

  // Withdraw saver Params only send dust amount
  const oWithdrawSaverParams: O.Option<SaverWithdrawParams> = useMemo(() => {
    return FP.pipe(
      sequenceTOption(oPoolAddress, oSourceAssetWB, oSaverWithdrawQuote),
      O.map(([poolAddress, { walletType, walletAccount, walletIndex, hdMode }, saversWithdrawQuote]) => {
        const result = {
          poolAddress,
          asset: sourceChainAsset,
          amount: dustAmount,
          memo: saversWithdrawQuote.memo,
          network,
          walletType,
          walletAccount,
          walletIndex,
          sender: address,
          hdMode,
          dex
        }
        return result
      })
    )
  }, [oPoolAddress, oSourceAssetWB, oSaverWithdrawQuote, sourceChainAsset, dustAmount, network, address, dex])

  const resetEnteredAmounts = useCallback(() => {
    setAmountToWithdrawMax1e8(initialAmountToWithdrawMax1e8)
  }, [setAmountToWithdrawMax1e8, initialAmountToWithdrawMax1e8])

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
      intl.formatMessage({ id: 'common.tx.sendingAsset' }, { assetTicker: sourceAsset.ticker }),
      intl.formatMessage({ id: 'common.tx.checkResult' })
    ]
    const stepDescription = FP.pipe(
      withdrawState.withdraw,
      RD.fold(
        () => '',
        () =>
          `${intl.formatMessage(
            { id: 'common.step' },
            { current: withdrawState.step, total: withdrawState.stepsTotal }
          )}: ${stepDescriptions[withdrawState.step - 1]}`,
        () => '',
        () => `${intl.formatMessage({ id: 'common.done' })}!`
      )
    )

    return (
      <DepositAsset
        source={O.some({ asset: sourceAsset, amount: amountToWithdrawMax1e8 })}
        stepDescription={stepDescription}
        network={network}
      />
    )
  }, [intl, sourceAsset, withdrawState, amountToWithdrawMax1e8, network])

  const onCloseTxModal = useCallback(() => {
    resetWithdrawState()
    reloadBalances()
    reloadSelectedPoolDetail(5000)
  }, [resetWithdrawState, reloadBalances, reloadSelectedPoolDetail])

  const onFinishTxModal = useCallback(() => {
    onCloseTxModal()
    reloadBalances()
    reloadSelectedPoolDetail(5000)
  }, [onCloseTxModal, reloadBalances, reloadSelectedPoolDetail])

  const renderTxModal = useMemo(() => {
    const { withdraw: withdrawRD, withdrawTx } = withdrawState

    // don't render TxModal in initial state
    if (RD.isInitial(withdrawRD)) return <></>

    // Get timer value
    const timerValue = FP.pipe(
      withdrawRD,
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
      withdrawRD,
      RD.fold(
        () => 'savers.withdraw.state.sending',
        () => 'savers.withdraw.state.pending',
        () => 'savers.withdraw.state.error',
        () => 'savers.withdraw.state.success'
      ),
      (id) => intl.formatMessage({ id })
    )

    const oTxHash = FP.pipe(
      RD.toOption(withdrawTx),
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
        startTime={withdrawStartTime}
        txRD={withdrawRD}
        timerValue={timerValue}
        extraResult={
          <ViewTxButton
            txHash={oTxHash}
            onClick={goToTransaction}
            txUrl={FP.pipe(oTxHash, O.chain(getExplorerTxUrl))}
            label={intl.formatMessage({ id: 'common.tx.view' }, { assetTicker: sourceAsset.ticker })}
          />
        }
        extra={txModalExtraContent}
      />
    )
  }, [
    withdrawState,
    onCloseTxModal,
    onFinishTxModal,
    withdrawStartTime,
    goToTransaction,
    getExplorerTxUrl,
    intl,
    sourceAsset.ticker,
    txModalExtraContent,
    sourceChain
  ])
  // sumbit to withdraw state submit tx
  const submitWithdrawTx = useCallback(() => {
    FP.pipe(
      oWithdrawSaverParams,
      O.map((withdrawParams) => {
        // set start time
        setWithdrawStartTime(Date.now())
        // subscribe to saverWithdraw$
        subscribeWithdrawState(saverWithdraw$(withdrawParams))

        return true
      })
    )
  }, [oWithdrawSaverParams, saverWithdraw$, subscribeWithdrawState])

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
            walletAccount,
            fromAddress,
            walletIndex,
            hdMode,
            walletType
          })
        )
      )
    )
  }, [approveERC20Token$, network, oApproveParams, subscribeApproveState])

  const renderPasswordConfirmationModal = useMemo(() => {
    if (showPasswordModal === 'none') return <></>

    const onSuccess = () => {
      if (showPasswordModal === 'withdraw') submitWithdrawTx()
      if (showPasswordModal === 'approve') submitWithdrawTx()
      setShowPasswordModal('none')
    }
    const onClose = () => {
      setShowPasswordModal('none')
    }

    return (
      <WalletPasswordConfirmationModal onSuccess={onSuccess} onClose={onClose} validatePassword$={validatePassword$} />
    )
  }, [showPasswordModal, submitWithdrawTx, validatePassword$])

  const renderLedgerConfirmationModal = useMemo(() => {
    const visible = showLedgerModal === 'withdraw' || showLedgerModal === 'approve'

    const onClose = () => {
      setShowLedgerModal('none')
    }

    const onSucceess = () => {
      if (showLedgerModal === 'withdraw') submitWithdrawTx()
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
      isEvmChain(sourceChain) && isEvmToken(sourceAsset)
        ? `${txtNeedsConnected} ${intl.formatMessage(
            {
              id: 'ledger.blindsign'
            },
            { chain: chainAsString }
          )}`
        : txtNeedsConnected

    const description2 = intl.formatMessage({ id: 'ledger.sign' })

    const oIsDeposit = O.fromPredicate<ModalState>((v) => v === 'withdraw')(showLedgerModal)

    const addresses = FP.pipe(
      sequenceTOption(oIsDeposit, oWithdrawSaverParams),
      O.chain(([_, { poolAddress, sender }]) => {
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
    sourceAsset,
    oWithdrawSaverParams,
    network,
    submitWithdrawTx,
    submitApproveTx,
    useLedger
  ])

  // Price of asset IN fee
  const oPriceAssetInFee: O.Option<CryptoAmount> = useMemo(() => {
    const asset = saverFees.asset
    const amount = saverFees.inFee

    return FP.pipe(
      PoolHelpers.getPoolPriceValue({
        balance: { asset, amount },
        poolDetails,
        pricePool
      }),
      O.map((amount) => {
        return new CryptoAmount(amount, pricePool.asset)
      })
    )
  }, [poolDetails, pricePool, saverFees.asset, saverFees.inFee])

  const oPriceAssetOutFee: O.Option<CryptoAmount> = useMemo(() => {
    const fee = outboundFee.plus(liquidityFee)

    return FP.pipe(
      PoolHelpers.getPoolPriceValue({
        balance: { asset: fee.asset, amount: fee.baseAmount },
        poolDetails,
        pricePool
      }),
      O.map((amount) => {
        return new CryptoAmount(amount, pricePool.asset)
      })
    )
  }, [liquidityFee, poolDetails, pricePool, outboundFee])

  const oPriceAssetFeeTotal: O.Option<CryptoAmount> = useMemo(() => {
    return FP.pipe(
      sequenceTOptionFromArray([oPriceAssetInFee, oPriceAssetOutFee]),
      O.map(([inFee, outFee]) => {
        const totalAmount = inFee.baseAmount.plus(outFee.baseAmount)
        return new CryptoAmount(totalAmount, pricePool.asset)
      })
    )
  }, [oPriceAssetInFee, oPriceAssetOutFee, pricePool.asset])

  // Price fee label
  const priceFeesLabel = useMemo(
    () =>
      FP.pipe(
        saverFeesRD,
        RD.fold(
          () => loadingString,
          () => loadingString,
          () => noDataString,
          ({ asset: feeAsset, inFee }) => {
            const inbound = liquidityFee.baseAmount
            const outbound = outboundFee.baseAmount
            const fees = inFee.plus(inbound).plus(outbound)
            const fee = formatAssetAmountCurrency({
              amount: baseToAsset(fees),
              asset: feeAsset,
              decimal: isUSDAsset(feeAsset) ? 2 : 6,
              trimZeros: !isUSDAsset(feeAsset)
            })
            const price = FP.pipe(
              oPriceAssetFeeTotal,
              O.map(({ assetAmount, asset: priceAsset }) =>
                eqAsset(feeAsset, priceAsset)
                  ? emptyString
                  : formatAssetAmountCurrency({
                      amount: assetAmount,
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

    [saverFeesRD, liquidityFee.baseAmount, outboundFee.baseAmount, oPriceAssetFeeTotal]
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
          ({ asset: feeAsset, inFee }) => {
            const fee = formatAssetAmountCurrency({
              amount: baseToAsset(inFee),
              asset: feeAsset,
              decimal: isUSDAsset(feeAsset) ? 2 : 6,
              trimZeros: !isUSDAsset(feeAsset)
            })
            const price = FP.pipe(
              oPriceAssetInFee,
              O.map(({ assetAmount, asset: priceAsset }) =>
                eqAsset(feeAsset, priceAsset)
                  ? emptyString
                  : formatAssetAmountCurrency({
                      amount: assetAmount,
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
  const transactionTime: Time = useMemo(
    () =>
      FP.pipe(
        sequenceTOption(oSaverWithdrawQuote),
        O.fold(
          () => ({}),
          ([txDetails]) =>
            calculateTransactionTime(
              sourceAsset.chain,
              {
                outboundDelaySeconds: txDetails.outBoundDelaySeconds
              },
              sourceAsset // as target asset
            )
        )
      ),
    [oSaverWithdrawQuote, sourceAsset]
  )

  const renderSlider = useMemo(() => {
    const percentage = amountToWithdrawMax1e8
      .amount()
      .dividedBy(saverAssetAmount.baseAmount.amount())
      .multipliedBy(100)
      // Remove decimal of `BigNumber`s used within `BaseAmount` and always round down for currencies
      .decimalPlaces(0, BigNumber.ROUND_DOWN)
      .toNumber()

    const setAmountToWithdrawFromPercentValue = (percents: number) => {
      const amountFromPercentage = saverAssetAmount.baseAmount.amount().multipliedBy(percents / 100)
      setAmountToWithdrawMax1e8(baseAmount(amountFromPercentage, saverAssetAmount.baseAmount.decimal))
    }
    // Update withdrawBps based on the selected percentage
    const newWithdrawBps = Math.floor(percentage * 100)
    setWithdrawBps(O.some(newWithdrawBps > 0 ? newWithdrawBps : 0))

    return (
      <Slider
        key={'swap percentage slider'}
        value={percentage}
        onChange={setAmountToWithdrawFromPercentValue}
        onAfterChange={reloadFeesHandler}
        tooltipVisible
        tipFormatter={(value) => `${value}%`}
        withLabel
        tooltipPlacement={'top'}
        disabled={disableSaverAction}
      />
    )
  }, [amountToWithdrawMax1e8, disableSaverAction, reloadFeesHandler, saverAssetAmount, setAmountToWithdrawMax1e8])

  const oWalletAddress: O.Option<Address> = useMemo(() => {
    return FP.pipe(
      sequenceTOption(oSourceAssetWB),
      O.map(([{ walletAddress }]) => {
        return walletAddress
      })
    )
  }, [oSourceAssetWB])
  const [showDetails, setShowDetails] = useState<boolean>(true)

  return (
    <div className="flex w-full max-w-[500px] flex-col justify-between py-[60px]">
      <div>
        <div className="flex flex-col">
          <AssetInput
            className="w-full"
            amount={{ amount: amountToWithdrawMax1e8, asset: sourceAsset }}
            priceAmount={{ amount: priceAmountToWithdrawMax1e8.baseAmount, asset: priceAmountToWithdrawMax1e8.asset }}
            assets={selectableAssets}
            network={network}
            onChangeAsset={setAsset}
            onChange={setAmountToWithdrawMax1e8}
            onBlur={reloadFeesHandler}
            hasLedger={hasLedger}
            useLedger={useLedger}
            useLedgerHandler={onClickUseLedger}
            extraContent={
              <div className="flex flex-col">
                <MaxBalanceButton
                  className="ml-10px mt-5px"
                  classNameButton="!text-gray2 dark:!text-gray2d"
                  classNameIcon={
                    // show warn icon if maxAmountToSwapMax <= 0
                    maxAmountToWithdrawMax1e8.gt(zeroBaseAmountMax1e8)
                      ? `text-gray2 dark:text-gray2d`
                      : 'text-warning0 dark:text-warning0d'
                  }
                  size="medium"
                  balance={{ amount: maxAmountToWithdrawMax1e8, asset: sourceAsset }}
                  maxDollarValue={maxAmountPriceValue}
                  onClick={() => setAmountToWithdrawMax1e8(maxAmountToWithdrawMax1e8)}
                  maxInfoText={maxBalanceInfoTxt}
                />
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
                    ? intl.formatMessage({ id: 'common.approve.checking' }, { asset: sourceAsset.ticker })
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
                    {intl.formatMessage({ id: 'common.withdraw' })}
                  </FlatButton>
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
                  // disabled={RD.isPending(feesRD) || RD.isInitial(feesRD)}
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
                        amount: assetAmount(0), // affiliate is set to zero
                        asset: pricePool.asset,
                        decimal: 0
                      })}
                    </div>
                  </div>
                  <div className="flex w-full justify-between pl-10px text-[12px]">
                    <div>{intl.formatMessage({ id: 'common.liquidity' })}</div>
                    <div>{liquidityFee.formatedAssetString()}</div>
                  </div>
                  <div className="flex w-full justify-between pl-10px text-[12px]">
                    <div>{intl.formatMessage({ id: 'common.fee.outbound' })}</div>
                    <div>{outboundFee.formatedAssetString()}</div>
                  </div>
                </>
              )}
              {/* Withdraw saver transaction time, inbound / outbound / confirmations */}
              <>
                <div
                  className={`flex w-full justify-between ${showDetails ? 'pt-10px' : ''} font-mainBold text-[14px]`}>
                  <div>{intl.formatMessage({ id: 'common.time.title' })}</div>
                  <div>
                    {formatSwapTime(
                      Number(transactionTime.inbound) +
                        Number(transactionTime.outbound) +
                        Number(transactionTime.confirmation)
                    )}
                  </div>
                </div>
                {showDetails && (
                  <>
                    <div className="flex w-full justify-between pl-10px text-[12px]">
                      <div className={`flex items-center`}>{intl.formatMessage({ id: 'common.inbound.time' })}</div>
                      <div>{formatSwapTime(Number(transactionTime.inbound))}</div>
                    </div>
                    <div className="flex w-full justify-between pl-10px text-[12px]">
                      <div className={`flex items-center`}>{intl.formatMessage({ id: 'common.outbound.time' })}</div>
                      <div>{formatSwapTime(Number(transactionTime.outbound))}</div>
                    </div>
                    <div className="flex w-full justify-between pl-10px text-[12px]">
                      <div className={`flex items-center`}>
                        {intl.formatMessage({ id: 'common.confirmation.time' }, { chain: sourceAsset.chain })}
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
                    oWithdrawSaverParams,
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
                            amount: baseToAsset(sourceAssetAmount),
                            asset: sourceChainAsset,
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
                      oWithdrawSaverParams,
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
