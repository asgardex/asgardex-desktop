import { useCallback, useMemo, useRef, useState } from 'react'

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
import { updateMemo } from '../helpers/memoHelper'
import { INITIAL_SWAP_STATE } from '../services/chain/const'
import { SwapTxParams, SwapTxState, SendTxParams, SwapHandler, SwapCFHandler, SwapFees } from '../services/chain/types'
import { PoolAddress } from '../services/midgard/midgardTypes'
import { WalletBalance, isStandaloneLedgerMode } from '../services/wallet/types'
import { useSubscriptionState } from './useSubscriptionState'

type UseSwapExecutionParams = {
  swap$: SwapHandler
  swapCF$: SwapCFHandler
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
}

type UseSwapExecutionResult = {
  swapState: SwapTxState
  swapParams: O.Option<SwapTxParams>
  cfSwapParams: O.Option<SendTxParams>
  submitSwap: () => void
  submitCFSwap: () => void
  resetSwapState: () => void
  subscribeSwapState: (s: import('rxjs').Observable<SwapTxState>) => void
  swapStartTime: number
  lastTrackedTxHashRef: React.MutableRefObject<string | null>
}

export const useSwapExecution = ({
  swap$,
  swapCF$,
  selectedQuote,
  sourceAsset,
  amountToSwap,
  sourceWalletBalance,
  sourceChainBalance,
  swapFees,
  poolAddressThor,
  poolAddressMaya,
  network,
  isSendMax
}: UseSwapExecutionParams): UseSwapExecutionResult => {
  const { appWalletService } = useWalletContext()
  const appWalletState = useObservableState(appWalletService.appWalletState$)
  const standaloneLedgerState = useObservableState(appWalletService.standaloneLedgerService.standaloneLedgerState$)

  const isSourceUTXO = useMemo(() => isUtxoAssetChain(sourceAsset), [sourceAsset])

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
          memo: updateMemo(quoteSwap.memo, network),
          walletType,
          sender: finalWalletAddress,
          walletAccount: finalWalletAccount,
          walletIndex: finalWalletIndex,
          hdMode: finalHDMode,
          protocol: poolAddress.protocol,
          sendMax: isSourceUTXO ? isSendMax : undefined
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
    isSourceUTXO,
    isSendMax
  ])

  // Build Chainflip swap params
  const cfSwapParams: O.Option<SendTxParams> = useMemo(() => {
    return FP.pipe(
      sequenceTOption(sourceWalletBalance, selectedQuote),
      O.map(([{ walletType, walletAddress, walletAccount, walletIndex, hdMode }, quoteSwap]) => {
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

        return {
          asset: sourceAsset,
          amount: amountToSwapAdjusted,
          recipient: quoteSwap.toAddress,
          memo: quoteSwap.memo,
          walletType,
          sender: finalWalletAddress,
          walletAccount: finalWalletAccount,
          walletIndex: finalWalletIndex,
          hdMode: finalHDMode,
          sendMax: isSourceUTXO ? isSendMax : undefined
        }
      })
    )
  }, [
    sourceWalletBalance,
    selectedQuote,
    amountToSwap,
    sourceAsset,
    sourceChainBalance,
    swapFees.inFee.amount,
    appWalletState,
    standaloneLedgerState?.address,
    isSourceUTXO,
    isSendMax
  ])

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

  return {
    swapState,
    swapParams,
    cfSwapParams,
    submitSwap,
    submitCFSwap,
    resetSwapState,
    subscribeSwapState,
    swapStartTime,
    lastTrackedTxHashRef
  }
}
