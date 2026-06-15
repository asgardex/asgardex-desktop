import { useCallback, useMemo, useRef, useState } from 'react'

import { ADAChain } from '@xchainjs/xchain-cardano'
import { Network } from '@xchainjs/xchain-client'
import { isTCYAsset } from '@xchainjs/xchain-thorchain'
import {
  AnyAsset,
  BaseAmount,
  baseAmount,
  isTokenAsset,
  isTradeAsset,
  isSynthAsset,
  isSecuredAsset
} from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import type { ExtendedQuoteSwap } from '../components/swap/Swap.types'
import { useWalletContext } from '../contexts/WalletContext'
import { isRujiAsset, isUtxoAssetChain } from '../helpers/assetHelper'
import { sequenceTOption } from '../helpers/fpHelpers'
import { applyStreamingToMemo, updateMemo } from '../helpers/memoHelper'
import { INITIAL_SWAP_STATE } from '../services/chain/const'
import { SwapTxParams, SwapTxState, SendTxParams, SwapHandler, SwapCFHandler, SwapFees } from '../services/chain/types'
import { PoolAddress } from '../services/midgard/midgardTypes'
import { WalletBalance, isStandaloneLedgerMode } from '../services/wallet/types'
import { useSubscriptionState } from './useSubscriptionState'

type UseSwapExecutionParams = {
  swap$: SwapHandler
  swapCF$: SwapCFHandler
  swapOneClick$: SwapCFHandler
  selectedQuote: O.Option<ExtendedQuoteSwap>
  sourceAsset: AnyAsset
  amountToSwap: BaseAmount
  sourceWalletBalance: O.Option<WalletBalance>
  sourceChainBalance: BaseAmount
  swapFees: SwapFees
  poolAddressThor: O.Option<PoolAddress>
  poolAddressMaya: O.Option<PoolAddress>
  network: Network
  isSendMax: boolean
  streamingInterval: number
  streamingQuantity: number
}

type UseSwapExecutionResult = {
  swapState: SwapTxState
  swapParams: O.Option<SwapTxParams>
  cfSwapParams: O.Option<SendTxParams>
  oneClickSwapParams: O.Option<SendTxParams>
  submitSwap: () => void
  submitCFSwap: () => void
  submitOneClickSwap: () => void
  resetSwapState: () => void
  subscribeSwapState: (s: import('rxjs').Observable<SwapTxState>) => void
  swapStartTime: number
  lastTrackedTxHashRef: React.MutableRefObject<string | null>
}

export const useSwapExecution = ({
  swap$,
  swapCF$,
  swapOneClick$,
  selectedQuote,
  sourceAsset,
  amountToSwap,
  sourceWalletBalance,
  sourceChainBalance,
  swapFees,
  poolAddressThor,
  poolAddressMaya,
  network,
  isSendMax,
  streamingInterval,
  streamingQuantity
}: UseSwapExecutionParams): UseSwapExecutionResult => {
  const { appWalletService } = useWalletContext()
  const appWalletState = useObservableState(appWalletService.appWalletState$)
  const standaloneLedgerState = useObservableState(appWalletService.standaloneLedgerService.standaloneLedgerState$)

  // Source chains that support MAX-sweep (transferMax): UTXO clients + Cardano (xchain-cardano>=1.2.0)
  const isSourceMaxSweep = useMemo(() => isUtxoAssetChain(sourceAsset) || sourceAsset.chain === ADAChain, [sourceAsset])

  const {
    state: swapState,
    reset: resetSwapState,
    subscribe: subscribeSwapState
  } = useSubscriptionState<SwapTxState>(INITIAL_SWAP_STATE)

  const [swapStartTime, setSwapStartTime] = useState<number>(0)
  const lastTrackedTxHashRef = useRef<string | null>(null)

  // Build swap params (THORChain / Maya)
  const swapParams: O.Option<SwapTxParams> = useMemo(() => {
    const oPoolAddress: O.Option<PoolAddress> = FP.pipe(
      selectedQuote,
      O.chain((quoteSwap) => {
        switch (quoteSwap.protocol) {
          case 'Thorchain':
            return poolAddressThor
          case 'Mayachain':
            return poolAddressMaya
          case 'Chainflip':
            return O.none
          default:
            return O.none
        }
      })
    )

    return FP.pipe(
      sequenceTOption(oPoolAddress, sourceWalletBalance, selectedQuote),
      O.map(([poolAddress, { walletType, walletAddress, walletAccount, walletIndex, hdMode }, quoteSwap]) => {
        let amountToSwapAdjusted = amountToSwap

        if (
          !isTokenAsset(sourceAsset) &&
          !isTradeAsset(sourceAsset) &&
          !isSynthAsset(sourceAsset) &&
          !isSecuredAsset(sourceAsset) &&
          !isTCYAsset(sourceAsset) &&
          !isRujiAsset(sourceAsset)
        ) {
          if (sourceChainBalance.lt(amountToSwapAdjusted.plus(swapFees.inFee.amount))) {
            const adjusted = sourceChainBalance.minus(swapFees.inFee.amount)
            amountToSwapAdjusted = adjusted.gt(baseAmount(0, adjusted.decimal))
              ? adjusted
              : baseAmount(0, adjusted.decimal)
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
          amount: amountToSwapAdjusted,
          memo: applyStreamingToMemo(updateMemo(quoteSwap.memo, network), streamingInterval, streamingQuantity),
          walletType,
          sender: finalWalletAddress,
          walletAccount: finalWalletAccount,
          walletIndex: finalWalletIndex,
          hdMode: finalHDMode,
          protocol: poolAddress.protocol,
          sendMax: isSourceMaxSweep ? isSendMax : undefined
        }
      })
    )
  }, [
    poolAddressThor,
    poolAddressMaya,
    sourceWalletBalance,
    selectedQuote,
    amountToSwap,
    sourceAsset,
    network,
    sourceChainBalance,
    swapFees.inFee.amount,
    appWalletState,
    standaloneLedgerState?.address,
    isSourceMaxSweep,
    isSendMax,
    streamingInterval,
    streamingQuantity
  ])

  // Build SendTxParams for the "vanilla transfer to a recipient" protocols (Chainflip, OneClick).
  // Filtered by protocol so the three param builders are mutually exclusive — callers can rely
  // on at most one being Some for a given selected quote.
  const buildSendSwapParams = (allowedProtocols: ReadonlyArray<string>): O.Option<SendTxParams> =>
    FP.pipe(
      sequenceTOption(sourceWalletBalance, selectedQuote),
      O.chain(([{ walletType, walletAddress, walletAccount, walletIndex, hdMode }, quoteSwap]) => {
        if (!allowedProtocols.includes(quoteSwap.protocol)) return O.none

        let amountToSwapAdjusted = amountToSwap

        if (
          !isTokenAsset(sourceAsset) &&
          !isTradeAsset(sourceAsset) &&
          !isSynthAsset(sourceAsset) &&
          !isSecuredAsset(sourceAsset)
        ) {
          if (sourceChainBalance.lt(amountToSwapAdjusted.plus(swapFees.inFee.amount))) {
            const adjusted = sourceChainBalance.minus(swapFees.inFee.amount)
            amountToSwapAdjusted = adjusted.gt(baseAmount(0, adjusted.decimal))
              ? adjusted
              : baseAmount(0, adjusted.decimal)
          }
        }

        // In standalone ledger mode, use connected ledger's address info (same as THOR/Maya path)
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

        return O.some({
          asset: sourceAsset,
          amount: amountToSwapAdjusted,
          recipient: quoteSwap.toAddress,
          memo: quoteSwap.memo,
          walletType,
          sender: finalWalletAddress,
          walletAccount: finalWalletAccount,
          walletIndex: finalWalletIndex,
          hdMode: finalHDMode,
          sendMax: isSourceMaxSweep ? isSendMax : undefined
        })
      })
    )

  // Build Chainflip swap params
  const cfSwapParams: O.Option<SendTxParams> = useMemo(
    () => buildSendSwapParams(['Chainflip']),
    // buildSendSwapParams is a closure over the values below; listing them keeps the memo correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sourceWalletBalance,
      selectedQuote,
      amountToSwap,
      sourceAsset,
      sourceChainBalance,
      swapFees.inFee.amount,
      appWalletState,
      standaloneLedgerState?.address,
      isSourceMaxSweep,
      isSendMax
    ]
  )

  // Build OneClick swap params — identical shape to Chainflip; recipient is 1Click's deposit address
  // and memo is empty (1Click doesn't use one — the deposit is identified by the address + post-tx
  // submitDeposit call made inside swapOneClick$).
  const oneClickSwapParams: O.Option<SendTxParams> = useMemo(
    () => buildSendSwapParams(['OneClick']),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sourceWalletBalance,
      selectedQuote,
      amountToSwap,
      sourceAsset,
      sourceChainBalance,
      swapFees.inFee.amount,
      appWalletState,
      standaloneLedgerState?.address,
      isSourceMaxSweep,
      isSendMax
    ]
  )

  const submitSwap = useCallback(() => {
    FP.pipe(
      swapParams,
      O.map((params) => {
        setSwapStartTime(Date.now())
        subscribeSwapState(swap$(params))
        return true
      })
    )
  }, [swapParams, subscribeSwapState, swap$])

  const submitCFSwap = useCallback(() => {
    FP.pipe(
      cfSwapParams,
      O.map((params) => {
        setSwapStartTime(Date.now())
        subscribeSwapState(swapCF$(params))
        return true
      })
    )
  }, [cfSwapParams, subscribeSwapState, swapCF$])

  const submitOneClickSwap = useCallback(() => {
    FP.pipe(
      oneClickSwapParams,
      O.map((params) => {
        setSwapStartTime(Date.now())
        subscribeSwapState(swapOneClick$(params))
        return true
      })
    )
  }, [oneClickSwapParams, subscribeSwapState, swapOneClick$])

  return {
    swapState,
    swapParams,
    cfSwapParams,
    oneClickSwapParams,
    submitSwap,
    submitCFSwap,
    submitOneClickSwap,
    resetSwapState,
    subscribeSwapState,
    swapStartTime,
    lastTrackedTxHashRef
  }
}
