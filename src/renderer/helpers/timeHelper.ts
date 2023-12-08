import { THORChain } from '@xchainjs/xchain-thorchain'
import { DefaultChainAttributes } from '@xchainjs/xchain-thorchain-query'
import { Asset } from '@xchainjs/xchain-util'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'

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
  outboundDelaySeconds?: number
  totalTransactionSeconds?: number
  streamingTransactionSeconds?: number
}

export const calculateTransactionTime = (sourceChain: string, txDetails?: QuoteDetails, targetAsset?: Asset): Time => {
  return {
    inbound: DefaultChainAttributes[sourceChain].avgBlockTimeInSecs,
    outbound: txDetails ? txDetails.outboundDelaySeconds : 0,
    totalSwap: txDetails ? txDetails.totalTransactionSeconds : 0,
    streaming: txDetails ? txDetails.streamingTransactionSeconds : 0,
    confirmation: targetAsset
      ? DefaultChainAttributes[targetAsset.synth ? THORChain : targetAsset.chain].avgBlockTimeInSecs
      : 0
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
