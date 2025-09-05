import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import {
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  ArrowsUpDownIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'
import { QuoteSwap } from '@xchainjs/xchain-aggregator'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative, isTCYAsset, THORChain } from '@xchainjs/xchain-thorchain'
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
  isTradeAsset,
  isSecuredAsset,
  SecuredAsset,
  Chain
} from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { array as A, function as FP, nonEmptyArray as NEA, option as O } from 'fp-ts'
import { debounce } from 'lodash'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import * as RxOp from 'rxjs/operators'

import { ASGARDEX_AFFILIATE_FEE_MIN, getAsgardexAffiliateFee, getAsgardexThorname } from '../../../shared/const'
import { ONE_RUNE_BASE_AMOUNT } from '../../../shared/mock/amount'
import { isMayaSupportedAsset, isTCSupportedAsset } from '../../../shared/utils/asset'
import {
  chainToString,
  DEFAULT_ENABLED_CHAINS,
  DefaultChainAttributes,
  EnabledChain,
  isChainOfThor
} from '../../../shared/utils/chain'
import { isLedgerWallet } from '../../../shared/utils/guard'
import { HDMode, WalletType } from '../../../shared/wallet/types'
import { ZERO_BASE_AMOUNT } from '../../const'
import { useChainflipContext } from '../../contexts/ChainflipContext'
import { useWalletContext } from '../../contexts/WalletContext'
import {
  max1e8BaseAmount,
  convertBaseAmountDecimal,
  to1e8BaseAmount,
  THORCHAIN_DECIMAL,
  isUSDAsset,
  isRuneNativeAsset,
  isCacaoAsset,
  isEVMTokenAsset,
  getEVMTokenAddressForChain,
  isRujiAsset
} from '../../helpers/assetHelper'
import { getChainAsset } from '../../helpers/chainHelper'
import { isEvmChainToken } from '../../helpers/evmHelper'
import { unionAssets } from '../../helpers/fp/array'
import { eqAsset, eqBaseAmount, eqOAsset, eqAddress, eqOApproveParams } from '../../helpers/fp/eq'
import { sequenceSOption, sequenceTOption } from '../../helpers/fpHelpers'
import { getSwapMemo, updateMemo } from '../../helpers/memoHelper'
import * as PoolHelpers from '../../helpers/poolHelper'
import * as PoolHelpersMaya from '../../helpers/poolHelperMaya'
import { emptyString, hiddenString, loadingString, noDataString } from '../../helpers/stringHelper'
import { formatSwapTime } from '../../helpers/timeHelper'
import {
  filterWalletBalancesByAssets,
  getWalletBalanceByAssetAndWalletType,
  getWalletTypeLabel,
  hasLedgerInBalancesByAsset
} from '../../helpers/walletHelper'
import { useOpenExplorerTxUrl } from '../../hooks/useOpenExplorerTxUrl'
import { usePricePool } from '../../hooks/usePricePool'
import { usePricePoolMaya } from '../../hooks/usePricePoolMaya'
import { useSubscriptionState } from '../../hooks/useSubscriptionState'
import { INITIAL_SWAP_STATE } from '../../services/chain/const'
import { getZeroSwapFees } from '../../services/chain/fees/swap'
import { SwapTxParams, SwapFeesRD, SwapFees, FeeRD, SwapTxState, SendTxParams } from '../../services/chain/types'
import { ApproveParams, IsApprovedRD } from '../../services/evm/types'
import { getPoolDetail as getPoolDetailMaya } from '../../services/midgard/mayaMigard/utils'
import { PoolAddress } from '../../services/midgard/midgardTypes'
import { getPoolDetail } from '../../services/midgard/thorMidgard/utils'
import { userChains$ } from '../../services/storage/userChains'
import { addAsset } from '../../services/storage/userChainTokens'
import { TxHashRD, WalletBalance, WalletBalances, isStandaloneLedgerMode } from '../../services/wallet/types'
import { hasImportedKeystore, isLocked } from '../../services/wallet/util'
import { useAggregator } from '../../store/aggregator/hooks'
import { AssetWithAmount } from '../../types/asgardex'
import { LedgerConfirmationModal, WalletPasswordConfirmationModal } from '../modal/confirmation'
import { ProviderModal } from '../modal/provider'
import { SwapAssets } from '../modal/tx/extra'
import { AssetInput } from '../uielements/assets/assetInput'
import { BaseButton, FlatButton } from '../uielements/button'
import { Collapse } from '../uielements/collapse'
import { WalletTypeLabel } from '../uielements/common/Common.styles'
import { Fees, UIFeesRD } from '../uielements/fees'
import { InfoIcon } from '../uielements/info'
import { CopyLabel } from '../uielements/label/CopyLabel'
import { Slider } from '../uielements/slider'
import { Spin } from '../uielements/spin'
import { Tooltip } from '../uielements/tooltip'
import { EditableAddress } from './EditableAddress'
import { SelectableSlipTolerance } from './SelectableSlipTolerance'
import { ModalState, RateDirection, SwapProps } from './Swap.types'
import * as Utils from './Swap.utils'
import SwapExpiryProgressBar from './SwapExpiryProgressBar'
import { SwapRoute } from './SwapRoute'
import { SwapTxModal } from './SwapTxModal'

const ErrorLabel = ({ children, className }: { children: React.ReactNode; className?: string }): JSX.Element => (
  <div
    className={clsx('mb-[14px] text-center font-main text-[12px] uppercase text-error0 dark:text-error0d', className)}>
    {children}
  </div>
)

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
  midgardStatusRD,
  midgardStatusMayaRD
}: SwapProps) => {
  const { estimateSwap } = useAggregator()
  const intl = useIntl()
  const { appWalletService } = useWalletContext()

  // Get app wallet state to check for standalone ledger mode
  const appWalletState = useObservableState(appWalletService.appWalletState$)
  const standaloneLedgerState = useObservableState(appWalletService.standaloneLedgerService.standaloneLedgerState$)

  // State for dynamically fetched target address in standalone ledger mode
  const [standaloneLedgerTargetAddress, setStandaloneLedgerTargetAddress] = useState<O.Option<Address>>(O.none)
  const [isFetchingStandaloneLedgerAddress, setIsFetchingStandaloneLedgerAddress] = useState(false)

  // State for target address derivation path parameters
  const [targetHDMode, setTargetHDMode] = useState<HDMode>('default')
  const [targetWalletAccount, setTargetWalletAccount] = useState<number>(0)
  const [targetWalletIndex, setTargetWalletIndex] = useState<number>(0)

  const { chain: sourceChain } =
    sourceAsset.type === AssetType.SYNTH
      ? AssetCacao
      : sourceAsset.type === AssetType.SECURED
      ? AssetRuneNative
      : sourceAsset
  const { chain: targetChain } =
    targetAsset.type === AssetType.SYNTH
      ? AssetCacao
      : sourceAsset.type === AssetType.SECURED
      ? AssetRuneNative
      : targetAsset

  const lockedWallet: boolean = useMemo(() => {
    // In standalone ledger mode, bypass keystore authentication
    if (appWalletState && isStandaloneLedgerMode(appWalletState)) {
      return false
    }

    // Normal keystore authentication logic
    return isLocked(keystore) || !hasImportedKeystore(keystore)
  }, [keystore, appWalletState])

  // Function to fetch target address for standalone ledger mode
  const fetchStandaloneLedgerTargetAddress = useCallback(
    async (chain: Chain) => {
      if (appWalletState && isStandaloneLedgerMode(appWalletState)) {
        setIsFetchingStandaloneLedgerAddress(true)

        try {
          // Get the target chain address without changing global state using user-selected parameters
          const addressResult = await appWalletService.standaloneLedgerService
            .getAddressWithoutStateChange(chain, targetHDMode, targetWalletAccount, targetWalletIndex)
            .pipe()
            .toPromise()

          // Handle RemoteData result
          if (RD.isSuccess(addressResult)) {
            const walletAddress = addressResult.value
            setStandaloneLedgerTargetAddress(O.some(walletAddress.address))
          } else {
            setStandaloneLedgerTargetAddress(O.none)
          }
        } catch (error) {
          setStandaloneLedgerTargetAddress(O.none)
        } finally {
          setIsFetchingStandaloneLedgerAddress(false)
        }
      }
    },
    [appWalletState, appWalletService, targetHDMode, targetWalletAccount, targetWalletIndex]
  )

  const [quoteOnly, setQuoteOnly] = useState<boolean>(false)
  const [isFetchingEstimate, setIsFetchingEstimate] = useState(false)

  // Set default HD mode based on target chain
  useEffect(() => {
    if (targetAsset.chain === 'BTC') {
      setTargetHDMode('p2wpkh') // Default to Native SegWit for Bitcoin
    } else if (['LTC', 'BCH', 'DASH', 'DOGE'].includes(targetAsset.chain)) {
      setTargetHDMode('default') // Default HD mode for other UTXO chains
    } else if (['ETH', 'BSC', 'AVAX', 'ARB', 'BASE'].includes(targetAsset.chain)) {
      setTargetHDMode('ledgerlive') // Default to Ledger Live for EVM chains
    } else {
      setTargetHDMode('default')
    }
  }, [targetAsset.chain])

  const { isAssetSupported$ } = useChainflipContext()

  const useSourceAssetLedger = useMemo(() => {
    // In standalone ledger mode, always use ledger for source asset
    if (appWalletState && isStandaloneLedgerMode(appWalletState)) {
      return true
    }
    // Otherwise, check the initial wallet type
    const useLedger = isLedgerWallet(initialSourceWalletType)
    return useLedger
  }, [appWalletState, initialSourceWalletType])
  const prevChainFees = useRef<O.Option<SwapFees>>(O.none)

  const oSourceWalletAddress = useSourceAssetLedger ? oSourceLedgerAddress : oInitialSourceKeystoreAddress

  // Auto-select chain for standalone ledger
  useEffect(() => {
    // Auto-select the source asset's chain in standalone ledger mode (only if state is available)
    if (appWalletState && isStandaloneLedgerMode(appWalletState)) {
      const sourceChain = sourceAsset.chain
      const isChainConnected = appWalletState.connectedChain === sourceChain

      if (isChainConnected && appWalletState.connectedChain !== sourceChain) {
        // Use ref to avoid dependency loop
        appWalletService.standaloneLedgerService.setSelectedChain(sourceChain)
      }
    }
  }, [
    useSourceAssetLedger,
    oSourceLedgerAddress,
    oInitialSourceKeystoreAddress,
    oSourceWalletAddress,
    sourceAsset.chain,
    appWalletState,
    appWalletService.standaloneLedgerService
  ])

  const useTargetAssetLedger = FP.pipe(
    oInitialTargetWalletType,
    O.map(isLedgerWallet),
    O.getOrElse(() => false)
  )

  const pricePoolThor = usePricePool()
  const pricePoolMaya = usePricePoolMaya()

  const [oQuoteProcotols, setQuoteProtocols] = useState<O.Option<QuoteSwap[]>>(O.none)
  const [oQuoteProtocol, setQuoteProtocol] = useState<O.Option<QuoteSwap>>(O.none)
  const [oErrorProtocol, setErrorProtocol] = useState<O.Option<Error>>(O.none)

  // Default Streaming interval set to 1 blocks
  const [streamingInterval, setStreamingInterval] = useState<number>(1)
  // Default Streaming quantity set to 0, network computes the optimum
  const [streamingQuantity, setStreamingQuantity] = useState<number>(0)
  // Slide use state
  const [slider, setSlider] = useState(26)

  const [oTargetWalletType, setTargetWalletType] = useState<O.Option<WalletType>>(oInitialTargetWalletType)

  const [isStreaming, setIsStreaming] = useState<boolean>(true)
  const openExplorer = useOpenExplorerTxUrl(
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

  // Update state needed - initial target walletAddress is loaded async and can be different at first run
  useEffect(() => {
    setTargetWalletType(oInitialTargetWalletType)
  }, [oInitialTargetWalletType])

  // Reset target address for standalone ledger mode when target asset changes
  // Note: We don't auto-fetch here anymore to avoid loops - user must manually fetch
  const prevTargetChainRef = useRef<Chain | undefined>()
  useEffect(() => {
    if (appWalletState && isStandaloneLedgerMode(appWalletState)) {
      // Only reset if the target chain actually changed (not just a re-render)
      if (prevTargetChainRef.current && prevTargetChainRef.current !== targetChain) {
        setStandaloneLedgerTargetAddress(O.none)
      }
      prevTargetChainRef.current = targetChain
    }
  }, [appWalletState, targetChain])

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

  const sourceWalletAddress = useMemo(() => {
    return FP.pipe(
      oSourceWalletAddress,
      O.fold(
        () => '', // Fallback
        (sourceAddress) => sourceAddress // Return t
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
        // filter wallet balances to include assets available to swap only including synth balances
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
    const result = getWalletBalanceByAssetAndWalletType({
      oWalletBalances,
      asset: sourceAsset,
      walletType: sourceWalletType
    })

    return result
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
      isChainOfThor(sourceChain)
        ? PoolHelpers.getUSDValue({
            balance: { asset: sourceAsset, amount: amountToSwapMax1e8 },
            poolDetails: poolDetailsThor,
            pricePool: pricePoolThor
          })
        : FP.pipe(
            PoolHelpersMaya.getUSDValue({
              balance: { asset: sourceAsset, amount: amountToSwapMax1e8 },
              poolDetails: poolDetailsMaya,
              pricePool: pricePoolMaya
            })
          ),
      O.getOrElse(() => baseAmount(0, amountToSwapMax1e8.decimal))
    )
    return new CryptoAmount(result, pricePoolThor.asset)
  }, [amountToSwapMax1e8, poolDetailsMaya, poolDetailsThor, pricePoolMaya, pricePoolThor, sourceAsset, sourceChain])

  const isZeroAmountToSwap = useMemo(() => amountToSwapMax1e8.amount().isZero(), [amountToSwapMax1e8])

  const zeroSwapFees = useMemo(() => {
    return getZeroSwapFees({ inAsset: sourceAsset, outAsset: targetAsset })
  }, [sourceAsset, targetAsset])

  // Compute effective recipient address: use standalone ledger address when available, otherwise use provided recipient address
  const effectiveRecipientAddress: O.Option<Address> = useMemo(() => {
    if (appWalletState && isStandaloneLedgerMode(appWalletState)) {
      // In standalone ledger mode, use the fetched target address
      return standaloneLedgerTargetAddress
    }
    // In normal mode, use the provided recipient address
    return oRecipientAddress
  }, [appWalletState, standaloneLedgerTargetAddress, oRecipientAddress])

  // Helper to get effective recipient address as string (single source of truth)
  const effectiveRecipientAddressString = useMemo(
    () =>
      FP.pipe(
        effectiveRecipientAddress,
        O.fold(
          () => '', // Fallback
          (address) => address
        )
      ),
    [effectiveRecipientAddress]
  )

  // Auto-switch from "Preview Only" to "Preview & Swap" when recipient address is available
  useEffect(() => {
    if (quoteOnly && O.isSome(effectiveRecipientAddress)) {
      setQuoteOnly(false)
    }
  }, [effectiveRecipientAddress, quoteOnly])

  // PlaceHolder memo just to calc fees better
  const swapMemo = useMemo(() => {
    return O.fold(
      () => '',
      (recipientAddress: string) => {
        const toleranceBps = slipTolerance * 100
        const affiliateName = getAsgardexThorname(network)
        const affiliateBps = getAsgardexAffiliateFee(network)

        return getSwapMemo({
          targetAsset,
          targetAddress: recipientAddress,
          toleranceBps,
          streamingInterval,
          streamingQuantity,
          affiliateName: affiliateName,
          affiliateBps: affiliateName ? affiliateBps ?? 0 : undefined
        })
      }
    )(effectiveRecipientAddress)
  }, [effectiveRecipientAddress, slipTolerance, network, targetAsset, streamingInterval, streamingQuantity])

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
    // Use precise fee amount instead of arbitrary 1000-unit rounding
    return Utils.maxAmountToSwapMax1e8({
      asset: sourceAsset,
      balanceAmountMax1e8: sourceAssetAmountMax1e8,
      feeAmount: swapFees.inFee.amount
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
    const usdValueOption = isChainOfThor(assetAmount.asset.chain)
      ? PoolHelpers.getUSDValue({
          balance: { asset: assetAmount.asset, amount: assetAmount.baseAmount },
          poolDetails: poolDetailsThor,
          pricePool: pricePoolThor
        })
      : PoolHelpersMaya.getUSDValue({
          balance: { asset: assetAmount.asset, amount: assetAmount.baseAmount },
          poolDetails: poolDetailsMaya,
          pricePool: pricePoolMaya
        })

    return FP.pipe(
      usdValueOption,
      O.map((result) => new CryptoAmount(result, pricePoolThor.asset))
    )
  }, [poolDetailsMaya, poolDetailsThor, pricePoolMaya, pricePoolThor, swapFees.inFee.amount, swapFees.inFee.asset])

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
      O.map(({ assetAmount, asset }) => {
        if (eqAsset.equals(feeAsset, asset)) {
          return emptyString
        }

        // Use more decimals for very small USD amounts to avoid showing $0.00
        const isVerySmallUSDAmount = isUSDAsset(asset) && assetAmount.amount().lt(0.01)
        const decimalPlaces = isUSDAsset(asset) ? (isVerySmallUSDAmount ? 6 : 2) : 6

        return formatAssetAmountCurrency({
          amount: assetAmount,
          asset: asset,
          decimal: decimalPlaces,
          trimZeros: !isUSDAsset(asset) || isVerySmallUSDAmount
        })
      }),
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
            swapFees.outFee.asset.type === AssetType.SYNTH
              ? AssetCacao
              : swapFees.outFee.asset.type === AssetType.SECURED
              ? AssetRuneNative
              : swapFees.outFee.asset
          ),
        (txDetails) => {
          const txOutFee = txDetails.fees.outboundFee
          return txOutFee
        }
      )
    )
    return swapOutFee
  }, [oQuoteProtocol, swapFees.outFee.amount, swapFees.outFee.asset])
  const [outFeePriceValue, setOutFeePriceValue] = useState<CryptoAmount>(
    new CryptoAmount(swapFees.outFee.amount, targetAsset)
  )

  // useEffect to fetch data from query
  useEffect(() => {
    // Ensure `oQuoteProtocol` is not None
    if (O.isNone(oQuoteProtocol)) {
      return
    }
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

      // Only update state if the value actually changes
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
    // Check if swapFees is defined
    if (!swapFees) {
      return loadingString // or noDataString, depending on how you want to handle this case
    }

    // Access the outFee from swapFees
    const {
      outFee: { amount, asset: feeAsset }
    } = swapFees
    const oValueInAsset = isChainOfThor(oSwapOutFee.asset.chain)
      ? PoolHelpers.getAssetAmountFromUSDValue({
          usdValue: outFeePriceValue.baseAmount,
          poolDetails: poolDetailsThor,
          asset: feeAsset,
          amount: amount,
          pricePool: pricePoolThor
        })
      : PoolHelpersMaya.getAssetAmountFromUSDValue({
          usdValue: outFeePriceValue.baseAmount,
          poolDetails: poolDetailsMaya,
          asset: feeAsset,
          amount: amount,
          pricePool: pricePoolMaya
        })
    const fee = O.isSome(oValueInAsset)
      ? formatAssetAmountCurrency({
          amount: baseToAsset(oValueInAsset.value),
          asset: feeAsset,
          decimal: isUSDAsset(feeAsset) ? 2 : 6,
          trimZeros: !isUSDAsset(feeAsset)
        })
      : formatAssetAmountCurrency({
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
  }, [
    swapFees,
    oSwapOutFee.asset.chain,
    outFeePriceValue,
    poolDetailsThor,
    pricePoolThor,
    poolDetailsMaya,
    pricePoolMaya
  ])

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
    // Ensure `oQuoteProtocol` is not None
    if (O.isNone(oQuoteProtocol)) {
      return
    }
    const affiliatePriceValue = isChainOfThor(affiliateFee.asset.chain)
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
    if (O.isSome(affiliatePriceValue)) {
      const maxCryptoAmount = new CryptoAmount(affiliatePriceValue.value, pricePoolThor.asset)
      setAffiliatePriceValue(maxCryptoAmount)
    }
  }, [affiliateFee, network, oQuoteProtocol, poolDetailsMaya, poolDetailsThor, pricePoolMaya, pricePoolThor])

  //Helper Affiliate function, swaps where tx is greater than affiliate aff is free
  // Apparently thornode bug is fixed.
  // https://gitlab.com/thorchain/thornode/-/commit/f96350ab3d5adda18c61d134caa98b6d5af2b006
  const applyBps = useMemo(() => {
    const txFeeCovered = priceAmountToSwapMax1e8.assetAmount.gt(ASGARDEX_AFFILIATE_FEE_MIN)
    return txFeeCovered
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

    return !applyBps ? `free` : price ? `${price} (${fee}) ${displayBps}` : fee
  }, [swapFees, affiliateFee.assetAmount, affiliateFee.asset, affiliatePriceValue, applyBps, network, sourceAsset])

  const {
    state: approveState,
    reset: resetApproveState,
    subscribe: subscribeApproveState
  } = useSubscriptionState<TxHashRD>(RD.initial)

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

  const fetchSwap = useCallback(
    async (amount: BaseAmount) => {
      if (amount.amount().isZero()) {
        setQuoteProtocol(O.none)
        setErrorProtocol(O.none)
        return
      }

      setQuoteProtocol(O.none)
      setIsFetchingEstimate(true)

      try {
        const result = await estimateSwap(
          {
            fromAsset: { ...sourceAsset, symbol: sourceAsset.symbol.toUpperCase() },
            destinationAsset: { ...targetAsset, symbol: targetAsset.symbol.toUpperCase() },
            amount: new CryptoAmount(convertBaseAmountDecimal(amount, sourceAssetDecimal), {
              ...sourceAsset,
              symbol: sourceAsset.symbol.toUpperCase()
            }),
            fromAddress: isSecuredAsset(sourceAsset) ? undefined : sourceWalletAddress,
            destinationAddress: quoteOnly ? undefined : effectiveRecipientAddressString,
            streamingInterval: isStreaming ? streamingInterval : 0,
            streamingQuantity: isStreaming ? streamingQuantity : 0,
            toleranceBps: slipTolerance * 100
          },
          applyBps
        )

        const sortAndSetDefaultQuote = (quotes: QuoteSwap[]) => {
          const sortedQuotes = quotes.sort((a, b) => {
            const amountA = parseFloat(a.expectedAmount.assetAmountFixedString())
            const amountB = parseFloat(b.expectedAmount.assetAmountFixedString())
            const timeA = a.totalSwapSeconds
            const timeB = b.totalSwapSeconds
            return amountA > amountB ? -1 : amountA < amountB ? 1 : timeA - timeB
          })
          setQuoteProtocols(O.some(sortedQuotes))
          if (sortedQuotes.length > 0) {
            setQuoteProtocol(O.some(sortedQuotes[0]))
            setErrorProtocol(O.none)
          } else {
            setQuoteProtocol(O.none)
            setErrorProtocol(O.some(new Error('No swap route found')))
          }
        }

        sortAndSetDefaultQuote(result)
      } catch (err) {
        console.error('Failed to fetch estimate:', err)
        setErrorProtocol(O.some(err as Error))
      }
      setIsFetchingEstimate(false)
    },
    [
      estimateSwap,
      sourceAsset,
      targetAsset,
      sourceAssetDecimal,
      sourceWalletAddress,
      effectiveRecipientAddressString,
      isStreaming,
      streamingInterval,
      streamingQuantity,
      slipTolerance,
      applyBps,
      quoteOnly
    ]
  )

  const debouncedFetchSwap = useMemo(
    () => debounce((amount: BaseAmount) => fetchSwap(amount), 500), // 500ms delay
    [fetchSwap]
  )

  useEffect(() => {
    debouncedFetchSwap(amountToSwapMax1e8)
    return () => {
      debouncedFetchSwap.cancel()
    }
  }, [amountToSwapMax1e8, debouncedFetchSwap])

  // Function to handle user selection
  const handleSelectQuote = (selectedQuote: QuoteSwap) => {
    setQuoteProtocol(O.some(selectedQuote))
  }

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

  // Swap result from Aggregator
  const swapResultAmountMax: CryptoAmount = useMemo(() => {
    const expectedAmount = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => new CryptoAmount(baseAmount(0), targetAsset),
        (txDetails) => {
          return txDetails.expectedAmount
        }
      )
    )
    return expectedAmount
  }, [oQuoteProtocol, targetAsset])

  // Aggregator api Fetch Error
  const aggregatorErrors: JSX.Element = useMemo(() => {
    const protocolErrors: string[] = FP.pipe(
      oErrorProtocol,
      O.fold(
        () => [],
        (error) => {
          // Check if this is a memo undefined error and we're in swap mode without a recipient address
          if (
            !quoteOnly &&
            O.isNone(effectiveRecipientAddress) &&
            (error.message.toLowerCase().includes('memo') || error.message.toLowerCase().includes('parsing'))
          ) {
            return ['Please enter a recipient address to proceed with the swap']
          }
          return [error.message]
        }
      )
    )

    if (protocolErrors.length === 0) {
      return <></>
    }

    return (
      <ErrorLabel>
        {protocolErrors.map((error, index) => (
          <div key={index}>{error}</div>
        ))}
      </ErrorLabel>
    )
  }, [oErrorProtocol, quoteOnly, effectiveRecipientAddress])

  /**
   * Price of swap result in max 1e8 // boolean to convert between streaming and regular swaps
   */
  const priceSwapResultAmountMax1e8: AssetWithAmount = useMemo(() => {
    const amount = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => baseAmount(0, THORCHAIN_DECIMAL), // Default value if no protocol
        (quoteProtocol) => {
          if (quoteProtocol.protocol === 'Thorchain') {
            // Use Thorchain pool details and price pool
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
            // Use Mayachain pool details and price pool
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
          }
          return baseAmount(0, THORCHAIN_DECIMAL)
        }
      )
    )

    return { asset: pricePoolThor.asset, amount }
  }, [
    oQuoteProtocol,
    pricePoolThor,
    swapResultAmountMax.asset,
    swapResultAmountMax.baseAmount,
    poolDetailsThor,
    poolDetailsMaya,
    pricePoolMaya
  ])

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

  const swapLimit1e8: O.Option<BaseAmount> = useMemo(() => {
    return FP.pipe(
      oQuoteProtocol,
      O.chain((txDetails) => {
        return swapResultAmountMax.baseAmount.gt(zeroTargetBaseAmountMax1e8)
          ? O.some(Utils.getSwapLimit1e8(txDetails.memo))
          : O.none
      })
    )
  }, [oQuoteProtocol, swapResultAmountMax.baseAmount, zeroTargetBaseAmountMax1e8])

  const oSwapParams: O.Option<SwapTxParams> = useMemo(() => {
    const oPoolAddress: O.Option<PoolAddress> = FP.pipe(
      oQuoteProtocol,
      O.chain((quoteSwap) => {
        // Handle different protocols
        switch (quoteSwap.protocol) {
          case 'Thorchain':
            return oPoolAddressThor
          case 'Mayachain':
            return oPoolAddressMaya
          case 'Chainflip':
            return O.none
          default:
            return O.none
        }
      })
    )

    const result = FP.pipe(
      sequenceTOption(oPoolAddress, oSourceAssetWB, oQuoteProtocol),
      O.map(([poolAddress, { walletType, walletAddress, walletAccount, walletIndex, hdMode }, quoteSwap]) => {
        let amountToSwap = convertBaseAmountDecimal(amountToSwapMax1e8, sourceAssetAmount.decimal)

        if (
          !isTokenAsset(sourceAsset) &&
          !isTradeAsset(sourceAsset) &&
          !isSynthAsset(sourceAsset) &&
          !isSecuredAsset(sourceAsset) &&
          !isTCYAsset(sourceAsset) &&
          !isRujiAsset(sourceAsset)
        ) {
          if (sourceChainAssetAmount.lt(amountToSwap.plus(swapFees.inFee.amount))) {
            amountToSwap = sourceChainAssetAmount.minus(swapFees.inFee.amount)
          }
        }

        // In standalone ledger mode, use the actual connected ledger's address info
        const finalWalletAddress =
          appWalletState && isStandaloneLedgerMode(appWalletState) && standaloneLedgerState?.address
            ? standaloneLedgerState.address.address
            : walletAddress
        const finalWalletAccount =
          appWalletState && isStandaloneLedgerMode(appWalletState) && standaloneLedgerState?.address
            ? standaloneLedgerState.address.walletAccount
            : walletAccount
        const finalWalletIndex =
          appWalletState && isStandaloneLedgerMode(appWalletState) && standaloneLedgerState?.address
            ? standaloneLedgerState.address.walletIndex
            : walletIndex
        const finalHDMode =
          appWalletState && isStandaloneLedgerMode(appWalletState) && standaloneLedgerState?.address
            ? standaloneLedgerState.address.hdMode
            : hdMode

        return {
          poolAddress,
          asset: sourceAsset,
          amount: amountToSwap,
          memo: updateMemo(quoteSwap.memo, network),
          walletType,
          sender: finalWalletAddress,
          walletAccount: finalWalletAccount,
          walletIndex: finalWalletIndex,
          hdMode: finalHDMode,
          protocol: poolAddress.protocol
        }
      })
    )

    return result
  }, [
    oPoolAddressThor,
    oPoolAddressMaya,
    oSourceAssetWB,
    oQuoteProtocol,
    amountToSwapMax1e8,
    sourceAssetAmount.decimal,
    sourceAsset,
    network,
    sourceChainAssetAmount,
    swapFees.inFee.amount,
    appWalletState,
    standaloneLedgerState?.address
  ])

  const oCFSwapParams: O.Option<SendTxParams> = useMemo(() => {
    return FP.pipe(
      sequenceTOption(oSourceAssetWB, oQuoteProtocol),
      O.map(([{ walletType, walletAddress, walletAccount, walletIndex, hdMode }, quoteSwap]) => {
        let amountToSwap = convertBaseAmountDecimal(amountToSwapMax1e8, sourceAssetAmount.decimal)

        if (
          !isTokenAsset(sourceAsset) &&
          !isTradeAsset(sourceAsset) &&
          !isSynthAsset(sourceAsset) &&
          !isSecuredAsset(sourceAsset)
        ) {
          if (sourceChainAssetAmount.lt(amountToSwap.plus(swapFees.inFee.amount))) {
            amountToSwap = sourceChainAssetAmount.minus(swapFees.inFee.amount)
          }
        }

        return {
          asset: sourceAsset,
          amount: amountToSwap,
          recipient: quoteSwap.toAddress,
          memo: quoteSwap.memo,
          walletType,
          sender: walletAddress,
          walletAccount,
          walletIndex,
          hdMode,
          protocol: quoteSwap.protocol
        }
      })
    )
  }, [
    oSourceAssetWB,
    oQuoteProtocol,
    amountToSwapMax1e8,
    sourceAssetAmount.decimal,
    sourceAsset,
    sourceChainAssetAmount,
    swapFees.inFee.amount
  ])
  // Check to see slippage greater than tolerance
  // This is handled by thornode
  const isCausedSlippage = useMemo(() => {
    const result = swapSlippage > slipTolerance
    return result
  }, [swapSlippage, slipTolerance])

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

  const needApprovement: O.Option<boolean> = useMemo(() => {
    return isEvmChainToken(sourceAsset) ? O.some(isEVMTokenAsset(sourceAsset as TokenAsset)) : O.none
  }, [sourceAsset])

  const oApproveParams: O.Option<ApproveParams> = useMemo(() => {
    const oRouterAddress: O.Option<Address> = FP.pipe(
      oQuoteProtocol,
      O.chain((protocol) => {
        // Match protocol to the correct router address
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

  // Trigger approval check after approval succeeds
  useEffect(() => {
    if (RD.isSuccess(approveState)) {
      FP.pipe(
        oApproveParams,
        O.map((params) => {
          prevApproveParams.current = O.some(params)
          checkApprovedStatus(params)
          return true
        })
      )
    }
  }, [approveState, oApproveParams, checkApprovedStatus])

  // Refetch quote when approval is confirmed
  useEffect(() => {
    if (RD.isSuccess(approveState) && RD.isSuccess(isApprovedState)) {
      debouncedFetchSwap(amountToSwapMax1e8)
      resetIsApprovedState()
      return () => {
        debouncedFetchSwap.cancel()
      }
    }
  }, [approveState, isApprovedState, amountToSwapMax1e8, debouncedFetchSwap, resetIsApprovedState])

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
        () => [], // No quote, no errors
        (quoteSwap) => quoteSwap.errors
      )
    )
    return !quoteOnly && errors.some((error) => error.includes('router has not been approved to spend this amount'))
  }, [oQuoteProtocol, quoteOnly])

  const reloadApproveFeesHandler = useCallback(() => {
    FP.pipe(oApproveParams, O.map(reloadApproveFee))
  }, [oApproveParams, reloadApproveFee])

  // Swap start time
  const [swapStartTime, setSwapStartTime] = useState<number>(0)

  const setSourceAsset = useCallback(
    async (asset: AnyAsset) => {
      resetIsApprovedState()
      await delay(100)
      setAmountToSwapMax1e8(initialAmountToSwapMax1e8)
      onChangeAsset({
        source: asset,
        // back to default 'keystore' type
        sourceWalletType: WalletType.Keystore,
        target: targetAsset,
        targetWalletType: oTargetWalletType,
        recipientAddress: effectiveRecipientAddress
      })
    },
    [
      initialAmountToSwapMax1e8,
      effectiveRecipientAddress,
      oTargetWalletType,
      onChangeAsset,
      resetIsApprovedState,
      setAmountToSwapMax1e8,
      targetAsset
    ]
  )

  const setTargetAsset = useCallback(
    async (asset: AnyAsset) => {
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
      resetIsApprovedState()
    },
    [onChangeAsset, resetIsApprovedState, sourceAsset, sourceWalletType]
  )
  const prevApproveParams = useRef<O.Option<ApproveParams>>(O.none)

  // whenever `oApproveParams` has been updated,
  // `approveFeeParamsUpdated` needs to be called to update `approveFeesRD`
  useEffect(() => {
    FP.pipe(
      oApproveParams,
      O.filter((params) => !eqOApproveParams.equals(O.some(params), prevApproveParams.current)),
      O.map((params) => {
        prevApproveParams.current = O.some(params)
        // Using setTimeout to delay the execution of subsequent actions
        setTimeout(() => {
          approveFeeParamsUpdated(params)
        }, 100) // Delay of 100 milliseconds

        return true
      })
    )
  }, [approveFeeParamsUpdated, oApproveParams])

  const minAmountError = useMemo(() => {
    const errors: string[] = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => [],
        (quoteSwap) => quoteSwap.errors
      )
    )

    const minAmountErrorMessage = errors.find((error) => error.includes('is less than recommended Min Amount:'))

    if (!minAmountErrorMessage) {
      return false
    }
    return true
  }, [oQuoteProtocol])

  const belowDustThreshold = useMemo(() => {
    const isBelowDustThreshold: boolean = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => false,
        (quoteSwap) => {
          return quoteSwap.dustThreshold.baseAmount.gte(
            convertBaseAmountDecimal(amountToSwapMax1e8, sourceAssetDecimal)
          )
        }
      )
    )
    return isBelowDustThreshold
  }, [amountToSwapMax1e8, oQuoteProtocol, sourceAssetDecimal])

  // // sets the locked asset amount to be the asset pool depth
  useEffect(() => {
    if (lockedWallet || quoteOnly) {
      setQuoteOnly(true)
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
        setLockedAssetAmount(new CryptoAmount(convertBaseAmountDecimal(amount, sourceAssetDecimal), sourceAsset))
      } else if (O.isSome(poolDetailThor)) {
        const detail = poolDetailThor.value
        let amount: BaseAmount
        if (isRuneNativeAsset(sourceAsset)) {
          amount = baseAmount(detail.runeDepth)
        } else {
          amount = baseAmount(detail.assetDepth)
        }
        setLockedAssetAmount(new CryptoAmount(convertBaseAmountDecimal(amount, sourceAssetDecimal), sourceAsset))
      } else {
        setLockedAssetAmount(new CryptoAmount(ONE_RUNE_BASE_AMOUNT, sourceAsset))
      }
    }
  }, [lockedWallet, poolDetailsMaya, poolDetailsThor, quoteOnly, sourceAsset, sourceAssetDecimal, targetAsset])

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
        // Remove unsupported tokens
        A.filter((asset) => {
          if (isTCSupportedAsset(targetAsset, poolDetailsThor) && isTCSupportedAsset(asset, poolDetailsThor))
            return true
          if (isMayaSupportedAsset(targetAsset, poolDetailsMaya) && isMayaSupportedAsset(asset, poolDetailsMaya))
            return true
          if (isAssetSupported$(asset)) {
            return true
          }
          return false
        }),
        // Merge duplications
        (assets) => unionAssets(assets)(assets)
      ),

    [allBalances, isAssetSupported$, poolDetailsMaya, poolDetailsThor, targetAsset]
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
        // Remove unsupported tokens
        A.filter((asset) => {
          if (isTCSupportedAsset(sourceAsset, poolDetailsThor) && isTCSupportedAsset(asset, poolDetailsThor))
            return true
          if (isMayaSupportedAsset(sourceAsset, poolDetailsMaya) && isMayaSupportedAsset(asset, poolDetailsMaya))
            return true
          if (isAssetSupported$(asset)) {
            return true
          }
          return false
        }),
        A.chain((asset) => {
          if (isRuneNativeAsset(asset) || isCacaoAsset(asset)) {
            // Keep native Rune or Cacao assets as is
            return [asset]
          }

          const assets: AnyAsset[] = [asset] // Start with base asset

          // Add SECURED asset for ThorChain if supported
          if (isTCSupportedAsset(asset, poolDetailsThor) && isTCSupportedAsset(sourceAsset, poolDetailsThor)) {
            assets.push({
              ...asset,
              type: AssetType.SECURED
            } as SecuredAsset)
          }

          // Add SYNTH asset for MAYAChain if supported
          if (isMayaSupportedAsset(asset, poolDetailsMaya) && isMayaSupportedAsset(sourceAsset, poolDetailsMaya)) {
            assets.push({
              ...asset,
              type: AssetType.SYNTH,
              synth: true
            } as SynthAsset)
          }

          return assets
        }),
        A.filter((asset) => !eqAsset.equals(asset, sourceAsset)),
        (assets) => unionAssets(assets)(assets)
      ),
    [isAssetSupported$, poolAssets, poolDetailsMaya, poolDetailsThor, sourceAsset]
  )

  const [showPasswordModal, setShowPasswordModal] = useState(ModalState.None)
  const [showLedgerModal, setShowLedgerModal] = useState(ModalState.None)

  const setAmountToSwapFromPercentValue = useCallback(
    (percents: number) => {
      const amountFromPercentage = maxAmountToSwapMax1e8.amount().multipliedBy(percents / 100)
      return setAmountToSwapMax1e8(baseAmount(amountFromPercentage, maxAmountToSwapMax1e8.decimal))
    },
    [maxAmountToSwapMax1e8, setAmountToSwapMax1e8]
  )

  // Function to reset the slider to default position
  const resetToDefault = () => {
    setStreamingInterval(1) // Default position
    setStreamingQuantity(0) // thornode | mayanode decides the swap quantity
    setSlider(26)
    setIsStreaming(true)
  }

  const quoteOnlyButton = () => {
    setQuoteOnly(!quoteOnly)
    setAmountToSwapMax1e8(initialAmountToSwapMax1e8)
    setQuoteProtocol(O.none)
  }

  const labelMin = useMemo(
    () => (slider <= 0 ? `Limit Swap` : slider < 50 ? 'Time Optimised' : `Price Optimised`),
    [slider]
  )

  // Streaming Interval slider
  const renderStreamerInterval = useMemo(() => {
    const calculateStreamingInterval = (slider: number) => {
      if (slider >= 75) return 3
      if (slider >= 50) return 2
      if (slider >= 25) return 1
      return 0
    }
    const streamingIntervalValue = calculateStreamingInterval(slider)
    const setInterval = (slider: number) => {
      setSlider(slider)
      setStreamingInterval(streamingIntervalValue)
      setStreamingQuantity(0)
      setIsStreaming(streamingIntervalValue !== 0)
    }

    return (
      <div>
        <Slider
          key={'Streamer Interval slider'}
          value={slider}
          onChange={setInterval}
          max={100}
          labels={[`${labelMin}`, `${streamingInterval}`]}
        />
      </div>
    )
  }, [labelMin, slider, streamingInterval])

  // Streaming Quantity slider
  const renderStreamerQuantity = useMemo(() => {
    const quantity = streamingQuantity
    const setQuantity = (quantity: number) => {
      setStreamingQuantity(quantity)
    }
    let quantityLabel: string[]
    if (streamingInterval === 0) {
      quantityLabel = [`Limit swap`]
    } else {
      quantityLabel = quantity === 0 ? [`Auto swap count`] : [`Sub swaps`, `${quantity}`]
    }
    return (
      <div>
        <Slider key={'Streamer Quantity slider'} value={quantity} onChange={setQuantity} labels={quantityLabel} />
      </div>
    )
  }, [streamingQuantity, streamingInterval])

  const renderSwapSettings = () => (
    <Collapse
      header={
        <div className="flex flex-row items-center justify-between">
          <span className="m-0 font-main text-[14px] text-text2 dark:text-text2d">
            {intl.formatMessage({ id: 'common.swap' })} {intl.formatMessage({ id: 'common.settings' })} ({labelMin})
          </span>
        </div>
      }>
      <div className="flex flex-col p-4">
        <div className="flex w-full flex-col space-y-4 px-2">
          <div>{renderStreamerInterval}</div>
          <div>{renderStreamerQuantity}</div>
        </div>
        <div className="flex justify-end">
          <Tooltip title={intl.formatMessage({ id: 'common.resetToDefault' })}>
            <BaseButton
              onClick={resetToDefault}
              className="rounded-full hover:shadow-full group-hover:rotate-180 dark:hover:shadow-fulld">
              <ArrowPathIcon className="ease h-[25px] w-[25px] text-turquoise" />
            </BaseButton>
          </Tooltip>
        </div>
      </div>
    </Collapse>
  )

  const submitSwapTx = useCallback(() => {
    FP.pipe(
      oSwapParams,
      O.map((swapParams) => {
        // subscribe to swap$
        // set start time
        setSwapStartTime(Date.now())
        subscribeSwapState(swap$(swapParams))

        return true
      })
    )
  }, [oSwapParams, subscribeSwapState, swap$])

  const submitCFTx = useCallback(() => {
    FP.pipe(
      oCFSwapParams,
      O.map((swapParams) => {
        setSwapStartTime(Date.now())
        subscribeSwapState(swapCF$(swapParams))
        return true
      })
    )
  }, [oCFSwapParams, subscribeSwapState, swapCF$])

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
      setShowLedgerModal(ModalState.Swap)
    } else {
      setShowPasswordModal(ModalState.Swap)
    }
  }, [setShowLedgerModal, useSourceAssetLedger])

  const extraTxModalContent = useMemo(() => {
    const { swapTx } = swapState
    // don't render TxModal in initial state
    if (RD.isInitial(swapTx)) return <></>

    const stepLabel = FP.pipe(
      swapTx,
      RD.fold(
        () => '',
        () => intl.formatMessage({ id: 'common.tx.sending' }),
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
  // assuming on a unsuccessful tx that the swap state should remain the same
  const onCloseTxModal = useCallback(() => {
    resetSwapState()
  }, [resetSwapState])

  const onFinishTxModal = useCallback(() => {
    resetSwapState()
    reloadBalances()
    setAmountToSwapMax1e8(initialAmountToSwapMax1e8)
    setQuoteProtocol(O.none)
    //Add asset to userAssets if true
    if (isEvmChainToken(targetAsset)) {
      addAsset(targetAsset as TokenAsset)
    }
  }, [resetSwapState, reloadBalances, setAmountToSwapMax1e8, initialAmountToSwapMax1e8, targetAsset])

  const renderPasswordConfirmationModal = useMemo(() => {
    const onSuccess = () => {
      if (showPasswordModal === ModalState.Swap && O.isSome(oSwapParams)) {
        submitSwapTx()
      } else if (showPasswordModal === ModalState.Swap && O.isSome(oCFSwapParams)) {
        submitCFTx()
      } else if (showPasswordModal === ModalState.Approve) {
        submitApproveTx()
      }

      setShowPasswordModal(ModalState.None)
    }
    const onClose = () => {
      setShowPasswordModal(ModalState.None)
    }
    const render = showPasswordModal === ModalState.Swap || showPasswordModal === ModalState.Approve
    return (
      render && (
        <WalletPasswordConfirmationModal
          onSuccess={onSuccess}
          onClose={onClose}
          validatePassword$={validatePassword$}
        />
      )
    )
  }, [oCFSwapParams, oSwapParams, showPasswordModal, submitApproveTx, submitCFTx, submitSwapTx, validatePassword$])

  const renderLedgerConfirmationModal = useMemo(() => {
    const visible = showLedgerModal === ModalState.Swap || showLedgerModal === ModalState.Approve

    const onClose = () => {
      setShowLedgerModal(ModalState.None)
    }

    const onSucceess = () => {
      if (showLedgerModal === ModalState.Swap) {
        submitSwapTx()
      }
      if (showLedgerModal === ModalState.Approve) {
        submitApproveTx()
      }
      setShowLedgerModal(ModalState.None)
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
      isEvmChainToken(sourceAsset)
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
    const swapErrors: string[] = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () => [],
        (quoteSwap) => quoteSwap.errors
      )
    )

    if (swapErrors.length === 0) {
      return <></>
    }

    return (
      <ErrorLabel>
        {swapErrors.map((error, index) => {
          // Check for specific error patterns
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

          // Default error display
          return <div key={index}>{error}</div>
        })}
        {belowDustThreshold && <>{`Amount to swap is Below DustThreshold`}</>}
      </ErrorLabel>
    )
  }, [belowDustThreshold, oQuoteProtocol, sourceAsset])

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

    return `${formatAssetAmountCurrency({
      asset: targetAsset,
      amount: baseToAsset(amountMax1e8),
      trimZeros: true
    })}`
  }, [swapLimit1e8, targetAsset, targetAssetDecimal])

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
      setShowLedgerModal(ModalState.Approve)
    } else {
      setShowPasswordModal(ModalState.Approve)
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

  const isApproved = useMemo(() => {
    // No approval needed if not an ERC20 token
    if (O.isNone(needApprovement)) return true
    // Approved if no approval error in quote AND no pending approval
    return !needsApproval || RD.isSuccess(approveState)
  }, [needApprovement, needsApproval, approveState])

  const priceApproveFee: CryptoAmount = useMemo(() => {
    const assetAmount = isApproved
      ? new CryptoAmount(approveFee, swapFees.inFee.asset)
      : new CryptoAmount(baseAmount(0), swapFees.inFee.asset)

    const result = FP.pipe(
      isChainOfThor(assetAmount.asset.chain)
        ? PoolHelpers.getUSDValue({
            balance: { asset: assetAmount.asset, amount: assetAmount.baseAmount },
            poolDetails: poolDetailsThor,
            pricePool: pricePoolThor
          })
        : FP.pipe(
            PoolHelpersMaya.getUSDValue({
              balance: { asset: assetAmount.asset, amount: assetAmount.baseAmount },
              poolDetails: poolDetailsMaya,
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
    poolDetailsThor,
    pricePoolThor,
    poolDetailsMaya,
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
      reloadFees({
        inAsset: sourceAsset,
        memo: swapMemo,
        outAsset: targetAsset
      })
      resetApproveState()
    }
    prevSourceAsset.current = O.some(sourceAsset)
    if (!eqOAsset.equals(prevTargetAsset.current, O.some(targetAsset))) {
      prevTargetAsset.current = O.some(targetAsset)
    }
  }, [reloadFees, resetApproveState, resetSwapState, sourceAsset, targetAsset, swapMemo])

  const onSwitchAssets = useCallback(async () => {
    // delay to avoid render issues while switching
    await delay(100)
    setAmountToSwapMax1e8(initialAmountToSwapMax1e8)
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
      (lockedWallet ||
        quoteOnly ||
        isZeroAmountToSwap ||
        walletBalancesLoading ||
        sourceChainFeeError ||
        RD.isPending(swapFeesRD) ||
        RD.isPending(approveState) ||
        isCausedSlippage ||
        swapResultAmountMax.baseAmount.lte(zeroTargetBaseAmountMax1e8) ||
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
      walletBalancesLoading,
      sourceChainFeeError,
      swapFeesRD,
      approveState,
      isCausedSlippage,
      swapResultAmountMax.baseAmount,
      zeroTargetBaseAmountMax1e8,
      effectiveRecipientAddress,
      canSwap,
      customAddressEditActive,
      isTargetChainDisabled,
      isSourceChainDisabled,
      belowDustThreshold
    ]
  )

  const disableSubmitApprove = useMemo(
    () => isApproveFeeError || walletBalancesLoading || O.isNone(oApproveParams) || RD.isPending(approveState),
    [isApproveFeeError, walletBalancesLoading, oApproveParams, approveState]
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
        recipientAddress: effectiveRecipientAddress
      })
    },
    [
      initialAmountToSwapMax1e8,
      effectiveRecipientAddress,
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
            className="!font-mainBold text-[14px] text-gray2 dark:text-gray2d"
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
  // Time of transaction from source chain and quote details
  const TransactionTime = () => {
    const transactionTime = FP.pipe(
      oQuoteProtocol,
      O.fold(
        () =>
          DefaultChainAttributes[targetAsset.chain].avgBlockTimeInSecs +
          DefaultChainAttributes[sourceChain].avgBlockTimeInSecs,
        (txDetails) =>
          txDetails.totalSwapSeconds
            ? txDetails.totalSwapSeconds
            : DefaultChainAttributes[targetAsset.chain].avgBlockTimeInSecs +
              DefaultChainAttributes[sourceChain].avgBlockTimeInSecs
      )
    )

    return (
      <>
        <div className={clsx('flex w-full justify-between font-mainBold text-[14px]', { 'pt-10px': showDetails })}>
          <div className="text-text2 dark:text-text2d">{intl.formatMessage({ id: 'common.time.title' })}</div>
          <div className="text-text2 dark:text-text2d">{formatSwapTime(transactionTime)}</div>
        </div>
        {showDetails && (
          <>
            <div className="flex w-full justify-between pl-10px text-[12px]">
              <div className="flex items-center text-text2 dark:text-text2d">
                {intl.formatMessage({ id: 'common.inbound.time' })}
              </div>
              <div className="text-text2 dark:text-text2d">
                {formatSwapTime(Number(DefaultChainAttributes[sourceChain].avgBlockTimeInSecs))}
              </div>
            </div>
            <div className="flex w-full justify-between pl-10px text-[12px]">
              <div className="flex items-center text-text2 dark:text-text2d">
                {intl.formatMessage(
                  { id: 'common.confirmation.time' },
                  {
                    chain:
                      targetAsset.type === AssetType.SYNTH
                        ? MAYAChain
                        : targetAsset.type === AssetType.SECURED
                        ? THORChain
                        : targetAsset.chain
                  }
                )}
              </div>
              <div className="text-text2 dark:text-text2d">
                {formatSwapTime(Number(DefaultChainAttributes[targetAsset.chain].avgBlockTimeInSecs))}
              </div>
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
        <div className="flex flex-wrap">
          <div className="mb-3 w-full flex items-center justify-between">
            <FlatButton
              className="rounded-full hover:shadow-full group-hover:rotate-180 dark:hover:shadow-fulld"
              size="small"
              color={quoteOnly ? 'warning' : 'primary'}
              onClick={quoteOnlyButton}>
              {quoteOnly ? 'Preview Only' : 'Preview & Swap'}
            </FlatButton>
            <ProviderModal midgardStatusRD={midgardStatusRD} midgardStatusMayaRD={midgardStatusMayaRD} />
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
          showError={minAmountError || belowDustThreshold}
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
          <div className="absolute -top-[32px] left-[calc(50%-30px)] flex flex-col justify-center">
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
          {isFetchingEstimate ? (
            <Spin
              className="min-h-24 border border-gray0 dark:border-gray0d rounded-lg"
              spinning={isFetchingEstimate}
              tip={intl.formatMessage({ id: 'common.loading' })}
            />
          ) : O.isNone(oQuoteProcotols) ? (
            <></>
          ) : (
            <SwapRoute
              targetAsset={targetAsset.ticker}
              quote={oQuoteProtocol}
              quotes={oQuoteProcotols}
              onSelectQuote={handleSelectQuote}
            />
          )}
          {FP.pipe(
            oQuoteProtocol,
            O.fold(
              () => renderSwapSettings(), // O.none: show settings
              (quoteSwap) =>
                quoteSwap.protocol === 'Chainflip' ? (
                  <></> // Chainflip: hide settings
                ) : (
                  renderSwapSettings() // Other protocols: show settings
                )
            )
          )}
          <Collapse
            header={
              <div className="flex flex-row items-center justify-between">
                <span className="m-0 font-main text-[14px] text-text2 dark:text-text2d">
                  {intl.formatMessage({ id: 'common.swap' })} {intl.formatMessage({ id: 'common.details' })}
                </span>
              </div>
            }>
            {!lockedWallet ? (
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
                      className="group !p-0 !font-mainBold !text-text2 dark:!text-text2d"
                      onClick={() =>
                        // toggle rate
                        setRateDirection((current) =>
                          current === RateDirection.Source ? RateDirection.Target : RateDirection.Source
                        )
                      }>
                      {intl.formatMessage({ id: 'common.rate' })}
                      <ArrowsRightLeftIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
                    </BaseButton>
                    <div className="text-text2 dark:text-text2d">{rateLabel}</div>
                  </div>
                  {/* fees */}
                  <div className="flex w-full items-center justify-between font-mainBold">
                    <BaseButton
                      disabled={RD.isPending(swapFeesRD) || RD.isInitial(swapFeesRD)}
                      className="group !p-0 !font-mainBold !text-text2 dark:!text-text2d"
                      onClick={reloadFeesHandler}>
                      {intl.formatMessage({ id: 'common.fees.estimated' })}
                      <ArrowPathIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
                    </BaseButton>
                    <div className="text-text2 dark:text-text2d">{priceSwapFeesLabel}</div>
                  </div>

                  {showDetails && (
                    <>
                      {O.isSome(needApprovement) && (
                        <div className="flex w-full justify-between pl-10px text-[12px] text-text2 dark:text-text2d">
                          <div>{intl.formatMessage({ id: 'common.approve' })}</div>
                          <div>{priceApproveFeeLabel}</div>
                        </div>
                      )}
                      <div className="flex w-full justify-between pl-10px text-[12px] text-text2 dark:text-text2d">
                        <div>{intl.formatMessage({ id: 'common.fee.inbound' })}</div>
                        <div>{priceSwapInFeeLabel}</div>
                      </div>
                      <div className="flex w-full justify-between pl-10px text-[12px] text-text2 dark:text-text2d">
                        <div>{intl.formatMessage({ id: 'common.fee.outbound' })}</div>
                        <div>{priceSwapOutFeeLabel}</div>
                      </div>
                      <div className="flex w-full justify-between pl-10px text-[12px] text-text2 dark:text-text2d">
                        <div>{intl.formatMessage({ id: 'common.fee.affiliate' })}</div>
                        <div className={clsx({ 'font-bold !text-turquoise': priceAffiliateFeeLabel === 'free' })}>
                          {priceAffiliateFeeLabel}
                        </div>
                      </div>
                    </>
                  )}
                  {/* Slippage */}
                  <>
                    <div
                      className={clsx(
                        'flex w-full justify-between font-mainBold text-[14px]',
                        { 'pt-10px': showDetails },
                        { 'text-error0 dark:text-error0d': isCausedSlippage }
                      )}>
                      <div className="text-text2 dark:text-text2d">{intl.formatMessage({ id: 'swap.slip.title' })}</div>
                      <div className="text-text2 dark:text-text2d">
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
                          <div className="flex items-center">
                            {intl.formatMessage({ id: 'swap.slip.tolerance' })}

                            <InfoIcon
                              className="ml-[3px] h-[15px] w-[15px] text-inherit"
                              tooltip={intl.formatMessage({ id: 'swap.slip.tolerance.info' })}
                            />
                          </div>
                          <div>
                            <SelectableSlipTolerance value={slipTolerance} onChange={changeSlipTolerance} />
                          </div>
                        </div>
                        <div className="flex w-full justify-between pl-10px text-[12px]">
                          <div className="flex items-center">
                            {intl.formatMessage({ id: 'swap.min.result.protected' })}
                            <InfoIcon
                              className="ml-[3px] h-[15px] w-[15px] text-inherit"
                              tooltip={intl.formatMessage({ id: 'swap.min.result.info' }, { tolerance: slipTolerance })}
                            />
                          </div>
                          <div>{swapMinResultLabel}</div>
                        </div>
                        <div className="flex w-full justify-between pl-10px text-[12px]">
                          <div className="flex items-center text-text2 dark:text-text2d">
                            {intl.formatMessage({ id: 'swap.streaming.interval' })}
                            <InfoIcon
                              className="ml-[3px] h-[15px] w-[15px] text-inherit"
                              tooltip={intl.formatMessage({ id: 'swap.streaming.interval.info' })}
                            />
                          </div>
                          <div className="text-text2 dark:text-text2d">{streamingInterval}</div>
                        </div>
                        <div className="flex w-full justify-between pl-10px text-[12px]">
                          <div className="flex items-center text-text2 dark:text-text2d">
                            {intl.formatMessage({ id: 'swap.streaming.quantity' })}
                            <InfoIcon
                              className="ml-[3px] h-[15px] w-[15px] text-inherit"
                              tooltip={intl.formatMessage({ id: 'swap.streaming.quantity.info' })}
                            />
                          </div>
                          <div className="text-text2 dark:text-text2d">{streamingQuantity}</div>
                        </div>
                      </>
                    )}
                  </>
                  {/* Swap Time Inbound / swap / Outbound */}
                  <TransactionTime />
                  {/* addresses */}
                  {showDetails && (
                    <>
                      <div className="w-full pt-10px font-mainBold text-[14px] text-text2 dark:text-text2d">
                        {intl.formatMessage({ id: 'common.addresses' })}
                      </div>
                      {/* sender address */}
                      <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                        <div className="text-text2 dark:text-text2d">{intl.formatMessage({ id: 'common.sender' })}</div>
                        <div className="truncate pl-20px text-[13px] normal-case leading-normal text-text2 dark:text-text2d">
                          {FP.pipe(
                            oSourceWalletAddress,
                            O.map((address) => {
                              const displayedAddress = hidePrivateData ? hiddenString : address

                              return (
                                <Tooltip size="big" title={displayedAddress} key="tooltip-sender-addr">
                                  {displayedAddress}
                                </Tooltip>
                              )
                            }),
                            O.getOrElse(() => <>{noDataString}</>)
                          )}
                        </div>
                      </div>
                      {/* recipient address */}
                      <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                        <div className="text-text2 dark:text-text2d">
                          {intl.formatMessage({ id: 'common.recipient' })}
                        </div>
                        <div className="truncate pl-20px text-[13px] normal-case leading-normal text-text2 dark:text-text2d">
                          {FP.pipe(
                            effectiveRecipientAddress,
                            O.map((address) => {
                              const displayedAddress = hidePrivateData ? hiddenString : address

                              return (
                                <Tooltip size="big" title={displayedAddress} key="tooltip-target-addr">
                                  {displayedAddress}
                                </Tooltip>
                              )
                            }),
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
                              <Tooltip size="big" title={address}>
                                <div className="truncate pl-20px text-[13px] normal-case leading-normal">{address}</div>
                              </Tooltip>
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
                      <div className="w-full pt-10px text-[14px]">
                        <BaseButton
                          disabled={walletBalancesLoading}
                          className="group !p-0 !font-mainBold !text-text2 dark:!text-text2d"
                          onClick={reloadBalances}>
                          {intl.formatMessage({ id: 'common.balances' })}
                          <ArrowPathIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
                        </BaseButton>
                      </div>
                      {/* sender balance */}
                      <div className="flex w-full items-center justify-between pl-10px text-[12px]">
                        <div className="text-text2 dark:text-text2d">{intl.formatMessage({ id: 'common.sender' })}</div>
                        <div className="truncate pl-20px text-[13px] normal-case leading-normal text-text2 dark:text-text2d">
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
                      <div className="ml-[-2px] flex w-full items-start pt-10px font-mainBold text-[14px] text-text2 dark:text-text2d">
                        {memoTitle}
                      </div>
                      <div className="truncate pl-10px font-main text-[12px] text-text2 dark:text-text2d">
                        {hidePrivateData ? hiddenString : memoLabel}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full px-4 pb-4 font-main text-[12px] uppercase dark:border-gray1d">
                <div className="font-main text-[14px] text-gray2 dark:text-gray2d">
                  {/* Rate */}
                  <div className="flex w-full justify-between font-mainBold text-[14px]">
                    <BaseButton
                      className="group !p-0 !font-mainBold !text-text2 dark:!text-text2d"
                      onClick={() =>
                        // toggle rate
                        setRateDirection((current) =>
                          current === RateDirection.Source ? RateDirection.Target : RateDirection.Source
                        )
                      }>
                      {intl.formatMessage({ id: 'common.rate' })}
                      <ArrowsRightLeftIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
                    </BaseButton>
                    <div className="text-text2 dark:text-text2d">{rateLabel}</div>
                  </div>
                  {/* fees */}
                  <div className="flex w-full items-center justify-between font-mainBold">
                    <BaseButton
                      disabled={RD.isPending(swapFeesRD) || RD.isInitial(swapFeesRD)}
                      className="group !p-0 !font-mainBold !text-text2 dark:!text-text2d"
                      onClick={reloadFeesHandler}>
                      {intl.formatMessage({ id: 'common.fees.estimated' })}
                      <ArrowPathIcon className="ease ml-5px h-[15px] w-[15px] group-hover:rotate-180" />
                    </BaseButton>
                    <div className="text-text2 dark:text-text2d">{priceSwapFeesLabel}</div>
                  </div>
                  <div className="flex w-full justify-between pl-10px text-[12px]">
                    <div className="text-text2 dark:text-text2d">
                      {intl.formatMessage({ id: 'common.fee.inbound' })}
                    </div>
                    <div className="text-text2 dark:text-text2d">{priceSwapInFeeLabel}</div>
                  </div>
                  <div className="flex w-full justify-between pl-10px text-[12px]">
                    <div className="text-text2 dark:text-text2d">{intl.formatMessage({ id: 'swap.slip.title' })}</div>
                    <div className="text-text2 dark:text-text2d">
                      {formatAssetAmountCurrency({
                        amount: priceAmountToSwapMax1e8.assetAmount.times(swapSlippage / 100), // Find the value of swap slippage
                        asset: priceAmountToSwapMax1e8.asset,
                        decimal: isUSDAsset(priceAmountToSwapMax1e8.asset) ? 2 : 6,
                        trimZeros: !isUSDAsset(priceAmountToSwapMax1e8.asset)
                      }) + ` (${swapSlippage.toFixed(2)}%)`}
                    </div>
                  </div>
                  <div className="flex w-full justify-between pl-10px text-[12px]">
                    <div className="text-text2 dark:text-text2d">
                      {intl.formatMessage({ id: 'common.fee.outbound' })}
                    </div>
                    <div className="text-text2 dark:text-text2d">{priceSwapOutFeeLabel}</div>
                  </div>
                  <div className="flex w-full justify-between pl-10px text-[12px]">
                    <div className="text-text2 dark:text-text2d">
                      {intl.formatMessage({ id: 'common.fee.affiliate' })}
                    </div>
                    <div className={clsx({ 'font-bold !text-turquoise': priceAffiliateFeeLabel === 'free' })}>
                      {priceAffiliateFeeLabel}
                    </div>
                  </div>

                  {/* Transaction time */}
                  <TransactionTime />
                </div>
              </div>
            )}
          </Collapse>
          {!lockedWallet &&
            (() => {
              // In standalone ledger mode, handle recipient address differently
              if (appWalletState && isStandaloneLedgerMode(appWalletState)) {
                return (
                  <div
                    className="flex flex-col rounded-lg border border-solid border-gray0 px-4 py-2 dark:border-gray0d"
                    key="standalone-recipient-address">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <h3 className="font-[12px] !mb-0 mr-10px w-auto p-0 font-main uppercase text-text2 dark:text-text2d">
                          {intl.formatMessage({ id: 'common.recipient' })}
                        </h3>
                        <WalletTypeLabel key="target-w-type">Ledger</WalletTypeLabel>
                      </div>
                      {/* Derivation path controls - only show when no address is fetched yet and not in manual entry mode */}
                      {FP.pipe(standaloneLedgerTargetAddress, O.isNone) && !customAddressEditActive && (
                        <div className="flex items-center gap-2">
                          {(['BTC', 'LTC', 'BCH', 'DASH', 'DOGE'].includes(targetAsset.chain) ||
                            ['ETH', 'BSC', 'AVAX', 'ARB', 'BASE'].includes(targetAsset.chain)) && (
                            <>
                              <div className="flex items-center gap-1">
                                <span className="text-10 uppercase text-gray2 dark:text-gray2d">Account</span>
                                <input
                                  type="number"
                                  value={targetWalletAccount.toString()}
                                  onChange={(e) => setTargetWalletAccount(Math.max(0, parseInt(e.target.value) || 0))}
                                  className="w-12 h-6 text-10 px-1 text-center bg-bg0 dark:bg-bg0d border border-gray1 dark:border-gray1d rounded"
                                  min="0"
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-10 uppercase text-gray2 dark:text-gray2d">Index</span>
                                <input
                                  type="number"
                                  value={targetWalletIndex.toString()}
                                  onChange={(e) => setTargetWalletIndex(Math.max(0, parseInt(e.target.value) || 0))}
                                  className="w-12 h-6 text-10 px-1 text-center bg-bg0 dark:bg-bg0d border border-gray1 dark:border-gray1d rounded"
                                  min="0"
                                />
                              </div>
                              {targetAsset.chain === 'BTC' && (
                                <select
                                  value={targetHDMode}
                                  onChange={(e) => setTargetHDMode(e.target.value as HDMode)}
                                  className="text-10 px-2 py-1 bg-bg0 dark:bg-bg0d border border-gray1 dark:border-gray1d rounded">
                                  <option value="p2wpkh">{intl.formatMessage({ id: 'common.nativeSegwit' })}</option>
                                  <option value="p2tr">{intl.formatMessage({ id: 'common.taproot' })}</option>
                                </select>
                              )}
                              {['LTC', 'BCH', 'DASH', 'DOGE'].includes(targetAsset.chain) && (
                                <select
                                  value={targetHDMode}
                                  onChange={(e) => setTargetHDMode(e.target.value as HDMode)}
                                  className="text-10 px-2 py-1 bg-bg0 dark:bg-bg0d border border-gray1 dark:border-gray1d rounded">
                                  <option value="default">Default</option>
                                </select>
                              )}
                              {['ETH', 'BSC', 'AVAX', 'ARB', 'BASE'].includes(targetAsset.chain) && (
                                <select
                                  value={targetHDMode}
                                  onChange={(e) => setTargetHDMode(e.target.value as HDMode)}
                                  className="text-10 px-2 py-1 bg-bg0 dark:bg-bg0d border border-gray1 dark:border-gray1d rounded">
                                  <option value="ledgerlive">Ledger Live</option>
                                  <option value="legacy">Legacy</option>
                                  <option value="metamask">MetaMask</option>
                                </select>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {/* Refresh from Ledger button - only show if address was fetched from Ledger */}
                      {FP.pipe(standaloneLedgerTargetAddress, O.isSome) && !customAddressEditActive && (
                        <BaseButton
                          size="small"
                          className="hover:shadow-full dark:hover:shadow-fulld"
                          loading={isFetchingStandaloneLedgerAddress}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Please make sure the ${targetAsset.chain} app is open on your Ledger device before proceeding.`
                              )
                            ) {
                              fetchStandaloneLedgerTargetAddress(targetAsset.chain)
                            }
                          }}>
                          Refresh from Ledger
                        </BaseButton>
                      )}
                    </div>

                    {/* Show current address if available, otherwise show options */}
                    {FP.pipe(
                      standaloneLedgerTargetAddress,
                      O.fold(
                        () => (
                          <div className="mt-3 space-y-3">
                            <div className="grid grid-cols-1 gap-3">
                              <button
                                className="group flex items-center justify-between p-4 border border-gray0 dark:border-gray0d rounded-lg hover:border-turquoise hover:bg-bg1 dark:hover:bg-bg1d transition-all duration-200"
                                disabled={isFetchingStandaloneLedgerAddress}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Please make sure the ${targetChain} app is open on your Ledger device before proceeding.`
                                    )
                                  ) {
                                    fetchStandaloneLedgerTargetAddress(targetChain)
                                  }
                                }}>
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 rounded-full bg-turquoise/10 flex items-center justify-center">
                                    <div className="w-4 h-4 bg-turquoise rounded-sm"></div>
                                  </div>
                                  <div className="text-left">
                                    <div className="font-medium text-text0 dark:text-text0d">
                                      {intl.formatMessage({ id: 'common.fetchFromLedger' })}
                                    </div>
                                    <div className="text-[12px] text-text2 dark:text-text2d">
                                      {intl.formatMessage({ id: 'wallet.ledger.fetchDescription' })}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-turquoise group-hover:translate-x-1 transition-transform duration-200">
                                  →
                                </div>
                              </button>

                              <button
                                className="group flex items-center justify-between p-4 border border-gray0 dark:border-gray0d rounded-lg hover:border-turquoise hover:bg-bg1 dark:hover:bg-bg1d transition-all duration-200"
                                onClick={() => {
                                  setStandaloneLedgerTargetAddress(O.none)
                                  setCustomAddressEditActive(true)
                                }}>
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 rounded-full bg-warning0/10 flex items-center justify-center">
                                    <div className="w-4 h-4 border-2 border-warning0 rounded-sm"></div>
                                  </div>
                                  <div className="text-left">
                                    <div className="font-medium text-text0 dark:text-text0d">Enter Manually</div>
                                    <div className="text-[12px] text-text2 dark:text-text2d">
                                      Type or paste the recipient address
                                    </div>
                                  </div>
                                </div>
                                <div className="text-turquoise group-hover:translate-x-1 transition-transform duration-200">
                                  →
                                </div>
                              </button>
                            </div>
                          </div>
                        ),
                        (address) => (
                          <div className="mt-2">
                            {customAddressEditActive ? (
                              <div className="space-y-2">
                                <div className="text-[14px] text-text2 dark:text-text2d">Enter recipient address:</div>
                                <div className="flex items-center space-x-2">
                                  <div className="flex-1">
                                    <EditableAddress
                                      key="manual-entry"
                                      asset={targetAsset}
                                      network={network}
                                      address=""
                                      startInEditMode={customAddressEditActive}
                                      onChangeAddress={(newAddress) => {
                                        if (newAddress.trim()) {
                                          setStandaloneLedgerTargetAddress(O.some(newAddress))
                                          onChangeRecipientAddress(newAddress)
                                        } else {
                                          setStandaloneLedgerTargetAddress(O.none)
                                        }
                                      }}
                                      onChangeEditableAddress={onChangeEditableRecipientAddress}
                                      onChangeEditableMode={(editModeActive) =>
                                        setCustomAddressEditActive(editModeActive)
                                      }
                                      addressValidator={addressValidator}
                                      hidePrivateData={hidePrivateData}
                                    />
                                  </div>
                                  {!customAddressEditActive && (
                                    <BaseButton
                                      size="small"
                                      className="!p-1"
                                      onClick={() => setStandaloneLedgerTargetAddress(O.none)}>
                                      <XCircleIcon className="ml-5px h-[30px] w-[30px] cursor-pointer text-gray2 dark:text-gray2d" />
                                    </BaseButton>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <div className="flex-1">
                                  <EditableAddress
                                    key={address}
                                    asset={targetAsset}
                                    network={network}
                                    address={address}
                                    onChangeAddress={(newAddress) => {
                                      setStandaloneLedgerTargetAddress(O.some(newAddress))
                                      onChangeRecipientAddress(newAddress)
                                    }}
                                    onChangeEditableAddress={onChangeEditableRecipientAddress}
                                    onChangeEditableMode={(editModeActive) =>
                                      setCustomAddressEditActive(editModeActive)
                                    }
                                    addressValidator={addressValidator}
                                    hidePrivateData={hidePrivateData}
                                  />
                                </div>
                                <BaseButton
                                  size="small"
                                  className="!p-1"
                                  onClick={() => setStandaloneLedgerTargetAddress(O.none)}>
                                  <XCircleIcon className="ml-5px h-[30px] w-[30px] cursor-pointer text-gray2 dark:text-gray2d" />
                                </BaseButton>
                              </div>
                            )}
                          </div>
                        )
                      )
                    )}
                  </div>
                )
              }

              // Normal keystore mode
              return FP.pipe(
                effectiveRecipientAddress,
                O.map((address) => (
                  <div
                    className="flex flex-col rounded-lg border border-solid border-gray0 px-4 py-2 dark:border-gray0d"
                    key="edit-address">
                    <div className="flex items-center">
                      <h3 className="font-[12px] !mb-0 mr-10px w-auto p-0 font-main uppercase text-text2 dark:text-text2d">
                        {intl.formatMessage({ id: 'common.recipient' })}
                      </h3>
                      <WalletTypeLabel key="target-w-type">
                        {getWalletTypeLabel(oTargetWalletType, intl)}
                      </WalletTypeLabel>
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
              )
            })()}
          {!lockedWallet && amountToSwapMax1e8.gt(0) && (
            <div>{<SwapExpiryProgressBar oQuoteProtocol={oQuoteProtocol} swapExpiry={swapExpiry} />}</div>
          )}
        </div>
      </div>

      {(walletBalancesLoading || isFetchingEstimate) && (
        <Spin
          className="w-full pt-10px"
          tip={
            isFetchingEstimate
              ? intl.formatMessage({ id: 'common.loading' })
              : walletBalancesLoading
              ? intl.formatMessage({ id: 'common.balance.loading' })
              : undefined
          }
        />
      )}
      <div className="flex flex-col items-center justify-center">
        {!lockedWallet ? (
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
                {aggregatorErrors}
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

                {!RD.isInitial(uiApproveFeesRD) && (
                  <Fees fees={uiApproveFeesRD} reloadFees={reloadApproveFeesHandler} />
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* Only show wallet messages in keystore mode - standalone ledger shouldn't reach here */}
            {!(appWalletState && isStandaloneLedgerMode(appWalletState)) && (
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
          </>
        )}
      </div>
      {renderPasswordConfirmationModal}
      {renderLedgerConfirmationModal}
      <SwapTxModal
        swapState={swapState}
        swapStartTime={swapStartTime}
        sourceChain={sourceChain}
        extraTxModalContent={extraTxModalContent}
        oQuoteProtocol={oQuoteProtocol}
        goToTransaction={openExplorer.openExplorerTxUrl}
        getExplorerTxUrl={openExplorer.getExplorerTxUrl}
        onCloseTxModal={onCloseTxModal}
        onFinishTxModal={onFinishTxModal}
      />
    </div>
  )
}
