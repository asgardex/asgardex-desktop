import { useCallback, useMemo, useRef, useState } from 'react'

import { ChainflipDepositChannel } from '@xchainjs/xchain-aggregator'
import { ADAChain } from '@xchainjs/xchain-cardano'
import { Network } from '@xchainjs/xchain-client'
import { isTCYAsset } from '@xchainjs/xchain-thorchain'
import {
  AnyAsset,
  BaseAmount,
  baseAmount,
  CryptoAmount,
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
import {
  buildChainflipBroadcastParams,
  openChainflipChannelForSubmit,
  toChainflipQuoteAsset
} from '../helpers/chainflipSwapHelper'
import { sequenceTOption } from '../helpers/fpHelpers'
import { createScopedLogger } from '../helpers/logger'
import { applyStreamingToMemo, updateMemo } from '../helpers/memoHelper'
import { INITIAL_SWAP_STATE } from '../services/chain/const'
import { SwapTxParams, SwapTxState, SendTxParams, SwapHandler, SwapCFHandler, SwapFees } from '../services/chain/types'
import { PoolAddress } from '../services/midgard/midgardTypes'
import { WalletBalance, isStandaloneLedgerMode } from '../services/wallet/types'
import { useAggregator } from '../store/aggregator/hooks'
import { useSubscriptionState } from './useSubscriptionState'

const logger = createScopedLogger('SwapExecution')

type UseSwapExecutionParams = {
  swap$: SwapHandler
  swapCF$: SwapCFHandler
  swapOneClick$: SwapCFHandler
  selectedQuote: O.Option<ExtendedQuoteSwap>
  sourceAsset: AnyAsset
  /** Destination asset for Chainflip channel open (egress). */
  targetAsset: AnyAsset
  /** User egress address required by Chainflip openDepositChannel. */
  destinationAddress: O.Option<string>
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
  /** Opens a Chainflip deposit channel then broadcasts the transfer. */
  submitCFSwap: () => Promise<void>
  submitOneClickSwap: () => void
  resetSwapState: () => void
  subscribeSwapState: (s: import('rxjs').Observable<SwapTxState>) => void
  swapStartTime: number
  lastTrackedTxHashRef: React.MutableRefObject<string | null>
  /** Set when a CF channel is opened for the in-flight submit (for tracker / modal). */
  lastCFChannelRef: React.MutableRefObject<ChainflipDepositChannel | null>
}

export const useSwapExecution = ({
  swap$,
  swapCF$,
  swapOneClick$,
  selectedQuote,
  sourceAsset,
  targetAsset,
  destinationAddress,
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
  const { requestChainflipDepositAddress, isBoostEnabled } = useAggregator()
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
  const lastCFChannelRef = useRef<ChainflipDepositChannel | null>(null)

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
  //
  // Chainflip: after aggregator 3.0, estimate quotes have empty `toAddress`. Recipient is filled
  // at submit time via requestChainflipDepositAddress. Params still exist so confirm modals can
  // detect a CF route (O.isSome) and carry wallet/amount metadata.
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

  const submitCFSwap = useCallback(async () => {
    if (O.isNone(cfSwapParams) || O.isNone(selectedQuote) || O.isNone(destinationAddress)) {
      throw new Error('Missing Chainflip swap params, quote, or destination address')
    }

    const params = cfSwapParams.value
    const quote = selectedQuote.value
    if (quote.protocol !== 'Chainflip') {
      throw new Error('Selected quote is not a Chainflip route')
    }

    const fromAsset = toChainflipQuoteAsset(sourceAsset)
    const destinationAsset = toChainflipQuoteAsset(targetAsset)

    logger.info('Opening Chainflip deposit channel before broadcast', {
      from: `${fromAsset.chain}.${fromAsset.symbol}`,
      to: `${destinationAsset.chain}.${destinationAsset.symbol}`,
      enableBoost: isBoostEnabled
    })

    let channel: ChainflipDepositChannel
    try {
      channel = await openChainflipChannelForSubmit({
        requestChainflipDepositAddress,
        quoteParams: {
          fromAsset: fromAsset as CryptoAmount['asset'],
          destinationAsset: destinationAsset as CryptoAmount['asset'],
          amount: new CryptoAmount(params.amount, fromAsset as CryptoAmount['asset']),
          fromAddress: params.sender,
          destinationAddress: destinationAddress.value,
          enableBoost: isBoostEnabled
        }
      })
    } catch (error) {
      logger.error('Chainflip channel open failed', error)
      throw error
    }

    lastCFChannelRef.current = channel
    logger.info('Chainflip channel opened', {
      depositChannelId: channel.depositChannelId,
      depositAddress: channel.depositAddress,
      expiresAt: channel.expiresAt.toISOString()
    })

    setSwapStartTime(Date.now())
    subscribeSwapState(swapCF$(buildChainflipBroadcastParams(params, channel)))
  }, [
    cfSwapParams,
    selectedQuote,
    destinationAddress,
    sourceAsset,
    targetAsset,
    isBoostEnabled,
    requestChainflipDepositAddress,
    subscribeSwapState,
    swapCF$
  ])

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
    lastTrackedTxHashRef,
    lastCFChannelRef
  }
}
