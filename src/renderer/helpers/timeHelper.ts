import { THORChain } from '@xchainjs/xchain-thorchain'
import { AnyAsset, AssetType } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'

import { DefaultChainAttributes } from '../../shared/utils/chain'

/**
 * timeStamp will be rounded-down based on roundBasis
 * @example roundUnixTimestampToMinutes(5)(345) === O.some(300)
 * @param roundBasis - basis in minutes to round-down to
 */
export const roundUnixTimestampToMinutes =
  (roundBasis = 5) =>
  (timeStamp?: number): O.Option<number> =>
    FP.pipe(
      timeStamp,
      O.fromNullable,
      O.map((timeStamp) => timeStamp - (timeStamp % (roundBasis * 60)))
    )

export type Time = {
  inbound?: number
  outbound?: number
  totalSwap?: number
  streaming?: number
  confirmation?: number
}

type QuoteDetails = {
  inboundConfSeconds?: number
  outboundDelaySeconds?: number
  totalTransactionSeconds?: number
  streamingTransactionSeconds?: number
}

export const calculateTransactionTime = (
  sourceChain: string,
  txDetails?: QuoteDetails,
  targetAsset?: AnyAsset
): Time => {
  const inboundTime =
    txDetails && txDetails.inboundConfSeconds
      ? txDetails.inboundConfSeconds
      : DefaultChainAttributes[sourceChain].avgBlockTimeInSecs
  const outboundTime =
    txDetails && targetAsset
      ? targetAsset.type === AssetType.SYNTH || targetAsset?.chain === THORChain
        ? 0
        : txDetails.outboundDelaySeconds
      : 0
  const confirmationTime = targetAsset ? DefaultChainAttributes[targetAsset.chain].avgBlockTimeInSecs : 0
  const streamingTime = txDetails && txDetails.streamingTransactionSeconds ? txDetails.streamingTransactionSeconds : 0

  const totalSwapTime = Math.max(
    txDetails && targetAsset
      ? targetAsset.type === AssetType.SYNTH || targetAsset?.chain === THORChain
        ? Number(inboundTime) + confirmationTime + streamingTime
        : Number(txDetails.totalTransactionSeconds) + Number(inboundTime) + confirmationTime + streamingTime
      : Number(inboundTime) + confirmationTime
  )
  return {
    inbound: inboundTime,
    outbound: outboundTime,
    totalSwap: totalSwapTime,
    streaming: streamingTime,
    confirmation: confirmationTime
  }
}

export const formatSwapTime = (totalSwapSeconds: number) => {
  if (isNaN(totalSwapSeconds)) {
    return ''
  }

  if (totalSwapSeconds < 60) {
    return `${totalSwapSeconds} seconds`
  } else if (totalSwapSeconds < 3600) {
    return `${Math.floor(totalSwapSeconds / 60)} minutes`
  } else {
    return `${(totalSwapSeconds / 60 / 60).toFixed(2)} hours`
  }
}
