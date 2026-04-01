import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import {
  AnyAsset,
  AssetType,
  assetToBase,
  assetAmount,
  assetToString,
  baseAmount,
  isTokenAsset
} from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState, useSubscription } from 'observable-hooks'

import { ASGARDEX_AFFILIATE_FEE_MIN } from '../../../../shared/const'
import { isVultisigWallet } from '../../../../shared/utils/guard'
import { WalletPasswordConfirmationModal } from '../../../components/modal/confirmation'
import { useSwapConfirmationModals } from '../../../components/swap/components/SwapConfirmationModals'
import { SwapTxModal } from '../../../components/swap/SwapTxModal'
import { DEFAULT_WALLET_TYPE } from '../../../const'
import { useAppContext } from '../../../contexts/AppContext'
import { useChainContext } from '../../../contexts/ChainContext'
import { useChainflipContext } from '../../../contexts/ChainflipContext'
import { useEvmContext } from '../../../contexts/EvmContext'
import { useMayachainContext } from '../../../contexts/MayachainContext'
import { useMidgardContext } from '../../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../../contexts/MidgardMayaContext'
import { usePriceLevelContext } from '../../../contexts/PriceLevelContext'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { isUSDAsset } from '../../../helpers/assetHelper'
import { addChainflipSwapToTrackerFromQuote } from '../../../helpers/chainflipTransactionTracker'
import { isEvmChainToken } from '../../../helpers/evmHelper'
import { eqAsset } from '../../../helpers/fp/eq'
import { addSwapToTracker } from '../../../helpers/transactionTracker'
import { useERC20Approval } from '../../../hooks/useERC20Approval'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { useStreamingParams } from '../../../hooks/useStreamingParams'
import { useSwapAddresses } from '../../../hooks/useSwapAddresses'
import { useSwapExecution } from '../../../hooks/useSwapExecution'
import { useSwapFees } from '../../../hooks/useSwapFees'
import { useSwapQuote } from '../../../hooks/useSwapQuote'
import { getDecimal } from '../../../services/chain/decimal'
import type { PoolDetails as PoolDetailsMaya } from '../../../services/midgard/mayaMidgard/types'
import { getPoolDetail as getPoolDetailMaya } from '../../../services/midgard/mayaMidgard/utils'
import { PoolsState, PoolDetails } from '../../../services/midgard/midgardTypes'
import { getPoolDetail } from '../../../services/midgard/thorMidgard/utils'
import type { PriceLevel } from '../../../services/priceLevel/types'
import { isStandaloneLedgerMode, isVultisigMode } from '../../../services/wallet/types'
import type { VaultType } from '../../../services/wallet/types'
import { hasImportedKeystore } from '../../../services/wallet/util'
import { TradingPanelBar, type TradeMode } from './TradingPanelBar'
import { TradingPanelOrderSection } from './TradingPanelOrderSection'
import { TradingPanelPriceLevels } from './TradingPanelPriceLevels'

export type TradingPanelHandle = {
  /** Called when the user clicks a price on the chart — creates a limit order at that price */
  addPriceLevelAtPrice: (price: number) => void
}

type Props = {
  poolAsset: AnyAsset
  network: Network
  tradeMode: TradeMode
  setTradeMode: (mode: TradeMode) => void
  handleRef?: React.MutableRefObject<TradingPanelHandle | null>
}

export const TradingPanel = ({ poolAsset, network, tradeMode, setTradeMode, handleRef }: Props) => {
  // ── Contexts ──────────────────────────────────────────────────────────
  const { streamingSlipTolerance$ } = useAppContext()
  const slipTolerance = useObservableState(streamingSlipTolerance$, 5)

  const {
    chainBalances$,
    keystoreService: { keystoreState$, validatePassword$ },
    appWalletService
  } = useWalletContext()
  const keystore = useObservableState(keystoreState$, O.none)
  const appWalletState = useObservableState(appWalletService.appWalletState$)
  // Wallet is present for keystore, ledger, or vultisig sessions
  const hasWallet =
    hasImportedKeystore(keystore) ||
    (!!appWalletState && isVultisigMode(appWalletState)) ||
    (!!appWalletState && isStandaloneLedgerMode(appWalletState))
  const chainBalances = useObservableState(chainBalances$, [])

  const { swap$, swapCF$, swapFees$ } = useChainContext()
  const { transactionTrackingService } = useThorchainContext()
  const { transactionTrackingService: mayaTransactionTrackingService } = useMayachainContext()
  const { transactionTrackingService: chainflipTransactionTrackingService } = useChainflipContext()

  const {
    service: {
      pools: { poolsState$, selectedPoolAddress$ },
      setSelectedPoolAsset
    }
  } = useMidgardContext()

  const {
    service: {
      pools: { selectedPoolAddress$: selectedPoolAddressMaya$, poolsState$: mayaPoolsState$ },
      setSelectedPoolAsset: setSelectedPoolAssetMaya
    }
  } = useMidgardMayaContext()

  const poolsRD = useObservableState(poolsState$, RD.pending)
  const mayaPoolsRD = useObservableState(mayaPoolsState$, RD.initial)

  const poolAddressThor = useObservableState(selectedPoolAddress$, O.none)
  const poolAddressMaya = useObservableState(selectedPoolAddressMaya$, O.none)

  // Price levels
  const priceLevelService = usePriceLevelContext()

  // ── Pool state ────────────────────────────────────────────────────────
  const poolDetailsThor: PoolDetails = useMemo(
    () =>
      FP.pipe(
        poolsRD,
        RD.fold(
          () => [],
          () => [],
          () => [],
          (state: PoolsState) => state.poolDetails
        )
      ),
    [poolsRD]
  )

  const poolDetailsMaya: PoolDetailsMaya = useMemo(
    () =>
      FP.pipe(
        mayaPoolsRD,
        RD.fold(
          () => [],
          () => [],
          () => [],
          (state) => (state as PoolsState).poolDetails ?? []
        )
      ),
    [mayaPoolsRD]
  )

  // ── Available assets & target ─────────────────────────────────────────
  const availableAssets = useMemo(
    () =>
      FP.pipe(
        poolsRD,
        RD.fold(
          () => [] as AnyAsset[],
          () => [] as AnyAsset[],
          () => [] as AnyAsset[],
          (state: PoolsState) => {
            const filtered = state.poolAssets.filter((a) => !eqAsset.equals(a, poolAsset))
            const stablecoins = filtered.filter(isUSDAsset).sort((a, b) => a.ticker.localeCompare(b.ticker))
            const others = filtered.filter((a) => !isUSDAsset(a)).sort((a, b) => a.ticker.localeCompare(b.ticker))
            return [...stablecoins, ...others]
          }
        )
      ),
    [poolsRD, poolAsset]
  )

  const defaultTarget = useMemo(() => {
    const stable = availableAssets.find(isUSDAsset)
    return stable ?? availableAssets[0] ?? null
  }, [availableAssets])

  const [selectedTarget, setSelectedTarget] = useState<AnyAsset | null>(defaultTarget)
  useEffect(() => {
    setSelectedTarget((current) => {
      // Preserve user's selection if it's still in the pool list
      if (current) {
        const matched = availableAssets.find((asset) => eqAsset.equals(asset, current))
        if (matched) return matched
      }
      return defaultTarget
    })
  }, [availableAssets, defaultTarget])

  // ── Local state ───────────────────────────────────────────────────────
  const [amountStr, setAmountStr] = useState('')
  const [orderSectionOpen, setOrderSectionOpen] = useState(false)
  const [sourceDecimal, setSourceDecimal] = useState(8)

  // Derive source/target based on trade mode
  const sourceAsset = tradeMode === 'sell' ? poolAsset : selectedTarget
  const targetAsset = tradeMode === 'sell' ? selectedTarget : poolAsset

  // Resolve source chain (for EVM context)
  const sourceChain = useMemo(() => {
    if (!sourceAsset) return 'ETH'
    if (sourceAsset.type === AssetType.SYNTH) return AssetCacao.chain
    if (sourceAsset.type === AssetType.SECURED) return AssetRuneNative.chain
    return sourceAsset.chain
  }, [sourceAsset])

  // EVM context for approval
  const { approveERC20Token$, isApprovedERC20Token$ } = useEvmContext(sourceChain)

  // Source asset balance (what the user is spending — follows tradeMode)
  const assetBalance = useMemo(() => {
    if (!sourceAsset) return O.none
    for (const cb of chainBalances) {
      if (cb.chain !== sourceChain) continue
      if (!RD.isSuccess(cb.balances)) continue
      const found = cb.balances.value.find((b) => eqAsset.equals(b.asset, sourceAsset))
      if (found) return O.some(found.amount)
    }
    return O.none
  }, [chainBalances, sourceAsset, sourceChain])

  // Source wallet balance (WalletBalance object)
  const sourceWalletBalance = useMemo(() => {
    if (!sourceAsset) return O.none
    for (const cb of chainBalances) {
      if (cb.chain !== sourceChain) continue
      if (!RD.isSuccess(cb.balances)) continue
      const found = cb.balances.value.find((b) => eqAsset.equals(b.asset, sourceAsset))
      if (found) return O.some(found)
    }
    return O.none
  }, [chainBalances, sourceAsset, sourceChain])

  // Source chain native balance (for gas estimation)
  const sourceChainBalance = useMemo(() => {
    for (const cb of chainBalances) {
      if (cb.chain !== sourceChain) continue
      if (!RD.isSuccess(cb.balances)) continue
      // Find the native asset (not a token)
      const native = cb.balances.value.find((b) => !isTokenAsset(b.asset) && b.asset.chain === sourceChain)
      if (native) return native.amount
    }
    return baseAmount(0)
  }, [chainBalances, sourceChain])

  const sourceBalance = useMemo(
    () =>
      FP.pipe(
        sourceWalletBalance,
        O.map((wb) => wb.amount),
        O.getOrElse(() => baseAmount(0))
      ),
    [sourceWalletBalance]
  )

  // Resolve decimal for source asset (with stale guard for rapid changes)
  useEffect(() => {
    if (!sourceAsset) return
    let stale = false
    getDecimal(sourceAsset, poolDetailsThor).then((d) => {
      if (!stale) setSourceDecimal(d)
    })
    return () => {
      stale = true
    }
  }, [sourceAsset, poolDetailsThor])

  // Compute amount to swap
  const amountToSwap = useMemo(() => {
    const numAmount = parseFloat(amountStr)
    if (!numAmount || numAmount <= 0) return baseAmount(0, sourceDecimal)
    return assetToBase(assetAmount(numAmount, sourceDecimal))
  }, [amountStr, sourceDecimal])

  // ── Set pool address triggers ─────────────────────────────────────────
  useEffect(() => {
    if (!sourceAsset) return
    setSelectedPoolAsset(O.some(sourceAsset))
    setSelectedPoolAssetMaya(O.some(sourceAsset))
    return () => {
      setSelectedPoolAsset(O.none)
      setSelectedPoolAssetMaya(O.none)
    }
  }, [sourceAsset, setSelectedPoolAsset, setSelectedPoolAssetMaya])

  // ── Resolve source/dest addresses ─────────────────────────────────────
  // Get keystore addresses from chain balances
  const sourceKeystoreAddress = useMemo(() => {
    if (!sourceAsset) return O.none
    const cb = chainBalances.find((c) => c.chain === sourceChain)
    if (!cb) return O.none
    return cb.walletAddress
  }, [chainBalances, sourceAsset, sourceChain])

  const targetKeystoreAddress = useMemo(() => {
    if (!targetAsset) return O.none
    const targetChain =
      targetAsset.type === AssetType.SYNTH
        ? AssetCacao.chain
        : targetAsset.type === AssetType.SECURED
          ? AssetRuneNative.chain
          : targetAsset.chain
    const cb = chainBalances.find((c) => c.chain === targetChain)
    if (!cb) return O.none
    return cb.walletAddress
  }, [chainBalances, targetAsset])

  // ── Hook 1: Streaming params ──────────────────────────────────────────
  const {
    streamingInterval,
    streamingQuantity,
    isStreaming,
    activeMode,
    setMode: setStreamingMode,
    setQuantity: setStreamingQuantity,
    resetToDefault: resetStreaming
  } = useStreamingParams()

  // ── Hook 2: Swap addresses (simplified — no custom recipient, no standalone ledger target) ──
  // Stable refs to avoid re-render loops inside useSwapAddresses
  const oNone = useMemo(() => O.none, [])
  const oDefaultWalletType = useMemo(() => O.some(DEFAULT_WALLET_TYPE), [])
  const safeSourceAsset = sourceAsset ?? poolAsset
  const safeTargetAsset = targetAsset ?? poolAsset

  const {
    sourceAddress: oSourceWalletAddress,
    sourceWalletType,
    destinationAddress,
    destinationAddressString,
    useSourceLedger,
    useSourceVultisig,
    quoteOnly
  } = useSwapAddresses({
    sourceAsset: safeSourceAsset,
    targetAsset: safeTargetAsset,
    sourceKeystoreAddress,
    sourceLedgerAddress: oNone,
    targetKeystoreAddress,
    targetLedgerAddress: oNone,
    recipientAddress: targetKeystoreAddress,
    initialSourceWalletType: DEFAULT_WALLET_TYPE,
    initialTargetWalletType: oDefaultWalletType
  })

  // ── Hook 3: Swap fees ─────────────────────────────────────────────────
  const { swapFees, affiliateBps: rawAffiliateBps } = useSwapFees({
    sourceAsset: safeSourceAsset,
    targetAsset: safeTargetAsset,
    fees$: swapFees$,
    destinationAddress,
    slipTolerance,
    streaming: { interval: streamingInterval, quantity: streamingQuantity },
    network,
    sourceBalance,
    poolDetailsThor,
    poolDetailsMaya,
    lockedWallet: false,
    quoteOnly,
    lockedAssetAmount: baseAmount(0),
    amountToSwap
  })

  // Simple affiliate fee check: use pool's USD price directly.
  // If useSwapFees resolved it, use that. Otherwise compute from pool detail price.
  // This avoids the fragile PoolHelper chain that can return O.none forever.
  //
  // We derive a stable primitive ('none' | 'true' | 'false') to avoid re-render loops
  // caused by O.some() creating new object references.
  const affiliateBpsValue: 'none' | 'true' | 'false' = useMemo(() => {
    if (O.isSome(rawAffiliateBps)) return rawAffiliateBps.value ? 'true' : 'false'

    const numAmount = parseFloat(amountStr)
    if (!numAmount || numAmount <= 0) return 'none'

    // Try THORChain pool first, then MAYAChain pool
    const usdPrice = FP.pipe(
      getPoolDetail(poolDetailsThor, safeSourceAsset),
      O.alt(() => getPoolDetailMaya(poolDetailsMaya, safeSourceAsset)),
      O.chain((detail) => O.fromNullable(detail.assetPriceUSD)),
      O.map(Number),
      O.getOrElse(() => 0)
    )

    if (usdPrice === 0) return 'false'

    const swapUsdValue = numAmount * usdPrice
    return swapUsdValue >= ASGARDEX_AFFILIATE_FEE_MIN ? 'true' : 'false'
  }, [rawAffiliateBps, amountStr, poolDetailsThor, poolDetailsMaya, safeSourceAsset])

  // Stable Option reference — only changes when the primitive changes
  const affiliateBps: O.Option<boolean> = useMemo(
    () => (affiliateBpsValue === 'none' ? O.none : O.some(affiliateBpsValue === 'true')),
    [affiliateBpsValue]
  )

  // ── Hook 4: Swap quote ────────────────────────────────────────────────
  const { selectedQuote, quoteError, isFetching, fetchQuote, resetQuote } = useSwapQuote({
    sourceAsset: safeSourceAsset,
    targetAsset: safeTargetAsset,
    sourceAssetDecimal: sourceDecimal,
    sourceWalletAddress: FP.pipe(
      oSourceWalletAddress,
      O.getOrElse(() => '')
    ),
    destinationAddress: destinationAddressString,
    quoteOnly,
    streaming: { enabled: isStreaming, interval: streamingInterval, quantity: streamingQuantity },
    slipTolerance,
    affiliateBps
  })

  // ── Hook 5: Swap execution ────────────────────────────────────────────
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
    selectedQuote,
    sourceAsset: safeSourceAsset,
    amountToSwap,
    sourceWalletBalance,
    sourceChainBalance,
    swapFees,
    poolAddressThor,
    poolAddressMaya,
    network,
    isSendMax: false,
    streamingInterval,
    streamingQuantity
  })

  // ── Hook 6: ERC20 Approval ────────────────────────────────────────────
  const needsApproval = useMemo(() => (sourceAsset ? isEvmChainToken(sourceAsset) : false), [sourceAsset])

  const oApproveParams = useMemo(() => {
    if (!needsApproval || !sourceAsset) return O.none
    return FP.pipe(
      selectedQuote,
      O.chain((quote) => {
        const oPoolAddr = quote.protocol === 'Mayachain' ? poolAddressMaya : poolAddressThor
        return FP.pipe(
          oPoolAddr,
          O.chain((poolAddr) => {
            const spenderAddress = FP.pipe(
              poolAddr.router,
              O.getOrElse(() => poolAddr.address)
            )
            return O.some({
              network,
              contractAddress: sourceAsset.symbol.split('-')[1] ?? '',
              spenderAddress,
              fromAddress: FP.pipe(
                oSourceWalletAddress,
                O.getOrElse(() => '')
              ),
              walletType: sourceWalletType,
              walletAccount: 0,
              walletIndex: 0,
              hdMode: 'default' as const
            })
          })
        )
      })
    )
  }, [
    needsApproval,
    sourceAsset,
    selectedQuote,
    poolAddressThor,
    poolAddressMaya,
    network,
    oSourceWalletAddress,
    sourceWalletType
  ])

  const { isApprovedState, awaitingConfirmation, submitApproveTx, resetApproval } = useERC20Approval({
    isApprovedERC20Token$,
    approveERC20Token$,
    oApproveParams,
    network,
    onApprovalConfirmed: () => {
      // After approval confirmed, re-fetch quote
      if (amountToSwap.amount().gt(0)) {
        void fetchQuote(amountToSwap)
      }
    }
  })

  // ── Hook 7: Confirmation modals ───────────────────────────────────────
  const vaultType: VaultType = useMemo(() => {
    if (appWalletState && isVultisigMode(appWalletState) && appWalletState.activeVault) {
      return appWalletState.activeVault.type
    }
    return 'fast'
  }, [appWalletState])

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

  const getActiveVaultId = useCallback(() => appWalletService.getActiveVaultId(), [appWalletService])

  const { onSubmit, onApprove, renderModals } = useSwapConfirmationModals({
    useSourceAssetLedger: useSourceLedger,
    useSourceAssetVultisig: useSourceVultisig,
    sourceAsset: safeSourceAsset,
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
    approveState: RD.initial,
    swapState,
    getActiveVaultId
  })

  // ── Explorer URL for tx modal ─────────────────────────────────────────
  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(sourceChain))

  // ── Auto-fetch quote when order section is open and inputs change ───
  // Debounced: amount changes wait 600ms, other changes fire immediately.
  const quoteFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevAmountRef = useRef(amountStr)

  useEffect(() => {
    if (!orderSectionOpen) return
    if (affiliateBpsValue === 'none') return // fees not ready yet

    const doFetch = () => {
      const numAmount = parseFloat(amountStr)
      if (!numAmount || numAmount <= 0) return
      const amt = assetToBase(assetAmount(numAmount, sourceDecimal))
      void fetchQuote(amt)
    }

    // If only amount changed, debounce to avoid fetching on every keystroke
    const amountChanged = prevAmountRef.current !== amountStr
    prevAmountRef.current = amountStr

    if (quoteFetchTimerRef.current) clearTimeout(quoteFetchTimerRef.current)

    if (amountChanged) {
      quoteFetchTimerRef.current = setTimeout(doFetch, 600)
    } else {
      doFetch()
    }

    return () => {
      if (quoteFetchTimerRef.current) clearTimeout(quoteFetchTimerRef.current)
    }
    // Use affiliateBpsValue (primitive) instead of affiliateBps (object) to avoid re-render loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderSectionOpen, amountStr, tradeMode, selectedTarget, sourceDecimal, affiliateBpsValue])

  // ── Actions ───────────────────────────────────────────────────────────
  const handleTrade = useCallback(
    (mode: TradeMode) => {
      if (!hasWallet || !selectedTarget) return
      setTradeMode(mode)
      resetQuote()
      setOrderSectionOpen(true)
      // Quote fetch is handled by the useEffect above after re-render
    },
    [hasWallet, selectedTarget, setTradeMode, resetQuote]
  )

  const handleCloseOrderSection = useCallback(() => {
    setOrderSectionOpen(false)
    resetQuote()
  }, [resetQuote])

  const handleConfirm = useCallback(() => {
    onSubmit()
  }, [onSubmit])

  // ── Price levels (limit orders) ─────────────────────────────────────
  const assetKey = assetToString(poolAsset)

  // Track swap completion → update price level status if we were executing one
  const swapTxRD = swapState.swapTx
  useEffect(() => {
    if (!executingLevelRef.current) return
    const levelId = executingLevelRef.current

    if (RD.isSuccess(swapTxRD)) {
      const txHash = FP.pipe(
        RD.toOption(swapTxRD),
        O.getOrElse(() => '')
      )
      priceLevelService.updateLevel(assetKey, levelId, {
        status: 'completed',
        txHash: txHash || undefined
      })
      executingLevelRef.current = null
    } else if (RD.isFailure(swapTxRD)) {
      priceLevelService.updateLevel(assetKey, levelId, {
        status: 'failed',
        error: swapTxRD.error.msg ?? 'Swap failed'
      })
      executingLevelRef.current = null
    }
  }, [swapTxRD, priceLevelService, assetKey])

  // ── Track successful swap transactions ────────────────────────────────
  useEffect(() => {
    const { swapTx } = swapState
    if (!RD.isSuccess(swapTx)) return

    const txHash = swapTx.value
    if (lastTrackedTxHashRef.current === txHash) return

    FP.pipe(
      selectedQuote,
      O.map((quoteProtocol) => {
        if (quoteProtocol.protocol === 'Thorchain') {
          addSwapToTracker(transactionTrackingService, txHash, {
            sourceAsset: assetToString(safeSourceAsset),
            targetAsset: assetToString(safeTargetAsset),
            amount: amountToSwap.amount().toString()
          })
          lastTrackedTxHashRef.current = txHash
        } else if (quoteProtocol.protocol === 'Mayachain') {
          addSwapToTracker(mayaTransactionTrackingService, txHash, {
            sourceAsset: assetToString(safeSourceAsset),
            targetAsset: assetToString(safeTargetAsset),
            amount: amountToSwap.amount().toString()
          })
          lastTrackedTxHashRef.current = txHash
        } else if (quoteProtocol.protocol === 'Chainflip' && quoteProtocol.depositChannelId) {
          addChainflipSwapToTrackerFromQuote(chainflipTransactionTrackingService, quoteProtocol.depositChannelId, {
            srcAsset: { chain: safeSourceAsset.chain, symbol: safeSourceAsset.symbol },
            destAsset: { chain: safeTargetAsset.chain, symbol: safeTargetAsset.symbol },
            depositAmount: amountToSwap.amount().toString()
          })
          lastTrackedTxHashRef.current = txHash
        }
      })
    )
  }, [
    swapState,
    selectedQuote,
    transactionTrackingService,
    mayaTransactionTrackingService,
    chainflipTransactionTrackingService,
    safeSourceAsset,
    safeTargetAsset,
    amountToSwap,
    lastTrackedTxHashRef
  ])

  const onCloseTxModal = useCallback(() => {
    resetSwapState()
  }, [resetSwapState])

  const onFinishTxModal = useCallback(() => {
    resetSwapState()
    resetQuote()
    resetApproval()
    setAmountStr('')
    setOrderSectionOpen(false)
  }, [resetSwapState, resetQuote, resetApproval])
  const levelsMap = useObservableState(priceLevelService.levels$, {})
  const priceLevels: PriceLevel[] = levelsMap[assetKey] ?? []

  const handleRemoveLevel = useCallback(
    (levelId: string) => {
      priceLevelService.removeLevel(assetKey, levelId)
      orderPasswordCache.current.delete(levelId)
    },
    [priceLevelService, assetKey]
  )

  // ── Limit order password cache ──────────────────────────────────────
  // For keystore wallets: password is validated at order creation time and cached
  // in memory (per order ID). On crossing, we bypass the modal and submit directly.
  // For Ledger/Vultisig: the hardware prompt is unavoidable, so we fall back to onSubmit().
  const orderPasswordCache = useRef<Map<string, boolean>>(new Map())

  // Create a limit order with pre-authorization.
  // Keystore wallets: password modal shown at creation time, cached for auto-execution.
  // Hardware wallets: order created immediately, device prompt shown on trigger.
  const addPriceLevelWithAuth = useCallback(
    (price: number) => {
      if (!hasWallet || !selectedTarget) return
      const numAmount = parseFloat(amountStr)
      if (!numAmount || numAmount <= 0) return

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      const doCreateOrder = (preAuthorized: boolean) => {
        priceLevelService.addLevel(assetKey, {
          id,
          price,
          type: tradeMode,
          amount: numAmount,
          amountSymbol: poolAsset.ticker,
          targetAssetKey: assetToString(selectedTarget),
          status: 'pending'
        })
        if (preAuthorized) {
          orderPasswordCache.current.set(id, true)
        }
      }

      if (useSourceLedger || useSourceVultisig) {
        // Hardware wallets can't pre-authorize — create order, prompt on trigger
        doCreateOrder(false)
      } else {
        // Keystore: show password prompt, create order only on success
        setPendingOrderAction(() => doCreateOrder)
        setShowOrderPasswordModal(true)
      }
    },
    [
      hasWallet,
      selectedTarget,
      amountStr,
      tradeMode,
      poolAsset,
      assetKey,
      priceLevelService,
      useSourceLedger,
      useSourceVultisig
    ]
  )

  // Password modal state for limit order pre-authorization
  const [showOrderPasswordModal, setShowOrderPasswordModal] = useState(false)
  const [pendingOrderAction, setPendingOrderAction] = useState<((preAuth: boolean) => void) | null>(null)

  const handleOrderPasswordSuccess = useCallback(() => {
    setShowOrderPasswordModal(false)
    if (pendingOrderAction) {
      pendingOrderAction(true) // pre-authorized
      setPendingOrderAction(null)
    }
  }, [pendingOrderAction])

  const handleOrderPasswordClose = useCallback(() => {
    setShowOrderPasswordModal(false)
    setPendingOrderAction(null)
  }, [])

  // Expose handle to parent (PoolDetailView wires this to chart click)
  useEffect(() => {
    if (handleRef) {
      handleRef.current = { addPriceLevelAtPrice: addPriceLevelWithAuth }
    }
  }, [handleRef, addPriceLevelWithAuth])

  // Track which level is currently being executed (to prevent double-fire)
  const executingLevelRef = useRef<string | null>(null)
  // Flag: when true, auto-submit after the next successful quote fetch
  const autoSubmitPendingRef = useRef(false)

  // Subscribe to crossing events — restore trade state and flag for auto-execution.
  // Skip if already executing a level (queue is single-slot; next poll will re-trigger).
  useSubscription(priceLevelService.crossings$, (event) => {
    if (event.assetKey !== assetKey) return
    if (executingLevelRef.current) return

    const level = event.level
    if (level.amount <= 0 || !level.targetAssetKey) return

    executingLevelRef.current = event.levelId

    // Mark as executing
    priceLevelService.updateLevel(assetKey, event.levelId, { status: 'executing' })

    // Clear any stale quote before restoring trade state — prevents auto-submit
    // from firing with a previous manual trade's quote before the fresh one arrives
    resetQuote()

    // Restore the trade state from the limit order
    setAmountStr(String(level.amount))
    setTradeMode(level.type)

    const resolvedTarget = availableAssets.find((a) => assetToString(a) === level.targetAssetKey)
    if (resolvedTarget) {
      setSelectedTarget(resolvedTarget)
    }

    setOrderSectionOpen(true)
    autoSubmitPendingRef.current = true
  })

  // Auto-submit when a quote arrives and autoSubmitPending is set
  useEffect(() => {
    if (!autoSubmitPendingRef.current) return
    if (O.isNone(selectedQuote)) return
    if (isFetching) return

    // For ERC20 tokens: wait until approval is confirmed before submitting
    if (needsApproval && (!RD.isSuccess(isApprovedState) || isApprovedState.value === false)) {
      return
    }

    autoSubmitPendingRef.current = false

    if (!selectedQuote.value.canSwap) {
      if (executingLevelRef.current) {
        priceLevelService.updateLevel(assetKey, executingLevelRef.current, {
          status: 'failed',
          error: 'No valid swap route'
        })
        executingLevelRef.current = null
      }
      return
    }

    const levelId = executingLevelRef.current
    const isPreAuthorized = levelId ? orderPasswordCache.current.has(levelId) : false

    if (isPreAuthorized) {
      // Pre-authorized keystore order: bypass password modal, submit directly
      if (O.isSome(oSwapParams)) {
        submitSwapTx()
      } else if (O.isSome(oCFSwapParams)) {
        submitCFTx()
      }
      // Clean up cached auth
      if (levelId) orderPasswordCache.current.delete(levelId)
    } else {
      // Hardware wallet or non-pre-authorized: show confirmation modal
      onSubmit()
    }
  }, [
    selectedQuote,
    isFetching,
    needsApproval,
    isApprovedState,
    onSubmit,
    priceLevelService,
    assetKey,
    oSwapParams,
    oCFSwapParams,
    submitSwapTx,
    submitCFTx
  ])

  // Extra content for tx modal
  const swapTxSource = useMemo(
    () => ({ asset: safeSourceAsset, amount: amountToSwap }),
    [safeSourceAsset, amountToSwap]
  )
  const swapTxTarget = useMemo(
    () => ({ asset: targetAsset || safeSourceAsset, amount: baseAmount(0) }),
    [targetAsset, safeSourceAsset]
  )

  return (
    <>
      <TradingPanelBar
        sourceAsset={safeSourceAsset}
        sourceDecimal={sourceDecimal}
        network={network}
        hasWallet={hasWallet}
        tradeMode={tradeMode}
        assetBalance={assetBalance}
        amountStr={amountStr}
        setAmountStr={setAmountStr}
        selectedTarget={selectedTarget}
        setSelectedTarget={setSelectedTarget}
        availableAssets={availableAssets}
        onTrade={handleTrade}
      />

      <TradingPanelOrderSection
        visible={orderSectionOpen}
        tradeMode={tradeMode}
        targetAsset={targetAsset}
        amountStr={amountStr}
        selectedQuote={selectedQuote}
        quoteError={quoteError}
        isFetching={isFetching}
        activeMode={activeMode}
        streamingInterval={streamingInterval}
        streamingQuantity={streamingQuantity}
        onModeChange={setStreamingMode}
        onQuantityChange={setStreamingQuantity}
        onResetStreaming={resetStreaming}
        isApprovedState={isApprovedState}
        needsApproval={needsApproval}
        awaitingConfirmation={awaitingConfirmation}
        onApprove={onApprove}
        onConfirm={handleConfirm}
        onClose={handleCloseOrderSection}
      />

      <TradingPanelPriceLevels levels={priceLevels} onRemove={handleRemoveLevel} />

      {/* Wallet confirmation modals (password/ledger/vultisig) for manual swaps */}
      {renderModals}

      {/* Password modal for limit order pre-authorization */}
      {showOrderPasswordModal && (
        <WalletPasswordConfirmationModal
          onSuccess={handleOrderPasswordSuccess}
          onClose={handleOrderPasswordClose}
          validatePassword$={validatePassword$}
        />
      )}

      {/* Swap progress modal */}
      <SwapTxModal
        swapState={swapState}
        swapStartTime={swapStartTime}
        sourceChain={sourceChain}
        source={swapTxSource}
        target={swapTxTarget}
        oQuoteProtocol={selectedQuote}
        goToTransaction={openExplorerTxUrl}
        getExplorerTxUrl={getExplorerTxUrl}
        onCloseTxModal={onCloseTxModal}
        onFinishTxModal={onFinishTxModal}
      />
    </>
  )
}
