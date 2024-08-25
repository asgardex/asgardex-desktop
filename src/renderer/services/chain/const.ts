import * as RD from '@devexperts/remote-data-ts'
import { FeeOption } from '@xchainjs/xchain-client'
import * as O from 'fp-ts/lib/Option'

import {
  SaverDepositState,
  SymDepositState,
  WithdrawState,
  SendTxState,
  TxTypes,
  SymDepositAddresses,
  SwapTxState,
  StreamingTxState,
  BorrowerDepositState
} from './types'

export const MAX_SWAP_STEPS = 3

/**
 * Default `FeeOption`s for chain txs
 */
export const ChainTxFeeOption: { [key in TxTypes]: FeeOption } = {
  SWAP: FeeOption.Fast,
  DEPOSIT: FeeOption.Fast,
  WITHDRAW: FeeOption.Fast,
  APPROVE: FeeOption.Fast,
  SEND: FeeOption.Fast
}

// Initial state for streaming
export const INITIAL_STREAMING_STATE: StreamingTxState = {
  streamingTx: RD.initial
}

export const INITIAL_SWAP_STATE: SwapTxState = {
  swapTx: RD.initial
}

export const INITIAL_SAVER_DEPOSIT_STATE: SaverDepositState = {
  step: 1,
  depositTx: RD.initial,
  stepsTotal: 3,
  deposit: RD.initial
}
export const INITIAL_BORROWER_DEPOSIT_STATE: BorrowerDepositState = {
  step: 1,
  depositTx: RD.initial,
  stepsTotal: 3,
  deposit: RD.initial
}
export const INITIAL_SAVER_WITHDRAW_STATE: WithdrawState = {
  step: 1,
  withdrawTx: RD.initial,
  stepsTotal: 3,
  withdraw: RD.initial
}

export const INITIAL_SYM_DEPOSIT_STATE: SymDepositState = {
  step: 1,
  stepsTotal: 4,
  depositTxs: { rune: RD.initial, asset: RD.initial },
  deposit: RD.initial
}

export const INITIAL_WITHDRAW_STATE: WithdrawState = {
  step: 1,
  stepsTotal: 3,
  withdrawTx: RD.initial,
  withdraw: RD.initial
}

export const INITIAL_SEND_STATE: SendTxState = {
  steps: { current: 0, total: 1 },
  status: RD.initial
}

export const INITIAL_SYM_DEPOSIT_ADDRESSES: SymDepositAddresses = {
  asset: O.none,
  dex: O.none
}
