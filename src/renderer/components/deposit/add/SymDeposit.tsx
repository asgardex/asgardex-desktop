import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowPathIcon } from '@heroicons/react/20/solid'
import { MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline'
import { ARBChain } from '@xchainjs/xchain-arbitrum'
import { AVAXChain } from '@xchainjs/xchain-avax'
import { BSCChain } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { ETHChain } from '@xchainjs/xchain-ethereum'
import { THORChain } from '@xchainjs/xchain-thorchain'
import {
  Address,
  AnyAsset,
  baseAmount,
  BaseAmount,
  baseToAsset,
  CryptoAmount,
  formatAssetAmountCurrency,
  TokenAsset
} from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as RxOp from 'rxjs/operators'

import { Dex } from '../../../../shared/api/types'
import { ASGARDEX_THORNAME } from '../../../../shared/const'
import { AssetCacao, AssetRuneNative } from '../../../../shared/utils/asset'
import { chainToString } from '../../../../shared/utils/chain'
import { isLedgerWallet } from '../../../../shared/utils/guard'
import { WalletType } from '../../../../shared/wallet/types'
import { ZERO_ASSET_AMOUNT, ZERO_BASE_AMOUNT } from '../../../const'
import {
  convertBaseAmountDecimal,
  getArbTokenAddress,
  getAvaxTokenAddress,
  getBscTokenAddress,
  getEthTokenAddress,
  isAethAsset,
  isArbTokenAsset,
  isAvaxAsset,
  isAvaxTokenAsset,
  isBscAsset,
  isBscTokenAsset,
  isChainAsset,
  isEthAsset,
  isEthTokenAsset,
  isUSDAsset,
  max1e8BaseAmount,
  to1e8BaseAmount
} from '../../../helpers/assetHelper'
import { getChainAsset, isAvaxChain, isBscChain, isEthChain } from '../../../helpers/chainHelper'
import { isEvmChain, isEvmToken } from '../../../helpers/evmHelper'
import { unionAssets } from '../../../helpers/fp/array'
import { eqBaseAmount, eqOAsset, eqOApproveParams, eqAsset } from '../../../helpers/fp/eq'
import { sequenceSOption, sequenceTOption } from '../../../helpers/fpHelpers'
import { getDepositMemo } from '../../../helpers/memoHelper'
import * as PoolHelpers from '../../../helpers/poolHelper'
import { getPoolPriceValue as getPoolPriceValueM } from '../../../helpers/poolHelperMaya'
import { liveData, LiveData } from '../../../helpers/rx/liveData'
import { emptyString, hiddenString, loadingString, noDataString } from '../../../helpers/stringHelper'
import * as WalletHelper from '../../../helpers/walletHelper'
import { useSubscriptionState } from '../../../hooks/useSubscriptionState'
import { INITIAL_SAVER_DEPOSIT_STATE, INITIAL_SYM_DEPOSIT_STATE } from '../../../services/chain/const'
import {
  SymDepositState,
  SymDepositParams,
  SymDepositStateHandler,
  SymDepositFees,
  FeeRD,
  ReloadSymDepositFeesHandler,
  SymDepositFeesHandler,
  SymDepositFeesRD,
  SaverDepositStateHandler,
  SaverDepositState,
  SaverDepositParams
} from '../../../services/chain/types'
import { GetExplorerTxUrl, OpenExplorerTxUrl } from '../../../services/clients'
import {
  ApproveFeeHandler,
  ApproveParams,
  IsApprovedRD,
  IsApproveParams,
  LoadApproveFeeHandler
} from '../../../services/evm/types'
import { PoolDetails as PoolDetailsMaya } from '../../../services/mayaMigard/types'
import { PoolAddress, PoolDetails, PoolsDataMap } from '../../../services/midgard/types'
import {
  FailedAssets,
  LiquidityProviderAssetMismatch,
  LiquidityProviderAssetMismatchRD,
  LiquidityProviderHasAsymAssets,
  LiquidityProviderHasAsymAssetsRD,
  PendingAssets,
  PendingAssetsRD
} from '../../../services/thorchain/types'
import {
  ApiError,
  BalancesState,
  TxHashLD,
  TxHashRD,
  ValidatePasswordHandler,
  WalletBalance,
  WalletBalances
} from '../../../services/wallet/types'
import { AssetWithAmount, AssetsWithAmount1e8, AssetWithDecimal, AssetWithAmount1e8 } from '../../../types/asgardex'
import { PoolData, PricePool } from '../../../views/pools/Pools.types'
import { ConfirmationModal, LedgerConfirmationModal } from '../../modal/confirmation'
import { WalletPasswordConfirmationModal } from '../../modal/confirmation'
import { TxModal } from '../../modal/tx'
import { DepositAssets } from '../../modal/tx/extra'
import { DepositAsset } from '../../modal/tx/extra/DepositAsset'
import { LoadingView, Spin } from '../../shared/loading'
import { Alert } from '../../uielements/alert'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { AssetInput } from '../../uielements/assets/assetInput'
import { AssetLabel } from '../../uielements/assets/assetLabel'
import { BaseButton, FlatButton, ViewTxButton } from '../../uielements/button'
import { MaxBalanceButton } from '../../uielements/button/MaxBalanceButton'
import { Tooltip, TooltipAddress } from '../../uielements/common/Common.styles'
import { Fees, UIFeesRD } from '../../uielements/fees'
import { InfoIcon } from '../../uielements/info/InfoIcon'
import { CopyLabel, Label } from '../../uielements/label'
import { Slider } from '../../uielements/slider'
import { AssetMissmatchWarning } from './AssetMissmatchWarning'
import { AsymAssetsWarning } from './AsymAssetsWarning'
import * as Helper from './Deposit.helper'
import { PendingAssetsWarning } from './PendingAssetsWarning'

export type Props = {
  asset: AssetWithDecimal
  availableAssets: AnyAsset[]
  walletBalances: Pick<BalancesState, 'balances' | 'loading'>
  poolAddress: O.Option<PoolAddress>
  pricePool: PricePool
  poolDetails: PoolDetailsMaya | PoolDetails
  reloadFees: ReloadSymDepositFeesHandler
  fees$: SymDepositFeesHandler
  reloadApproveFee: LoadApproveFeeHandler
  approveFee$: ApproveFeeHandler
  reloadBalances: FP.Lazy<void>
  reloadShares: (delay?: number) => void
  reloadSelectedPoolDetail: (delay?: number) => void
  openAssetExplorerTxUrl: OpenExplorerTxUrl
  openRuneExplorerTxUrl: OpenExplorerTxUrl
  getRuneExplorerTxUrl: GetExplorerTxUrl
  getAssetExplorerTxUrl: GetExplorerTxUrl
  validatePassword$: ValidatePasswordHandler
  assetWalletType: WalletType
  runeWalletType: WalletType
  onChangeAsset: ({
    asset,
    assetWalletType,
    runeWalletType
  }: {
    asset: AnyAsset
    assetWalletType: WalletType
    runeWalletType: WalletType
  }) => void
  disabled?: boolean
  poolData: PoolData
  deposit$: SymDepositStateHandler
  asymDeposit$: SaverDepositStateHandler
  network: Network
  approveERC20Token$: (params: ApproveParams) => TxHashLD
  isApprovedERC20Token$: (params: IsApproveParams) => LiveData<ApiError, boolean>
  protocolLimitReached: boolean
  poolsData: PoolsDataMap
  disableDepositAction: boolean
  symPendingAssets: PendingAssetsRD
  hasAsymAssets: LiquidityProviderHasAsymAssetsRD
  symAssetMismatch: LiquidityProviderAssetMismatchRD
  openAsymDepositTool: FP.Lazy<void>
  hidePrivateData: boolean
  dex: Dex
}

type SelectedInput = 'asset' | 'rune' | 'none'

export const SymDeposit: React.FC<Props> = (props) => {
  const {
    asset: { asset, decimal: assetDecimal },
    availableAssets,
    walletBalances,
    poolAddress: oPoolAddress,
    openAssetExplorerTxUrl,
    openRuneExplorerTxUrl,
    getRuneExplorerTxUrl,
    getAssetExplorerTxUrl,
    validatePassword$,
    pricePool,
    poolDetails,
    reloadFees,
    reloadBalances,
    reloadShares,
    reloadSelectedPoolDetail,
    fees$,
    assetWalletType,
    runeWalletType,
    onChangeAsset,
    disabled = false,
    poolData,
    deposit$,
    asymDeposit$,
    network,
    isApprovedERC20Token$,
    approveERC20Token$,
    reloadApproveFee,
    approveFee$,
    protocolLimitReached,
    poolsData,
    disableDepositAction,
    symPendingAssets: symPendingAssetsRD,
    hasAsymAssets: hasAsymAssetsRD,
    symAssetMismatch: symAssetMismatchRD,
    openAsymDepositTool,
    hidePrivateData,
    dex
  } = props

  const intl = useIntl()

  const { chain } = asset

  const dexAsset = dex.asset
  const dexAssetDecimal = dex.decimals

  const prevAsset = useRef<O.Option<AnyAsset>>(O.none)

  const isRuneLedger = isLedgerWallet(runeWalletType)

  const isAssetLedger = isLedgerWallet(assetWalletType)

  const [oFailedAssetAmount, setFailedAssetAmount] = useState<O.Option<AssetWithAmount1e8>>(O.none)
  const [failedAssetWalletType, setFailedWalletType] = useState<string>()

  const { balances: oWalletBalances, loading: walletBalancesLoading } = walletBalances

  const poolBasedBalances: WalletBalances = useMemo(
    () =>
      FP.pipe(
        oWalletBalances,
        O.map((balances) => WalletHelper.filterWalletBalancesByAssets(balances, availableAssets)),
        O.getOrElse<WalletBalances>(() => [])
      ),
    [oWalletBalances, availableAssets]
  )

  const poolBasedBalancesAssets = FP.pipe(
    poolBasedBalances,
    A.map(({ asset }) => asset),
    // Merge duplications
    (assets) => unionAssets(assets)(assets),
    // Filter out assets that are not dexAsset
    A.filter((currentAsset) => currentAsset !== dexAsset)
  )

  // can be Rune or cacao depending on dex selected
  const oDexAssetWB: O.Option<WalletBalance> = useMemo(() => {
    const oWalletBalances = NEA.fromArray(poolBasedBalances)
    return WalletHelper.getWalletBalanceByAssetAndWalletType({
      oWalletBalances,
      asset: dexAsset,
      walletType: runeWalletType
    })
  }, [poolBasedBalances, dexAsset, runeWalletType])

  const dexAssetBalanceLabel = useMemo(
    () =>
      walletBalancesLoading
        ? loadingString
        : FP.pipe(
            oDexAssetWB,
            O.map(({ amount, asset }) =>
              hidePrivateData
                ? hiddenString
                : formatAssetAmountCurrency({
                    amount: baseToAsset(amount),
                    asset,
                    decimal: 8,
                    trimZeros: true
                  })
            ),
            O.getOrElse(() => noDataString)
          ),
    [hidePrivateData, oDexAssetWB, walletBalancesLoading]
  )

  const oAssetWB: O.Option<WalletBalance> = useMemo(() => {
    const oWalletBalances = NEA.fromArray(poolBasedBalances)
    return WalletHelper.getWalletBalanceByAssetAndWalletType({
      oWalletBalances,
      asset,
      walletType: assetWalletType
    })
  }, [asset, assetWalletType, poolBasedBalances])

  const assetBalanceLabel = useMemo(
    () =>
      walletBalancesLoading
        ? loadingString
        : FP.pipe(
            oAssetWB,
            O.map(({ amount, asset }) =>
              hidePrivateData
                ? hiddenString
                : formatAssetAmountCurrency({
                    amount: baseToAsset(amount),
                    asset,
                    decimal: 8,
                    trimZeros: true
                  })
            ),
            O.getOrElse(() => noDataString)
          ),
    [hidePrivateData, oAssetWB, walletBalancesLoading]
  )

  const hasAssetLedger = useMemo(
    () => WalletHelper.hasLedgerInBalancesByAsset(asset, poolBasedBalances),
    [asset, poolBasedBalances]
  )

  const hasRuneLedger = useMemo(
    () => WalletHelper.hasLedgerInBalancesByAsset(dexAsset, poolBasedBalances),
    [dexAsset, poolBasedBalances]
  )

  /** Asset balance based on original decimal */
  const assetBalance: BaseAmount = useMemo(
    () =>
      FP.pipe(
        oAssetWB,
        O.map(({ amount }) => amount),
        O.getOrElse(() => baseAmount(0, assetDecimal))
      ),
    [assetDecimal, oAssetWB]
  )

  const assetBalanceMax1e8: BaseAmount = useMemo(() => max1e8BaseAmount(assetBalance), [assetBalance])
  // can be rune or cacao
  const [runeAmountToDeposit, setRuneAmountToDeposit] = useState<BaseAmount>(baseAmount(0, dexAssetDecimal))

  const initialAssetAmountToDepositMax1e8 = useMemo(
    () => baseAmount(0, assetBalanceMax1e8.decimal),
    [assetBalanceMax1e8.decimal]
  )
  const isPoolDetails = (poolDetails: PoolDetails | PoolDetailsMaya): poolDetails is PoolDetails => {
    return (poolDetails as PoolDetails) !== undefined
  }

  const priceRuneAmountToDepositMax1e8: AssetWithAmount = useMemo(() => {
    const result =
      dex.chain === THORChain
        ? FP.pipe(
            isPoolDetails(poolDetails)
              ? PoolHelpers.getPoolPriceValue({
                  balance: { asset: AssetRuneNative, amount: runeAmountToDeposit },
                  poolDetails,
                  pricePool
                })
              : O.none,
            O.getOrElse(() => ZERO_BASE_AMOUNT),
            (amount) => ({ asset: pricePool.asset, amount })
          )
        : FP.pipe(
            getPoolPriceValueM({
              balance: { asset: AssetCacao, amount: runeAmountToDeposit },
              poolDetails,
              pricePool
            }),
            O.getOrElse(() => ZERO_BASE_AMOUNT),
            (amount) => ({ asset: pricePool.asset, amount })
          )
    return result
  }, [dex, poolDetails, pricePool, runeAmountToDeposit])
  const [
    /* max. 1e8 decimal */
    assetAmountToDepositMax1e8,
    _setAssetAmountToDepositMax1e8 /* private, never set it directly, use `setAssetAmountToDeposit` instead */
  ] = useState<BaseAmount>(initialAssetAmountToDepositMax1e8)

  const isZeroAmountToDeposit = useMemo(
    () => assetAmountToDepositMax1e8.amount().isZero() || runeAmountToDeposit.amount().isZero(),
    [assetAmountToDepositMax1e8, runeAmountToDeposit]
  )

  const [percentValueToDeposit, setPercentValueToDeposit] = useState(0)

  const [selectedInput, setSelectedInput] = useState<SelectedInput>('none')

  const {
    state: depositState,
    reset: resetDepositState,
    subscribe: subscribeDepositState
  } = useSubscriptionState<SymDepositState>(INITIAL_SYM_DEPOSIT_STATE)

  const {
    state: asymDepositState,
    reset: resetAsymDepositState,
    subscribe: subscribeAsymDepositState
  } = useSubscriptionState<SaverDepositState>(INITIAL_SAVER_DEPOSIT_STATE)

  // Deposit start time
  const [depositStartTime, setDepositStartTime] = useState<number>(0)

  const dexAssetBalance: BaseAmount = useMemo(
    () =>
      FP.pipe(
        oDexAssetWB,
        O.map(({ amount }) => amount),
        O.getOrElse(() => ZERO_BASE_AMOUNT)
      ),
    [oDexAssetWB]
  )

  const oChainAssetBalance: O.Option<BaseAmount> = useMemo(() => {
    const chainAsset = getChainAsset(chain)
    return FP.pipe(
      WalletHelper.getWalletBalanceByAssetAndWalletType({
        oWalletBalances,
        asset: chainAsset,
        walletType: assetWalletType
      }),
      O.map(({ amount }) => amount)
    )
  }, [chain, oWalletBalances, assetWalletType])

  const chainAssetBalance: BaseAmount = useMemo(
    () =>
      FP.pipe(
        oChainAssetBalance,
        O.getOrElse(() => ZERO_BASE_AMOUNT)
      ),
    [oChainAssetBalance]
  )

  const needApprovement = useMemo(() => {
    // not needed for users with locked or not imported wallets

    // ERC20 token does need approval only
    switch (chain) {
      case ETHChain:
        return isEthAsset(asset) ? O.some(false) : O.some(isEthTokenAsset(asset as TokenAsset))
      case AVAXChain:
        return isAvaxAsset(asset) ? O.some(false) : O.some(isAvaxTokenAsset(asset as TokenAsset))
      case BSCChain:
        return isBscAsset(asset) ? O.some(false) : O.some(isBscTokenAsset(asset as TokenAsset))
      case ARBChain:
        return isAethAsset(asset) ? O.some(false) : O.some(isArbTokenAsset(asset as TokenAsset))
      default:
        return O.none
    }
  }, [asset, chain])

  const oApproveParams: O.Option<ApproveParams> = useMemo(() => {
    const oRouterAddress: O.Option<Address> = FP.pipe(
      oPoolAddress,
      O.chain(({ router }) => router)
    )

    const oTokenAddress: O.Option<string> = (() => {
      switch (chain) {
        case ETHChain:
          return getEthTokenAddress(asset as TokenAsset)
        case AVAXChain:
          return getAvaxTokenAddress(asset as TokenAsset)
        case BSCChain:
          return getBscTokenAddress(asset as TokenAsset)
        case ARBChain:
          return getArbTokenAddress(asset as TokenAsset)
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
      sequenceTOption(oNeedApprovement, oTokenAddress, oRouterAddress, oAssetWB),
      O.map(([_, tokenAddress, routerAddress, { walletAddress, walletAccount, walletIndex, walletType, hdMode }]) => ({
        network,
        spenderAddress: routerAddress,
        contractAddress: tokenAddress,
        fromAddress: walletAddress,
        walletAccount,
        walletIndex,
        walletType,
        hdMode
      }))
    )
  }, [oPoolAddress, needApprovement, oAssetWB, chain, asset, network])

  const zeroDepositFees: SymDepositFees = useMemo(() => Helper.getZeroSymDepositFees(asset), [asset])

  const prevDepositFees = useRef<O.Option<SymDepositFees>>(O.none)
  const [depositFeesRD, setDepositFeesRD] = useState<SymDepositFeesRD>(RD.success(zeroDepositFees))

  const feesObservable = useMemo(
    () =>
      FP.pipe(
        fees$(asset, dex),
        liveData.map((fees) => {
          // store every successfully loaded fees
          prevDepositFees.current = O.some(fees)
          return fees
        })
      ),
    [asset, dex, fees$] // Dependencies
  )
  const depositFees: SymDepositFees = useMemo(
    () =>
      FP.pipe(
        depositFeesRD,
        RD.toOption,
        O.alt(() => prevDepositFees.current),
        O.getOrElse(() => zeroDepositFees)
      ),
    [depositFeesRD, zeroDepositFees]
  )

  useEffect(() => {
    const subscription = feesObservable.subscribe({
      next: setDepositFeesRD,
      error: (error) => setDepositFeesRD(RD.failure(error))
    })

    return () => subscription.unsubscribe()
  }, [feesObservable]) // Depend on the memoized observable

  const runeFeeLabel: string = useMemo(
    () =>
      FP.pipe(
        depositFeesRD,
        RD.fold(
          () => loadingString,
          () => loadingString,
          () => noDataString,
          ({ rune: { inFee, outFee } }) =>
            formatAssetAmountCurrency({
              amount: baseToAsset(inFee.plus(outFee)),
              asset: dexAsset,
              decimal: 6,
              trimZeros: true
            })
        )
      ),
    [depositFeesRD, dexAsset]
  )

  const assetFeeLabel: string = useMemo(
    () =>
      FP.pipe(
        depositFeesRD,
        RD.fold(
          () => loadingString,
          () => loadingString,
          () => noDataString,
          ({ asset: { inFee, outFee, asset: feeAsset } }) =>
            formatAssetAmountCurrency({
              amount: baseToAsset(inFee.plus(outFee)),
              asset: feeAsset,
              decimal: isUSDAsset(feeAsset) ? 2 : 6,
              trimZeros: !isUSDAsset(feeAsset)
            })
        )
      ),

    [depositFeesRD]
  )

  // Price of RUNE IN fee
  const oPriceRuneInFee: O.Option<AssetWithAmount> = useMemo(() => {
    const amount = depositFees.rune.inFee

    return dex.chain === THORChain
      ? FP.pipe(
          isPoolDetails(poolDetails)
            ? PoolHelpers.getPoolPriceValue({
                balance: { asset: AssetRuneNative, amount },
                poolDetails,
                pricePool
              })
            : O.none,
          O.map((amount) => ({ amount, asset: pricePool.asset }))
        )
      : FP.pipe(
          getPoolPriceValueM({
            balance: { asset: AssetCacao, amount },
            poolDetails,
            pricePool
          }),
          O.map((amount) => ({ amount, asset: pricePool.asset }))
        )
  }, [depositFees.rune.inFee, dex, poolDetails, pricePool])

  const priceRuneInFeeLabel = useMemo(
    () =>
      FP.pipe(
        depositFeesRD,
        RD.fold(
          () => loadingString,
          () => loadingString,
          () => noDataString,
          ({ rune: { inFee } }) => {
            const fee = formatAssetAmountCurrency({
              amount: baseToAsset(inFee),
              asset: dexAsset,
              decimal: 6,
              trimZeros: true
            })
            const price = FP.pipe(
              oPriceRuneInFee,
              O.map(({ amount, asset: priceAsset }) =>
                dexAsset === priceAsset
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

    [depositFeesRD, dexAsset, oPriceRuneInFee]
  )

  // Price of RUNE OUT fee
  const oPriceRuneOutFee: O.Option<AssetWithAmount> = useMemo(() => {
    const amount = depositFees.rune.outFee

    return dex.chain === THORChain
      ? FP.pipe(
          isPoolDetails(poolDetails)
            ? PoolHelpers.getPoolPriceValue({
                balance: { asset: AssetRuneNative, amount },
                poolDetails,
                pricePool
              })
            : O.none,
          O.map((amount) => ({ asset: pricePool.asset, amount }))
        )
      : FP.pipe(
          getPoolPriceValueM({
            balance: { asset: AssetCacao, amount },
            poolDetails,
            pricePool
          }),
          O.map((amount) => ({ asset: pricePool.asset, amount }))
        )
  }, [depositFees.rune.outFee, dex, poolDetails, pricePool])

  const priceRuneOutFeeLabel = useMemo(
    () =>
      FP.pipe(
        depositFeesRD,
        RD.fold(
          () => loadingString,
          () => loadingString,
          () => noDataString,
          ({ rune: { outFee } }) => {
            const fee = formatAssetAmountCurrency({
              amount: baseToAsset(outFee),
              asset: dexAsset,
              decimal: 6,
              trimZeros: true
            })
            const price = FP.pipe(
              oPriceRuneOutFee,
              O.map(({ amount, asset: priceAsset }) =>
                dexAsset === priceAsset
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

    [depositFeesRD, dexAsset, oPriceRuneOutFee]
  )

  // Price of asset IN fee
  const oPriceAssetInFee: O.Option<AssetWithAmount> = useMemo(() => {
    const asset = depositFees.asset.asset
    const amount = depositFees.asset.inFee

    return dex.chain === THORChain
      ? FP.pipe(
          isPoolDetails(poolDetails)
            ? PoolHelpers.getPoolPriceValue({
                balance: { asset, amount },
                poolDetails,
                pricePool
              })
            : O.none,
          O.map((amount) => ({ amount, asset: pricePool.asset }))
        )
      : FP.pipe(
          getPoolPriceValueM({
            balance: { asset, amount },
            poolDetails,
            pricePool
          }),
          O.map((amount) => ({ amount, asset: pricePool.asset }))
        )
  }, [depositFees.asset.asset, depositFees.asset.inFee, dex, poolDetails, pricePool])

  const priceAssetInFeeLabel = useMemo(
    () =>
      FP.pipe(
        depositFeesRD,
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
                eqAsset.equals(feeAsset, priceAsset)
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

    [depositFeesRD, oPriceAssetInFee]
  )

  // Price of asset OUT fee
  const oPriceAssetOutFee: O.Option<AssetWithAmount> = useMemo(() => {
    const asset = depositFees.asset.asset
    const amount = depositFees.asset.outFee

    return dex.chain === THORChain
      ? FP.pipe(
          isPoolDetails(poolDetails)
            ? PoolHelpers.getPoolPriceValue({
                balance: { asset, amount },
                poolDetails,
                pricePool
              })
            : O.none,
          O.map((amount) => ({ asset: pricePool.asset, amount }))
        )
      : FP.pipe(
          getPoolPriceValueM({
            balance: { asset, amount },
            poolDetails,
            pricePool
          }),
          O.map((amount) => ({ asset: pricePool.asset, amount }))
        )
  }, [depositFees.asset.asset, depositFees.asset.outFee, dex, poolDetails, pricePool])

  const priceAssetOutFeeLabel = useMemo(
    () =>
      FP.pipe(
        depositFeesRD,
        RD.fold(
          () => loadingString,
          () => loadingString,
          () => noDataString,
          ({ asset: { outFee, asset: feeAsset } }) => {
            const fee = formatAssetAmountCurrency({
              amount: baseToAsset(outFee),
              asset: feeAsset,
              decimal: isUSDAsset(feeAsset) ? 2 : 6,
              trimZeros: !isUSDAsset(feeAsset)
            })
            const price = FP.pipe(
              oPriceAssetOutFee,
              O.map(({ amount, asset: priceAsset }) =>
                eqAsset.equals(feeAsset, priceAsset)
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

    [depositFeesRD, oPriceAssetOutFee]
  )

  /**
   * Sum price of deposit fees (IN + OUT)
   */
  const oPriceDepositFees1e8: O.Option<AssetWithAmount> = useMemo(
    () =>
      FP.pipe(
        sequenceSOption({
          priceRuneInFee: oPriceRuneInFee,
          priceRuneOutFee: oPriceRuneOutFee,
          priceAssetInFee: oPriceAssetInFee,
          priceAssetOutFee: oPriceAssetOutFee
        }),
        O.map(({ priceRuneInFee, priceRuneOutFee, priceAssetInFee, priceAssetOutFee }) => {
          const sumRune = priceRuneInFee.amount.plus(priceRuneOutFee.amount)
          const assetIn1e8 = to1e8BaseAmount(priceAssetInFee.amount)
          const assetOut1e8 = to1e8BaseAmount(priceAssetOutFee.amount)
          const sumAsset1e8 = assetIn1e8.plus(assetOut1e8)
          return { asset: priceAssetInFee.asset, amount: sumRune.plus(sumAsset1e8) }
        })
      ),
    [oPriceAssetInFee, oPriceAssetOutFee, oPriceRuneInFee, oPriceRuneOutFee]
  )

  const priceDepositFeesLabel = useMemo(
    () =>
      FP.pipe(
        depositFeesRD,
        RD.fold(
          () => loadingString,
          () => loadingString,
          () => noDataString,
          (_) =>
            FP.pipe(
              oPriceDepositFees1e8,
              O.map(({ amount, asset }) =>
                formatAssetAmountCurrency({ amount: baseToAsset(amount), asset, decimal: isUSDAsset(asset) ? 2 : 6 })
              ),
              O.getOrElse(() => noDataString)
            )
        )
      ),
    [depositFeesRD, oPriceDepositFees1e8]
  )

  const oDepositParams: O.Option<SymDepositParams> = useMemo(
    () =>
      FP.pipe(
        sequenceSOption({ poolAddress: oPoolAddress, dexAssetWB: oDexAssetWB, assetWB: oAssetWB }),
        O.map(({ poolAddress, dexAssetWB, assetWB }) => {
          const assetAddress = assetWB.walletAddress
          const runeAddress = dexAssetWB.walletAddress
          return {
            asset,
            poolAddress,
            amounts: {
              rune: runeAmountToDeposit,
              // Decimal needs to be converted back for using orginal decimal of this asset (provided by `assetBalance`)
              asset: convertBaseAmountDecimal(assetAmountToDepositMax1e8, assetDecimal)
            },
            memos: {
              asset: getDepositMemo({ asset, address: runeAddress }).concat(`:${ASGARDEX_THORNAME}:0`),
              rune: getDepositMemo({ asset, address: assetAddress }).concat(`:${ASGARDEX_THORNAME}:0`)
            },
            runeWalletType: dexAssetWB.walletType,
            runeWalletAccount: dexAssetWB.walletAccount,
            runeWalletIndex: dexAssetWB.walletIndex,
            runeHDMode: dexAssetWB.hdMode,
            runeSender: runeAddress,
            assetWalletType: assetWB.walletType,
            assetWalletAccount: assetWB.walletAccount,
            assetWalletIndex: assetWB.walletIndex,
            assetHDMode: assetWB.hdMode,
            assetSender: assetAddress,
            dex: dex
          }
        })
      ),
    [oPoolAddress, oDexAssetWB, oAssetWB, asset, runeAmountToDeposit, assetAmountToDepositMax1e8, assetDecimal, dex]
  )
  const oAsymDepositParams: O.Option<SaverDepositParams> = useMemo(
    () =>
      FP.pipe(
        sequenceTOption(oDepositParams, oFailedAssetAmount),
        O.map(([params, { asset, amount1e8 }]) => {
          setFailedWalletType(dexAsset === asset ? params.runeWalletType : params.assetWalletType)
          const result = {
            poolAddress: params.poolAddress,
            asset: asset,
            amount: dexAsset === asset ? amount1e8 : convertBaseAmountDecimal(amount1e8, assetDecimal),
            memo: dexAsset === asset ? params.memos.rune : params.memos.asset,
            walletType: dexAsset === asset ? params.runeWalletType : params.assetWalletType,
            sender: dexAsset === asset ? params.runeSender : params.assetSender,
            walletAccount: dexAsset === asset ? params.runeWalletAccount : params.assetWalletAccount,
            walletIndex: dexAsset === asset ? params.runeWalletIndex : params.assetWalletIndex,
            hdMode: dexAsset === asset ? params.runeHDMode : params.assetHDMode,
            dex
          }
          return result
        })
      ),
    [oDepositParams, oFailedAssetAmount, dexAsset, assetDecimal, dex]
  )

  const reloadFeesHandler = useCallback(() => {
    reloadFees(asset, dex)
  }, [asset, dex, reloadFees])

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

  const minAssetAmountToDepositMax1e8: BaseAmount = useMemo(
    () => Helper.minAssetAmountToDepositMax1e8({ fees: depositFees.asset, asset, assetDecimal, poolsData }),
    [asset, assetDecimal, depositFees.asset, poolsData]
  )

  const minAssetAmountError = useMemo(() => {
    if (isZeroAmountToDeposit) return false

    return assetAmountToDepositMax1e8.lt(minAssetAmountToDepositMax1e8)
  }, [assetAmountToDepositMax1e8, isZeroAmountToDeposit, minAssetAmountToDepositMax1e8])

  const minRuneAmountToDeposit: BaseAmount = useMemo(
    () => Helper.minRuneAmountToDeposit(depositFees.rune),
    [depositFees.rune]
  )

  const minRuneAmountError = useMemo(() => {
    if (isZeroAmountToDeposit) return false

    return runeAmountToDeposit.lt(minRuneAmountToDeposit)
  }, [isZeroAmountToDeposit, minRuneAmountToDeposit, runeAmountToDeposit])

  const maxRuneAmountToDeposit = useMemo(
    (): BaseAmount =>
      Helper.maxRuneAmountToDeposit({
        poolData,
        dexBalance: dexAssetBalance,
        assetBalance: { asset, amount: assetBalance },
        fees: depositFees,
        dex
      }),

    [poolData, dexAssetBalance, asset, assetBalance, depositFees, dex]
  )

  // Update `runeAmountToDeposit` if `maxRuneAmountToDeposit` has been updated
  useEffect(() => {
    if (maxRuneAmountToDeposit.lt(runeAmountToDeposit)) {
      setRuneAmountToDeposit(maxRuneAmountToDeposit)
    }
  }, [maxRuneAmountToDeposit, runeAmountToDeposit])

  /**
   * Max asset amount to deposit
   * Note: It's max. 1e8 decimal based
   */
  const maxAssetAmountToDepositMax1e8 = useMemo((): BaseAmount => {
    const maxAmount = Helper.maxAssetAmountToDeposit({
      poolData,
      dexBalance: dexAssetBalance,
      assetBalance: { asset, amount: assetBalance },
      fees: depositFees
    })
    return max1e8BaseAmount(maxAmount)
  }, [asset, assetBalance, depositFees, poolData, dexAssetBalance])

  const priceAmountToSwapMax1e8: CryptoAmount = useMemo(() => {
    const result =
      dex.chain === THORChain
        ? FP.pipe(
            isPoolDetails(poolDetails)
              ? PoolHelpers.getPoolPriceValue({
                  balance: { asset: asset, amount: maxAssetAmountToDepositMax1e8 },
                  poolDetails,
                  pricePool
                })
              : O.none,
            O.getOrElse(() => baseAmount(0, maxAssetAmountToDepositMax1e8.decimal)),
            (amount) => ({ asset: pricePool.asset, amount })
          )
        : FP.pipe(
            getPoolPriceValueM({
              balance: { asset: asset, amount: maxAssetAmountToDepositMax1e8 },
              poolDetails,
              pricePool
            }),
            O.getOrElse(() => baseAmount(0, maxAssetAmountToDepositMax1e8.decimal)),
            (amount) => ({ asset: pricePool.asset, amount })
          )
    return new CryptoAmount(result.amount, result.asset)
  }, [dex, asset, maxAssetAmountToDepositMax1e8, poolDetails, pricePool])

  const priceRuneAmountToDepsoitMax1e8: CryptoAmount = useMemo(() => {
    const result =
      dex.chain === THORChain
        ? FP.pipe(
            isPoolDetails(poolDetails)
              ? PoolHelpers.getPoolPriceValue({
                  balance: { asset: AssetRuneNative, amount: maxRuneAmountToDeposit },
                  poolDetails,
                  pricePool
                })
              : O.none,
            O.getOrElse(() => baseAmount(0, maxRuneAmountToDeposit.decimal)),
            (amount) => ({ asset: pricePool.asset, amount })
          )
        : FP.pipe(
            getPoolPriceValueM({
              balance: { asset: AssetCacao, amount: maxRuneAmountToDeposit },
              poolDetails,
              pricePool
            }),
            O.getOrElse(() => baseAmount(0, maxRuneAmountToDeposit.decimal)),
            (amount) => ({ asset: pricePool.asset, amount })
          )
    return new CryptoAmount(result.amount, pricePool.asset)
  }, [dex, maxRuneAmountToDeposit, poolDetails, pricePool])

  const setAssetAmountToDepositMax1e8 = useCallback(
    (amountToDeposit: BaseAmount) => {
      const newAmount = baseAmount(amountToDeposit.amount(), assetBalanceMax1e8.decimal)

      // dirty check - do nothing if prev. and next amounts are equal
      if (eqBaseAmount.equals(newAmount, assetAmountToDepositMax1e8)) return {}

      const newAmountToDepositMax1e8 = newAmount.gt(maxAssetAmountToDepositMax1e8)
        ? maxAssetAmountToDepositMax1e8
        : newAmount

      _setAssetAmountToDepositMax1e8({ ...newAmountToDepositMax1e8 })
    },
    [assetAmountToDepositMax1e8, assetBalanceMax1e8.decimal, maxAssetAmountToDepositMax1e8]
  )

  // Update `assetAmountToDeposit` if `maxAssetAmountToDeposit` has been updated
  useEffect(() => {
    if (maxAssetAmountToDepositMax1e8.lt(assetAmountToDepositMax1e8)) {
      setAssetAmountToDepositMax1e8(maxAssetAmountToDepositMax1e8)
    }
  }, [assetAmountToDepositMax1e8, maxAssetAmountToDepositMax1e8, setAssetAmountToDepositMax1e8])

  const priceAssetAmountToDepositMax1e8: AssetWithAmount = useMemo(() => {
    const result =
      dex.chain === THORChain
        ? FP.pipe(
            isPoolDetails(poolDetails)
              ? PoolHelpers.getPoolPriceValue({
                  balance: { asset, amount: assetAmountToDepositMax1e8 },
                  poolDetails,
                  pricePool
                })
              : O.none,
            O.getOrElse(() => baseAmount(0, assetAmountToDepositMax1e8.decimal)),
            (amount) => ({ asset: pricePool.asset, amount })
          )
        : FP.pipe(
            getPoolPriceValueM({
              balance: { asset, amount: assetAmountToDepositMax1e8 },
              poolDetails,
              pricePool
            }),
            O.getOrElse(() => baseAmount(0, assetAmountToDepositMax1e8.decimal)),
            (amount) => ({ asset: pricePool.asset, amount })
          )
    return result
  }, [asset, assetAmountToDepositMax1e8, dex, poolDetails, pricePool])

  const hasAssetBalance = useMemo(() => assetBalance.gt(baseAmount(0, assetBalance.decimal)), [assetBalance])
  const hasDexAssetBalance = useMemo(() => dexAssetBalance.gt(ZERO_BASE_AMOUNT), [dexAssetBalance])

  const isBalanceError = useMemo(() => !hasAssetBalance && !hasDexAssetBalance, [hasAssetBalance, hasDexAssetBalance])

  const showBalanceError = useMemo(
    () =>
      // Note:
      // To avoid flickering of balance error for a short time at the beginning
      // We never show error if balances are not available
      O.isSome(oAssetWB) && isBalanceError,
    [isBalanceError, oAssetWB]
  )

  const renderBalanceError = useMemo(() => {
    const noAssetBalancesMsg = intl.formatMessage(
      { id: 'deposit.add.error.nobalance1' },
      {
        asset: asset.ticker
      }
    )

    const noRuneBalancesMsg = intl.formatMessage(
      { id: 'deposit.add.error.nobalance1' },
      {
        asset: dexAsset.ticker
      }
    )

    const noRuneAndAssetBalancesMsg = intl.formatMessage(
      { id: 'deposit.add.error.nobalance2' },
      {
        asset1: asset.ticker,
        asset2: dexAsset.ticker
      }
    )

    const msg =
      // no balance for pool asset and rune
      !hasAssetBalance && !hasDexAssetBalance
        ? noRuneAndAssetBalancesMsg
        : // no rune balance
        !hasDexAssetBalance
        ? noRuneBalancesMsg
        : // no balance of pool asset
          noAssetBalancesMsg

    const title = intl.formatMessage({ id: 'deposit.add.error.nobalances' })

    return <Alert className="m-0 w-full xl:mr-20px" type="warning" message={title} description={msg} />
  }, [asset.ticker, dexAsset, hasAssetBalance, hasDexAssetBalance, intl])

  const updateRuneAmount = useCallback(
    (newAmount: BaseAmount) => {
      let runeAmount = newAmount.gt(maxRuneAmountToDeposit)
        ? { ...maxRuneAmountToDeposit } // Use copy to avoid missmatch with values in input fields
        : baseAmount(newAmount.amount().toNumber(), dexAssetDecimal)
      // assetAmount max. 1e8 decimal
      const assetAmountMax1e8 = Helper.getAssetAmountToDeposit({
        runeAmount,
        poolData,
        assetDecimal
      })

      if (assetAmountMax1e8.gt(maxAssetAmountToDepositMax1e8)) {
        runeAmount = Helper.getRuneAmountToDeposit(maxAssetAmountToDepositMax1e8, poolData)
        setRuneAmountToDeposit(runeAmount)
        setAssetAmountToDepositMax1e8(maxAssetAmountToDepositMax1e8)
        setPercentValueToDeposit(100)
      } else {
        setRuneAmountToDeposit(runeAmount)
        setAssetAmountToDepositMax1e8(assetAmountMax1e8)
        // formula: runeQuantity * 100 / maxRuneAmountToDeposit
        const percentToDeposit = maxRuneAmountToDeposit.gt(ZERO_BASE_AMOUNT)
          ? runeAmount.times(100).div(maxRuneAmountToDeposit).amount().toNumber()
          : 0
        setPercentValueToDeposit(percentToDeposit)
      }
    },
    [
      assetDecimal,
      dexAssetDecimal,
      maxAssetAmountToDepositMax1e8,
      maxRuneAmountToDeposit,
      poolData,
      setAssetAmountToDepositMax1e8
    ]
  )

  const runeAmountChangeHandler = useCallback(
    (amount: BaseAmount) => {
      // Do nothing if we don't entered input for rune
      if (selectedInput !== 'rune') return

      updateRuneAmount(amount)
    },
    [selectedInput, updateRuneAmount]
  )

  const updateAssetAmount = useCallback(
    (newAmount: BaseAmount) => {
      // make sure we use correct decimal based on assetBalanceForThorchain
      // (input's decimal might not be updated yet)
      const newAmountMax1e8 = convertBaseAmountDecimal(newAmount, assetBalanceMax1e8.decimal)

      let assetAmountMax1e8 = newAmountMax1e8.gt(maxAssetAmountToDepositMax1e8)
        ? { ...maxAssetAmountToDepositMax1e8 } // Use copy to avoid missmatch with values in input fields
        : { ...newAmountMax1e8 }
      const runeAmount = Helper.getRuneAmountToDeposit(assetAmountMax1e8, poolData)

      if (runeAmount.gt(maxRuneAmountToDeposit)) {
        assetAmountMax1e8 = Helper.getAssetAmountToDeposit({
          runeAmount,
          poolData,
          assetDecimal
        })
        setRuneAmountToDeposit(maxRuneAmountToDeposit)
        setAssetAmountToDepositMax1e8(assetAmountMax1e8)
        setPercentValueToDeposit(100)
      } else {
        setRuneAmountToDeposit(runeAmount)
        setAssetAmountToDepositMax1e8(assetAmountMax1e8)
        // assetQuantity * 100 / maxAssetAmountToDeposit
        const percentToDeposit = maxAssetAmountToDepositMax1e8.gt(baseAmount(0, maxAssetAmountToDepositMax1e8.decimal))
          ? assetAmountMax1e8.times(100).div(maxAssetAmountToDepositMax1e8).amount().toNumber()
          : 0
        setPercentValueToDeposit(percentToDeposit)
      }
    },
    [
      assetBalanceMax1e8.decimal,
      assetDecimal,
      maxAssetAmountToDepositMax1e8,
      maxRuneAmountToDeposit,
      poolData,
      setAssetAmountToDepositMax1e8
    ]
  )

  const assetAmountChangeHandler = useCallback(
    (amount: BaseAmount) => {
      // Do nothing if we don't entered input for asset
      if (selectedInput !== 'asset') return

      updateAssetAmount(amount)
    },
    [selectedInput, updateAssetAmount]
  )

  const changePercentHandler = useCallback(
    (percent: number) => {
      const runeAmountBN = maxRuneAmountToDeposit
        .amount()
        .dividedBy(100)
        .multipliedBy(percent)
        .decimalPlaces(0, BigNumber.ROUND_DOWN)
      const assetAmountMax1e8BN = maxAssetAmountToDepositMax1e8
        .amount()
        .dividedBy(100)
        .multipliedBy(percent)
        .decimalPlaces(0, BigNumber.ROUND_DOWN)

      setRuneAmountToDeposit(baseAmount(runeAmountBN, maxRuneAmountToDeposit.decimal))
      setAssetAmountToDepositMax1e8(baseAmount(assetAmountMax1e8BN, assetBalanceMax1e8.decimal))
      setPercentValueToDeposit(percent)
    },
    [assetBalanceMax1e8.decimal, maxAssetAmountToDepositMax1e8, maxRuneAmountToDeposit, setAssetAmountToDepositMax1e8]
  )

  const onChangeAssetHandler = useCallback(
    (asset: AnyAsset) => {
      onChangeAsset({ asset, assetWalletType, runeWalletType })
    },
    [assetWalletType, onChangeAsset, runeWalletType]
  )

  const onAfterSliderChangeHandler = useCallback(() => {
    if (selectedInput === 'none') {
      reloadFeesHandler()
    }
  }, [reloadFeesHandler, selectedInput])

  type ModalState = 'deposit' | 'approve' | 'none' | 'recover'
  const [showPasswordModal, setShowPasswordModal] = useState<ModalState>('none')
  const [showLedgerModal, setShowLedgerModal] = useState<ModalState>('none')
  const [showCompleteLpModal, setShowCompleteLpModal] = useState<ModalState>('none')

  const onSubmit = () => {
    if (isAssetLedger || isRuneLedger) {
      setShowLedgerModal('deposit')
    } else {
      setShowPasswordModal('deposit')
    }
  }
  const onRecoverSubmit = () => {
    setShowCompleteLpModal('recover')
  }

  const renderFeeError = useCallback(
    (fee: BaseAmount, amount: BaseAmount, asset: AnyAsset) => {
      const msg = intl.formatMessage(
        { id: 'deposit.add.error.chainFeeNotCovered' },
        {
          fee: formatAssetAmountCurrency({
            asset: getChainAsset(chain),
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
    [chain, intl]
  )

  const isThorchainFeeError = useMemo(() => {
    // ignore error check by having zero amounts
    if (isZeroAmountToDeposit) return false

    return FP.pipe(
      oDexAssetWB,
      O.fold(
        () => true,
        ({ amount }) => FP.pipe(depositFees.rune, Helper.minBalanceToDeposit, amount.lt)
      )
    )
  }, [isZeroAmountToDeposit, oDexAssetWB, depositFees.rune])

  const renderThorchainFeeError = useMemo(() => {
    if (!isThorchainFeeError || isBalanceError /* Don't render anything in case of fees or balance errors */)
      return <></>

    return renderFeeError(Helper.minBalanceToDeposit(depositFees.rune), dexAssetBalance, dexAsset)
  }, [depositFees.rune, dexAsset, isBalanceError, isThorchainFeeError, renderFeeError, dexAssetBalance])

  const isAssetChainFeeError = useMemo(() => {
    // ignore error check by having zero amounts
    if (isZeroAmountToDeposit) return false

    return FP.pipe(
      oChainAssetBalance,
      O.fold(
        () => true,
        (balance) => FP.pipe(depositFees.asset, Helper.minBalanceToDeposit, balance.lt)
      )
    )
  }, [isZeroAmountToDeposit, oChainAssetBalance, depositFees.asset])

  const renderAssetChainFeeError = useMemo(() => {
    if (!isAssetChainFeeError || isBalanceError /* Don't render anything in case of fees or balance errors */)
      return <></>

    return renderFeeError(Helper.minBalanceToDeposit(depositFees.asset), chainAssetBalance, getChainAsset(chain))
  }, [isAssetChainFeeError, isBalanceError, renderFeeError, depositFees.asset, chainAssetBalance, chain])

  const txModalExtraContent = useMemo(() => {
    const stepDescriptions = [
      intl.formatMessage({ id: 'common.tx.healthCheck' }),
      intl.formatMessage({ id: 'common.tx.sendingAsset' }, { assetTicker: asset.ticker }),
      intl.formatMessage({ id: 'common.tx.sendingAsset' }, { assetTicker: dexAsset.ticker }),
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
      <DepositAssets
        target={{ asset: dexAsset, amount: runeAmountToDeposit }}
        source={O.some({ asset, amount: assetAmountToDepositMax1e8 })}
        stepDescription={stepDescription}
        network={network}
      />
    )
  }, [
    intl,
    asset,
    dexAsset,
    depositState.deposit,
    depositState.step,
    depositState.stepsTotal,
    runeAmountToDeposit,
    assetAmountToDepositMax1e8,
    network
  ])

  const txModalExtraContentAsym = useMemo(() => {
    const source = FP.pipe(
      oFailedAssetAmount,
      O.fold(
        // None case
        () => ({ asset: dexAsset, amount: ZERO_BASE_AMOUNT }),
        // Some case
        (failedAssetAmount) => ({ asset: failedAssetAmount.asset, amount: failedAssetAmount.amount1e8 })
      )
    )
    const stepDescriptions = [
      intl.formatMessage({ id: 'common.tx.healthCheck' }),
      intl.formatMessage({ id: 'common.tx.sendingAsset' }, { assetTicker: source.asset.ticker }),
      intl.formatMessage({ id: 'common.tx.checkResult' })
    ]
    const stepDescription = FP.pipe(
      asymDepositState.deposit,
      RD.fold(
        () => '',
        () =>
          `${intl.formatMessage(
            { id: 'common.step' },
            { current: asymDepositState.step, total: asymDepositState.stepsTotal }
          )}: ${stepDescriptions[asymDepositState.step - 1]}`,
        () => '',
        () => `${intl.formatMessage({ id: 'common.done' })}!`
      )
    )

    return (
      <DepositAsset
        source={O.some({ asset: source.asset, amount: source.amount })}
        stepDescription={stepDescription}
        network={network}
      />
    )
  }, [
    oFailedAssetAmount,
    intl,
    asymDepositState.deposit,
    asymDepositState.step,
    asymDepositState.stepsTotal,
    network,
    dexAsset
  ])

  const onCloseTxModal = useCallback(() => {
    resetDepositState()
    resetAsymDepositState()
    changePercentHandler(0)
  }, [resetDepositState, resetAsymDepositState, changePercentHandler])

  const onFinishTxModal = useCallback(() => {
    onCloseTxModal()
    reloadBalances()
    reloadShares(5000)
    reloadSelectedPoolDetail(5000)
  }, [onCloseTxModal, reloadBalances, reloadSelectedPoolDetail, reloadShares])

  const renderTxModal = useMemo(() => {
    const { deposit: depositRD, depositTxs: symDepositTxs } = depositState

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
        () => 'deposit.add.state.pending',
        () => 'deposit.add.state.pending',
        () => 'deposit.add.state.error',
        () => 'deposit.add.state.success'
      ),
      (id) => intl.formatMessage({ id })
    )

    const extraResult = (
      <div className="flex flex-col items-center justify-between">
        {FP.pipe(symDepositTxs.asset, RD.toOption, (oTxHash) => (
          <ViewTxButton
            className="pb-20px"
            txHash={oTxHash}
            onClick={openAssetExplorerTxUrl}
            txUrl={FP.pipe(oTxHash, O.chain(getAssetExplorerTxUrl))}
            label={intl.formatMessage({ id: 'common.tx.view' }, { assetTicker: asset.ticker })}
          />
        ))}
        {FP.pipe(symDepositTxs.rune, RD.toOption, (oTxHash) => (
          <ViewTxButton
            txHash={oTxHash}
            onClick={openRuneExplorerTxUrl}
            txUrl={FP.pipe(oTxHash, O.chain(getRuneExplorerTxUrl))}
            label={intl.formatMessage({ id: 'common.tx.view' }, { assetTicker: dexAsset.ticker })}
          />
        ))}
      </div>
    )

    return (
      <TxModal
        title={txModalTitle}
        onClose={onCloseTxModal}
        onFinish={onFinishTxModal}
        startTime={depositStartTime}
        txRD={depositRD}
        timerValue={timerValue}
        extraResult={extraResult}
        extra={txModalExtraContent}
      />
    )
  }, [
    depositState,
    onCloseTxModal,
    onFinishTxModal,
    depositStartTime,
    txModalExtraContent,
    intl,
    openAssetExplorerTxUrl,
    getAssetExplorerTxUrl,
    asset.ticker,
    openRuneExplorerTxUrl,
    getRuneExplorerTxUrl,
    dexAsset
  ])
  const renderRecoverTxModal = useMemo(() => {
    const { deposit: depositRD, depositTx } = asymDepositState

    // don't render TxModal in initial state
    if (RD.isInitial(depositRD)) return <></>

    const source = FP.pipe(
      oFailedAssetAmount,
      O.fold(
        // None case
        () => ({ asset: dexAsset, amount: ZERO_BASE_AMOUNT }),
        // Some case
        (failedAssetAmount) => ({ asset: failedAssetAmount.asset, amount: failedAssetAmount.amount1e8 })
      )
    )

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
        () => 'deposit.add.state.pending',
        () => 'deposit.add.state.pending',
        () => 'deposit.add.state.error',
        () => 'deposit.add.state.success'
      ),
      (id) => intl.formatMessage({ id })
    )

    const oTxHash = FP.pipe(
      RD.toOption(depositTx),
      // Note: As long as we link to `viewblock` to open tx details in a browser,
      // `0x` needs to be removed from tx hash in case of ETH
      // @see https://github.com/thorchain/asgardex-electron/issues/1787#issuecomment-931934508
      O.map((txHash) =>
        isEthChain(chain) || isAvaxChain(chain) || isBscChain(chain) ? txHash.replace(/0x/i, '') : txHash
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
            onClick={dexAsset === source.asset ? openRuneExplorerTxUrl : openAssetExplorerTxUrl}
            txUrl={FP.pipe(oTxHash, O.chain(dexAsset === source.asset ? getRuneExplorerTxUrl : getAssetExplorerTxUrl))}
            label={intl.formatMessage({ id: 'common.tx.view' }, { assetTicker: asset.ticker })}
          />
        }
        extra={txModalExtraContentAsym}
      />
    )
  }, [
    asymDepositState,
    oFailedAssetAmount,
    onCloseTxModal,
    onFinishTxModal,
    depositStartTime,
    dexAsset,
    asset,
    openRuneExplorerTxUrl,
    openAssetExplorerTxUrl,
    getRuneExplorerTxUrl,
    getAssetExplorerTxUrl,
    intl,
    txModalExtraContentAsym,
    chain
  ])

  const submitDepositTx = useCallback(() => {
    FP.pipe(
      oDepositParams,
      O.map((params) => {
        // set start time
        setDepositStartTime(Date.now())
        // subscribe to deposit$
        subscribeDepositState(deposit$(params))

        return true
      })
    )
  }, [oDepositParams, subscribeDepositState, deposit$])

  const submitAsymDepositTx = useCallback(() => {
    FP.pipe(
      oAsymDepositParams,
      O.map((params) => {
        // set start time
        setDepositStartTime(Date.now())
        // subscribe to deposit$
        subscribeAsymDepositState(asymDeposit$(params))

        return true
      })
    )
  }, [oAsymDepositParams, subscribeAsymDepositState, asymDeposit$])

  const inputOnBlur = useCallback(() => {
    setSelectedInput('none')
    reloadFeesHandler()
  }, [reloadFeesHandler])

  const uiApproveFeesRD: UIFeesRD = useMemo(
    () =>
      FP.pipe(
        approveFeeRD,
        RD.map((approveFee) => [{ asset: getChainAsset(chain), amount: approveFee }])
      ),
    [approveFeeRD, chain]
  )

  const isApproveFeeError = useMemo(() => {
    // ignore error check if we don't need to check allowance
    if (!needApprovement) return false

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

    return renderFeeError(approveFee, chainAssetBalance, getChainAsset(chain))
  }, [
    isApproveFeeError,
    oChainAssetBalance,
    walletBalancesLoading,
    renderFeeError,
    approveFee,
    chainAssetBalance,
    chain
  ])

  const {
    state: approveState,
    reset: resetApproveState,
    subscribe: subscribeApproveState
  } = useSubscriptionState<TxHashRD>(RD.initial)

  const onApprove = useCallback(() => {
    if (isAssetLedger) {
      setShowLedgerModal('approve')
    } else {
      setShowPasswordModal('approve')
    }
  }, [isAssetLedger])

  const submitApproveTx = useCallback(() => {
    FP.pipe(
      oApproveParams,
      O.map(({ walletAccount, walletIndex, walletType, contractAddress, spenderAddress, fromAddress, hdMode }) =>
        subscribeApproveState(
          approveERC20Token$({
            network,
            contractAddress,
            spenderAddress,
            fromAddress,
            walletAccount,
            walletIndex,
            walletType,
            hdMode
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
      !needApprovement ||
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
    if (!needApprovement) return false
    // ignore initial + loading states for `isApprovedState`
    return RD.isPending(isApprovedState)
  }, [isApprovedState, needApprovement])

  const checkIsApprovedError = useMemo(() => {
    // ignore error check if we don't need to check allowance
    if (!needApprovement) return false

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
            {intl.formatMessage({ id: 'common.approve.error' }, { asset: asset.ticker, error: error.msg })}
          </p>
        ),
        (_) => <></>
      )
    )
  }, [checkIsApprovedError, intl, isApprovedState, asset])

  const hasPendingAssets: boolean = useMemo(
    () =>
      FP.pipe(
        symPendingAssetsRD,
        RD.toOption,
        O.map((pendingAssets): boolean => pendingAssets.length > 0),
        O.getOrElse((): boolean => false)
      ),
    [symPendingAssetsRD]
  )

  const hasAsymDeposits: boolean = useMemo(
    () =>
      FP.pipe(
        hasAsymAssetsRD,
        RD.toOption,
        O.map(({ dexAsset, asset }) => dexAsset || asset),
        O.getOrElse((): boolean => false)
      ),
    [hasAsymAssetsRD]
  )

  const prevPendingAssets = useRef<PendingAssets>([])

  const renderPendingAssets = useMemo(() => {
    const render = (pendingAssets: PendingAssets, missingAssets: FailedAssets, loading: boolean) =>
      pendingAssets &&
      pendingAssets.length > 0 && (
        <PendingAssetsWarning
          className="m-0 w-full xl:mr-20px"
          network={network}
          pendingAssets={pendingAssets}
          failedAssets={missingAssets}
          loading={loading}
        />
      )

    return FP.pipe(
      symPendingAssetsRD,
      RD.fold(
        () => <></>,
        () => render(prevPendingAssets.current, prevPendingAssets.current, true),
        () => (
          <>
            <Spin />
          </>
        ),
        (pendingAssets) => {
          prevPendingAssets.current = pendingAssets
          const missingAssets: AssetsWithAmount1e8 = pendingAssets.map((assetWB): AssetWithAmount1e8 => {
            const amount =
              dexAsset !== assetWB.asset
                ? Helper.getRuneAmountToDeposit(assetWB.amount1e8, poolData)
                : Helper.getAssetAmountToDeposit({ runeAmount: assetWB.amount1e8, poolData, assetDecimal })

            const assetAmount: AssetWithAmount1e8 = {
              asset: dexAsset === assetWB.asset ? asset : dexAsset,
              amount1e8: amount
            }
            setFailedAssetAmount(O.some(assetAmount))
            return assetAmount
          })
          return render(pendingAssets, missingAssets, false)
        }
      )
    )
  }, [asset, assetDecimal, dexAsset, network, poolData, symPendingAssetsRD])

  const prevHasAsymAssets = useRef<LiquidityProviderHasAsymAssets>({ dexAsset: false, asset: false })

  const renderAsymDepositWarning = useMemo(() => {
    const render = ({ dexAsset, asset: hasAsset }: LiquidityProviderHasAsymAssets, loading: boolean) => {
      const assets = FP.pipe(
        // Add optional assets to list
        [dexAsset ? O.some(dex.asset) : O.none, hasAsset ? O.some(asset) : O.none],
        // filter `None` out from list
        A.filterMap(FP.identity)
      )
      return (
        <AsymAssetsWarning
          className="m-0 w-full xl:mr-20px"
          network={network}
          assets={assets}
          loading={loading}
          onClickOpenAsymTool={openAsymDepositTool}
        />
      )
    }
    return FP.pipe(
      hasAsymAssetsRD,
      RD.fold(
        () => <></>,
        () => render(prevHasAsymAssets.current, true),
        () => <></>,
        (hasAssets) => {
          prevHasAsymAssets.current = hasAssets
          return render(hasAssets, false)
        }
      )
    )
  }, [asset, dex, hasAsymAssetsRD, network, openAsymDepositTool])

  const hasAssetMismatch: boolean = useMemo(
    () => FP.pipe(RD.toOption(symAssetMismatchRD), O.flatten, O.isSome),
    [symAssetMismatchRD]
  )

  const prevAssetMismatch = useRef<LiquidityProviderAssetMismatch>(O.none)

  const renderAssetMismatch = useMemo(() => {
    const render = (assetMismatch: LiquidityProviderAssetMismatch) =>
      FP.pipe(
        assetMismatch,
        O.fold(
          () => <></>,
          ({ dexAssetAddress, assetAddress }) => (
            <AssetMissmatchWarning
              className="m-0 w-full xl:mr-20px"
              assets={[
                { asset, address: assetAddress },
                { asset: dexAsset, address: dexAssetAddress }
              ]}
              network={network}
            />
          )
        )
      )

    return FP.pipe(
      symAssetMismatchRD,
      RD.fold(
        () => <></>,
        () => render(prevAssetMismatch.current),
        () => <></>,
        (assetMismatch) => {
          prevAssetMismatch.current = assetMismatch
          return render(assetMismatch)
        }
      )
    )
  }, [asset, dexAsset, network, symAssetMismatchRD])

  const resetEnteredAmounts = useCallback(() => {
    setRuneAmountToDeposit(baseAmount(0, dexAssetDecimal))
    setAssetAmountToDepositMax1e8(initialAssetAmountToDepositMax1e8)
    setPercentValueToDeposit(0)
  }, [dexAssetDecimal, initialAssetAmountToDepositMax1e8, setAssetAmountToDepositMax1e8])

  const useRuneLedgerHandler = useCallback(
    (useLedger: boolean) => {
      const walletType: WalletType = useLedger ? 'ledger' : 'keystore'
      onChangeAsset({ asset, assetWalletType, runeWalletType: walletType })
      resetEnteredAmounts()
    },

    [asset, assetWalletType, onChangeAsset, resetEnteredAmounts]
  )

  const useAssetLedgerHandler = useCallback(
    (useLedger: boolean) => {
      const walletType: WalletType = useLedger ? 'ledger' : 'keystore'
      onChangeAsset({ asset, assetWalletType: walletType, runeWalletType })
      resetEnteredAmounts()
    },
    [asset, onChangeAsset, resetEnteredAmounts, runeWalletType]
  )

  const renderPasswordConfirmationModal = useMemo(() => {
    if (showPasswordModal === 'none') return <></>

    const onSuccess = () => {
      if (showPasswordModal === 'deposit') submitDepositTx()
      if (showPasswordModal === 'recover') submitAsymDepositTx()
      if (showPasswordModal === 'approve') submitApproveTx()
      setShowPasswordModal('none')
    }
    const onClose = () => {
      setShowPasswordModal('none')
    }

    return (
      <WalletPasswordConfirmationModal onSuccess={onSuccess} onClose={onClose} validatePassword$={validatePassword$} />
    )
  }, [showPasswordModal, submitApproveTx, submitAsymDepositTx, submitDepositTx, validatePassword$])

  const renderLedgerConfirmationModal = useMemo(() => {
    if (showLedgerModal === 'none') return <></>

    const onClose = () => {
      setShowLedgerModal('none')
    }

    const onSuccess = () => {
      if (showLedgerModal === 'deposit') setShowPasswordModal('deposit')
      if (showLedgerModal === 'recover') submitAsymDepositTx()
      if (showLedgerModal === 'approve') submitApproveTx()
      setShowLedgerModal('none')
    }

    const chainAsString = chainToString(isRuneLedger ? THORChain : chain)
    const txtNeedsConnected = intl.formatMessage(
      {
        id: 'ledger.needsconnected'
      },
      { chain: chainAsString }
    )

    const description1 =
      // extra info for ERC20 assets only
      isEvmChain(chain) && isEvmToken(asset)
        ? `${txtNeedsConnected} ${intl.formatMessage(
            {
              id: 'ledger.blindsign'
            },
            { chain: chainAsString }
          )}`
        : txtNeedsConnected

    const description2 = intl.formatMessage({ id: 'ledger.sign' })

    const oIsDeposit = O.fromPredicate<ModalState>((v) => v === 'deposit')(showLedgerModal)

    const addresses = FP.pipe(
      sequenceTOption(oIsDeposit, oDepositParams),
      O.chain(([_, { poolAddress, runeSender, assetSender }]) => {
        const recipient = poolAddress.address
        if (isRuneLedger) return O.some({ recipient, sender: runeSender })
        if (isAssetLedger) return O.some({ recipient, sender: assetSender })
        return O.none
      })
    )

    return (
      <LedgerConfirmationModal
        onSuccess={onSuccess}
        onClose={onClose}
        visible
        chain={isRuneLedger ? THORChain : chain}
        network={network}
        description1={description1}
        description2={description2}
        addresses={addresses}
      />
    )
  }, [
    asset,
    chain,
    intl,
    isAssetLedger,
    isRuneLedger,
    network,
    oDepositParams,
    showLedgerModal,
    submitApproveTx,
    submitAsymDepositTx
  ])

  const renderCompleteLp = useMemo(() => {
    if (showCompleteLpModal === 'none') return <></>

    const onClose = () => {
      setShowCompleteLpModal('none')
    }

    const onSuccess = () => {
      if (failedAssetWalletType === 'ledger') {
        setShowLedgerModal('recover')
      } else {
        setShowPasswordModal('recover')
      }
    }

    const content = () => {
      return FP.pipe(
        oAsymDepositParams,
        O.map((params) => (
          <div key={params.sender}>
            <div className="flex-col">
              {intl.formatMessage({ id: 'common.tx.type.deposit' })}
              <div className="items-left justify-left m-2 flex">
                <AssetIcon className="flex-shrink-0" size="small" asset={params.asset} network={network} />
                <AssetLabel className="mx-2 flex-shrink-0" asset={params.asset} />
                <Label className="flex-shrink-0">
                  {formatAssetAmountCurrency({
                    asset: params.asset,
                    amount: baseToAsset(params.amount),
                    trimZeros: true
                  })}
                </Label>
              </div>

              <Label>{`With memo: ${params.memo}`}</Label>
            </div>
          </div>
        )),
        O.toNullable
      )
    }

    return (
      <ConfirmationModal
        onClose={onClose}
        onSuccess={onSuccess}
        visible={true}
        content={content()}
        title={intl.formatMessage({ id: 'common.completeLp' })}
      />
    )
  }, [failedAssetWalletType, intl, network, oAsymDepositParams, showCompleteLpModal])
  useEffect(() => {
    if (!eqOAsset.equals(prevAsset.current, O.some(asset))) {
      prevAsset.current = O.some(asset)
      // reset deposit state
      resetDepositState()
      // set values to zero
      changePercentHandler(0)
      // reset isApproved state
      resetIsApprovedState()
      // reset approve state
      resetApproveState()
      // reset fees
      prevDepositFees.current = O.none
      // reload fees
      reloadFeesHandler()
    }
  }, [
    asset,
    reloadShares,
    reloadFeesHandler,
    resetApproveState,
    resetIsApprovedState,
    reloadSelectedPoolDetail,
    resetDepositState,
    changePercentHandler,
    minRuneAmountToDeposit
  ])

  /**
   * Disables form elements (input fields, slider)
   */
  const disabledForm = useMemo(
    () =>
      disableDepositAction ||
      isBalanceError ||
      protocolLimitReached ||
      disabled ||
      assetBalance.amount().isZero() ||
      dexAssetBalance.amount().isZero() ||
      hasPendingAssets ||
      hasAsymDeposits ||
      hasAssetMismatch,
    [
      disableDepositAction,
      isBalanceError,
      protocolLimitReached,
      disabled,
      assetBalance,
      dexAssetBalance,
      hasPendingAssets,
      hasAsymDeposits,
      hasAssetMismatch
    ]
  )

  /**
   * Disables submit button
   */
  const disableSubmit = useMemo(
    () =>
      disabledForm ||
      RD.isPending(depositFeesRD) ||
      RD.isPending(approveState) ||
      walletBalancesLoading ||
      isThorchainFeeError ||
      isAssetChainFeeError ||
      isZeroAmountToDeposit ||
      minRuneAmountError ||
      minAssetAmountError,
    [
      approveState,
      depositFeesRD,
      disabledForm,
      isAssetChainFeeError,
      isThorchainFeeError,
      isZeroAmountToDeposit,
      minAssetAmountError,
      minRuneAmountError,
      walletBalancesLoading
    ]
  )

  const disableSubmitApprove = useMemo(
    () => checkIsApprovedError || isApproveFeeError || walletBalancesLoading,

    [checkIsApprovedError, isApproveFeeError, walletBalancesLoading]
  )

  const renderMinAmount = useCallback(
    ({
      minAmount,
      minAmountInfo,
      asset,
      isError
    }: {
      minAmount: BaseAmount
      minAmountInfo: string
      asset: AnyAsset
      isError: boolean
    }) => (
      <div className="flex w-full items-center pl-10px pt-5px">
        <p
          className={`m-0 pr-5px font-main text-[12px] uppercase ${
            isError ? 'dark:error-0d text-error0' : 'text-gray2 dark:text-gray2d'
          }`}>
          {`${intl.formatMessage({ id: 'common.min' })}: ${formatAssetAmountCurrency({
            asset,
            amount: baseToAsset(minAmount),
            trimZeros: true
          })}`}
        </p>
        <InfoIcon
          // override color
          className={`${isError ? '' : 'text-gray2 dark:text-gray2d'}`}
          color={isError ? 'error' : 'neutral'}
          tooltip={minAmountInfo}
        />
      </div>
    ),
    [intl]
  )

  const extraRuneContent = useMemo(
    () => (
      <div className="flex flex-col">
        <MaxBalanceButton
          className="mt-5px"
          classNameButton="!text-gray2 dark:!text-gray2d"
          classNameIcon={
            // show warn icon if maxAmountToSwapMax <= 0
            maxRuneAmountToDeposit.gt(ZERO_BASE_AMOUNT)
              ? `text-gray2 dark:text-gray2d`
              : 'text-warning0 dark:text-warning0d'
          }
          size="medium"
          balance={{ amount: maxRuneAmountToDeposit, asset: dexAsset }}
          maxDollarValue={priceRuneAmountToDepsoitMax1e8}
          onClick={() => {
            updateRuneAmount(maxRuneAmountToDeposit)
          }}
          maxInfoText={intl.formatMessage(
            { id: 'deposit.add.max.infoWithFee' },
            { balance: dexAssetBalanceLabel, fee: runeFeeLabel }
          )}
          hidePrivateData={hidePrivateData}
        />
        {minRuneAmountError &&
          renderMinAmount({
            minAmount: minRuneAmountToDeposit,
            minAmountInfo: intl.formatMessage({ id: 'deposit.add.min.info' }),
            asset,
            isError: minRuneAmountError
          })}
      </div>
    ),
    [
      asset,
      dexAsset,
      hidePrivateData,
      intl,
      maxRuneAmountToDeposit,
      minRuneAmountError,
      minRuneAmountToDeposit,
      priceRuneAmountToDepsoitMax1e8,
      renderMinAmount,
      dexAssetBalanceLabel,
      runeFeeLabel,
      updateRuneAmount
    ]
  )

  const extraAssetContent = useMemo(
    () => (
      <div className="flex flex-col">
        <MaxBalanceButton
          className="mt-5px"
          classNameButton="!text-gray2 dark:!text-gray2d"
          classNameIcon={
            // show warn icon if maxAmountToSwapMax <= 0
            maxAssetAmountToDepositMax1e8.gt(baseAmount(0, maxAssetAmountToDepositMax1e8.decimal))
              ? `text-gray2 dark:text-gray2d`
              : 'text-warning0 dark:text-warning0d'
          }
          size="medium"
          balance={{ amount: maxAssetAmountToDepositMax1e8, asset }}
          maxDollarValue={priceAmountToSwapMax1e8}
          onClick={() => {
            updateAssetAmount(maxAssetAmountToDepositMax1e8)
          }}
          maxInfoText={
            isChainAsset(asset)
              ? intl.formatMessage(
                  { id: 'deposit.add.max.infoWithFee' },
                  { balance: assetBalanceLabel, fee: assetFeeLabel }
                )
              : intl.formatMessage({ id: 'deposit.add.max.info' }, { balance: assetBalanceLabel })
          }
          hidePrivateData={hidePrivateData}
        />
        {minAssetAmountError &&
          renderMinAmount({
            minAmount: minAssetAmountToDepositMax1e8,
            minAmountInfo: intl.formatMessage({ id: 'deposit.add.min.info' }),
            asset,
            isError: minAssetAmountError
          })}
      </div>
    ),
    [
      maxAssetAmountToDepositMax1e8,
      asset,
      priceAmountToSwapMax1e8,
      intl,
      assetBalanceLabel,
      assetFeeLabel,
      hidePrivateData,
      minAssetAmountError,
      renderMinAmount,
      minAssetAmountToDepositMax1e8,
      updateAssetAmount
    ]
  )

  const [showDetails, setShowDetails] = useState<boolean>(true)

  return (
    <div className="flex min-h-full w-full flex-col items-center justify-between">
      {hasPendingAssets && <div className="w-full pb-20px xl:px-20px">{renderPendingAssets}</div>}
      {hasAsymDeposits && <div className="w-full pb-20px xl:px-20px">{renderAsymDepositWarning}</div>}
      {hasAssetMismatch && <div className="w-full pb-20px xl:px-20px">{renderAssetMismatch}</div>}
      {showBalanceError && <div className="w-full pb-20px xl:px-20px">{renderBalanceError}</div>}

      <div className="flex max-w-[500px] flex-col">
        {!hasPendingAssets && (
          <div>
            <AssetInput
              className="w-full"
              title={intl.formatMessage({ id: 'deposit.add.runeSide' }, { dex: dex.chain })}
              amount={{ amount: runeAmountToDeposit, asset: dexAsset }}
              priceAmount={priceRuneAmountToDepositMax1e8}
              assets={[]}
              network={network}
              onChangeAsset={FP.constVoid}
              onChange={runeAmountChangeHandler}
              onBlur={inputOnBlur}
              onFocus={() => setSelectedInput('rune')}
              showError={minRuneAmountError}
              useLedger={isRuneLedger}
              hasLedger={hasRuneLedger}
              useLedgerHandler={useRuneLedgerHandler}
              extraContent={extraRuneContent}
            />
            <div className="w-full px-20px pb-40px pt-20px">
              <Slider
                onAfterChange={onAfterSliderChangeHandler}
                disabled={disabledForm}
                value={percentValueToDeposit}
                onChange={changePercentHandler}
                tooltipPlacement="top"
                withLabel={true}
              />
            </div>
            <>
              <AssetInput
                className="w-full"
                title={intl.formatMessage({ id: 'deposit.add.assetSide' })}
                amount={{ amount: assetAmountToDepositMax1e8, asset }}
                priceAmount={priceAssetAmountToDepositMax1e8}
                assets={poolBasedBalancesAssets}
                network={network}
                onChangeAsset={onChangeAssetHandler}
                onChange={assetAmountChangeHandler}
                onBlur={inputOnBlur}
                onFocus={() => setSelectedInput('asset')}
                showError={minAssetAmountError}
                useLedger={isAssetLedger}
                hasLedger={hasAssetLedger}
                useLedgerHandler={useAssetLedgerHandler}
                extraContent={extraAssetContent}
              />
            </>
          </div>
        )}

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
                  ? intl.formatMessage({ id: 'common.approve.checking' }, { asset: asset.ticker })
                  : walletBalancesLoading
                  ? intl.formatMessage({ id: 'common.balance.loading' })
                  : undefined
              }
            />
          )}
          {isApproved ? (
            <>
              {renderAssetChainFeeError}
              {renderThorchainFeeError}
              {hasPendingAssets ? (
                <FlatButton className="mb-20px min-w-[200px]" size="large" onClick={onRecoverSubmit}>
                  {intl.formatMessage({ id: 'common.completeLp' })}
                </FlatButton>
              ) : (
                <FlatButton className="mb-20px min-w-[200px]" size="large" onClick={onSubmit} disabled={disableSubmit}>
                  {intl.formatMessage({ id: 'common.add' })}
                </FlatButton>
              )}
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

              {!RD.isInitial(uiApproveFeesRD) && <Fees fees={uiApproveFeesRD} reloadFees={reloadApproveFeesHandler} />}
            </>
          )}
        </div>

        <div className={`w-full px-10px font-main text-[12px] uppercase dark:border-gray1d`}>
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
                disabled={RD.isPending(depositFeesRD) || RD.isInitial(depositFeesRD)}
                className="group !p-0 !font-mainBold !text-gray2 dark:!text-gray2d"
                onClick={reloadFeesHandler}>
                {intl.formatMessage({ id: 'common.fees.estimated' })}
                <ArrowPathIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
              </BaseButton>
              <div>{priceDepositFeesLabel}</div>
            </div>

            {showDetails && (
              <>
                <div className="flex w-full justify-between pl-10px text-[12px]">
                  <div>{intl.formatMessage({ id: 'common.fee.inbound.rune' }, { dex: dex.chain })}</div>
                  <div>{priceRuneInFeeLabel}</div>
                </div>
                <div className="flex w-full justify-between pl-10px text-[12px]">
                  <div>{intl.formatMessage({ id: 'common.fee.outbound.rune' }, { dex: dex.chain })}</div>
                  <div>{priceRuneOutFeeLabel}</div>
                </div>
                <div className="flex w-full justify-between pl-10px text-[12px]">
                  <div>{intl.formatMessage({ id: 'common.fee.inbound.asset' })}</div>
                  <div>{priceAssetInFeeLabel}</div>
                </div>
                <div className="flex w-full justify-between pl-10px text-[12px]">
                  <div>{intl.formatMessage({ id: 'common.fee.outbound.asset' })}</div>
                  <div>{priceAssetOutFeeLabel}</div>
                </div>
                <div className="flex w-full justify-between pl-10px text-[12px]">
                  <div>{intl.formatMessage({ id: 'common.fee.affiliate' })}</div>
                  <div>
                    {formatAssetAmountCurrency({
                      amount: ZERO_ASSET_AMOUNT,
                      asset: pricePool.asset,
                      decimal: 0
                    })}
                  </div>
                </div>
              </>
            )}

            {/* addresses */}
            {showDetails && (
              <>
                <div className={`w-full pt-10px font-mainBold text-[14px]`}>
                  {intl.formatMessage({ id: 'common.addresses' })}
                </div>
                {/* rune sender address */}
                <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                  <div>{intl.formatMessage({ id: 'common.rune' }, { dex: dex.chain })}</div>
                  <div className="truncate pl-20px text-[13px] normal-case leading-normal">
                    {FP.pipe(
                      oDexAssetWB,
                      O.map(({ walletAddress: address }) => (
                        <TooltipAddress title={address} key="tooltip-asset-sender-addr">
                          {hidePrivateData ? hiddenString : address}
                        </TooltipAddress>
                      )),
                      O.getOrElse(() => <>{noDataString}</>)
                    )}
                  </div>
                </div>
                {/* asset sender address */}
                <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                  <div>{intl.formatMessage({ id: 'common.asset' })}</div>
                  <div className="truncate pl-20px text-[13px] normal-case leading-normal">
                    {FP.pipe(
                      oAssetWB,
                      O.map(({ walletAddress: address }) => (
                        <TooltipAddress title={address} key="tooltip-asset-sender-addr">
                          {hidePrivateData ? hiddenString : address}
                        </TooltipAddress>
                      )),
                      O.getOrElse(() => <>{noDataString}</>)
                    )}
                  </div>
                </div>
                {/* asset inbound address */}
                {FP.pipe(
                  oDepositParams,
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
                {/* rune sender balance */}
                <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                  <div>{intl.formatMessage({ id: 'common.rune' }, { dex: dex.chain })}</div>
                  <div className="truncate pl-20px text-[13px] normal-case leading-normal">{dexAssetBalanceLabel}</div>
                </div>
                {/* asset sender balance */}
                <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                  <div>{intl.formatMessage({ id: 'common.asset' })}</div>
                  <div className="truncate pl-20px text-[13px] normal-case leading-normal">{assetBalanceLabel}</div>
                </div>
              </>
            )}

            {/* memo */}
            {showDetails && (
              <>
                <div className={`w-full pt-10px font-mainBold text-[14px]`}>
                  {intl.formatMessage({ id: 'common.memos' })}
                </div>
                <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                  <div className="">
                    {FP.pipe(
                      oDepositParams,
                      O.map(({ memos: { rune: memo } }) => memo),
                      O.getOrElse(() => emptyString),
                      (memo) => (
                        <CopyLabel
                          className="whitespace-nowrap pl-0 uppercase text-gray2 dark:text-gray2d"
                          label={intl.formatMessage({ id: 'common.transaction.short.rune' }, { dex: dex.chain })}
                          key="memo-copy"
                          textToCopy={memo}
                        />
                      )
                    )}
                  </div>

                  <div className="truncate pl-10px font-main text-[12px]">
                    {FP.pipe(
                      oDepositParams,
                      O.map(({ memos: { rune: memo } }) => (
                        <Tooltip title={memo} key={`tooltip-${dex}-memo`}>
                          {hidePrivateData ? hiddenString : memo}
                        </Tooltip>
                      )),
                      O.toNullable
                    )}
                  </div>
                </div>

                <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                  <div className="">
                    {FP.pipe(
                      oDepositParams,
                      O.map(({ memos: { asset: memo } }) => memo),
                      O.getOrElse(() => emptyString),
                      (memo) => (
                        <CopyLabel
                          className="whitespace-nowrap pl-0 uppercase text-gray2 dark:text-gray2d"
                          label={intl.formatMessage({ id: 'common.transaction.short.asset' })}
                          key="memo-copy"
                          textToCopy={memo}
                        />
                      )
                    )}
                  </div>

                  <div className="truncate pl-10px font-main text-[12px]">
                    {FP.pipe(
                      oDepositParams,
                      O.map(({ memos: { asset: memo } }) => (
                        <Tooltip title={memo} key="tooltip-asset-memo">
                          {hidePrivateData ? hiddenString : memo}
                        </Tooltip>
                      )),
                      O.toNullable
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        {renderPasswordConfirmationModal}
        {renderLedgerConfirmationModal}
        {renderTxModal}
        {renderRecoverTxModal}
        {renderCompleteLp}
      </div>
    </div>
  )
}
