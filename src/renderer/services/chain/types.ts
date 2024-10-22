import * as RD from '@devexperts/remote-data-ts'
import { FeeOption, Fees, Network, Tx } from '@xchainjs/xchain-client'
import { Address, AnyAsset, Asset, BaseAmount, Chain } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as O from 'fp-ts/lib/Option'
import * as Rx from 'rxjs'

import { Dex } from '../../../shared/api/types'
import { WalletType, WalletAddress, HDMode } from '../../../shared/wallet/types'
import { LiveData } from '../../helpers/rx/liveData'
import { AssetWithDecimal } from '../../types/asgardex'
import { AssetWithAmount } from '../../types/asgardex'
import { PoolAddress } from '../midgard/types'
import { TxStagesRD } from '../thorchain/types'
import { ApiError, TxHashRD } from '../wallet/types'

export type TxTypes = 'DEPOSIT' | 'SWAP' | 'WITHDRAW' | 'APPROVE' | 'SEND'

export type Chain$ = Rx.Observable<O.Option<Chain>>

export type AssetWithDecimalLD = LiveData<Error, AssetWithDecimal>
export type AssetWithDecimalRD = RD.RemoteData<Error, AssetWithDecimal>

export type LoadFeesHandler = () => void

export type FeeRD = RD.RemoteData<Error, BaseAmount>
export type FeeLD = LiveData<Error, BaseAmount>

export type FeesRD = RD.RemoteData<Error, Fees>
export type FeesLD = LiveData<Error, Fees>

export type Memo = string
export type MemoRx = Rx.Observable<O.Option<Memo>>

export type SymDepositMemo = { rune: Memo; asset: Memo }

export type SymDepositAddresses = {
  asset: O.Option<WalletAddress>
  dex: O.Option<WalletAddress>
}

export type DepositFees = { inFee: BaseAmount; outFee: BaseAmount; refundFee: BaseAmount }
export type DepositAssetFees = DepositFees & { asset: AnyAsset }

/**
 * Saver deposit fees
 *
 */
export type SaverDepositFees = {
  /** fee for asset txs */
  readonly asset: DepositAssetFees
}

export type SaverDepositFeesRD = RD.RemoteData<Error, SaverDepositFees>
export type SaverDepositFeesLD = LiveData<Error, SaverDepositFees>

export type SaverDepositFeesParams = {
  readonly asset: AnyAsset
}

export type SaverDepositFeesHandler = (asset: AnyAsset) => SaverDepositFeesLD

export type ReloadSaverDepositFeesHandler = (asset: AnyAsset) => void

/**
 * Borrower deposit fees
 *
 */
export type BorrowerDepositFees = {
  /** fee for asset txs */
  readonly asset: DepositAssetFees
}

export type BorrowerDepositFeesRD = RD.RemoteData<Error, BorrowerDepositFees>
export type BorrowerDepositFeesLD = LiveData<Error, BorrowerDepositFees>

export type BorrowerDepositFeesParams = {
  readonly asset: Asset
}

export type BorrowerDepositFeesHandler = (asset: Asset) => BorrowerDepositFeesLD

export type ReloadBorrowerDepositFeesHandler = (asset: Asset) => void

/**
 * Sym. deposit fees
 *
 */
export type SymDepositFees = {
  /** fee for RUNE txs */
  readonly rune: DepositFees
  /** fee for asset txs */
  readonly asset: DepositAssetFees
}

export type SymDepositFeesRD = RD.RemoteData<Error, SymDepositFees>
export type SymDepositFeesLD = LiveData<Error, SymDepositFees>

export type SymDepositFeesParams = {
  readonly asset: AnyAsset
}

export type SymDepositFeesHandler = (asset: AnyAsset, dex: Dex) => SymDepositFeesLD
export type ReloadSymDepositFeesHandler = (asset: AnyAsset, dex: Dex) => void

export type SaverDepositParams = {
  readonly poolAddress: PoolAddress
  readonly asset: AnyAsset
  readonly amount: BaseAmount
  readonly memo: string
  readonly sender: Address
  readonly walletAccount: number
  readonly walletIndex: number
  readonly walletType: WalletType
  readonly hdMode: HDMode
  readonly dex: Dex
}

export type BorrowerDepositParams = {
  readonly poolAddress: PoolAddress
  readonly asset: AnyAsset
  readonly amount: BaseAmount
  readonly memo: string
  readonly sender: Address
  readonly walletIndex: number
  readonly walletAccount: number
  readonly walletType: WalletType
  readonly hdMode: HDMode
  readonly dex: Dex
}

export type SymDepositAmounts = { rune: BaseAmount; asset: BaseAmount }

export type SymDepositParams = {
  readonly poolAddress: PoolAddress
  readonly asset: AnyAsset
  readonly amounts: SymDepositAmounts
  readonly memos: SymDepositMemo
  readonly runeWalletType: WalletType
  readonly runeWalletAccount: number
  readonly runeWalletIndex: number
  readonly runeHDMode: HDMode
  readonly runeSender: Address
  readonly assetWalletAccount: number
  readonly assetWalletIndex: number
  readonly assetWalletType: WalletType
  readonly assetHDMode: HDMode
  readonly assetSender: Address
  readonly dex: Dex
}

export type SendTxParams = {
  walletType: WalletType
  asset: AnyAsset
  sender: Address
  recipient: Address
  amount: BaseAmount
  memo: Memo
  feeOption?: FeeOption
  walletAccount: number
  walletIndex: number
  feeAsset?: AnyAsset
  gasLimit?: BigNumber
  feeAmount?: BaseAmount
  hdMode: HDMode
  dex: Dex
}

export type SendPoolTxParams = SendTxParams & {
  router: O.Option<Address>
}

export type LedgerAddressParams = { chain: Chain; network: Network }

/**
 * State to reflect status of a swap by doing different requests
 */
export type SwapState = {
  // Number of current step
  readonly step: number
  // Constant total amount of steps
  readonly stepsTotal: 3
  // swap transaction
  readonly swapTx: TxHashRD
  // RD of all requests
  readonly swap: RD.RemoteData<ApiError, boolean>
}

export type SwapState$ = Rx.Observable<SwapState>

export type SwapTxState = {
  readonly swapTx: TxHashRD
}
export type StreamingTxState = {
  readonly streamingTx: TxStagesRD
}
export type StreamingTxState$ = Rx.Observable<StreamingTxState>
export type SwapTxState$ = Rx.Observable<SwapTxState>

/**
 * Parameters to send swap tx into (IN) a pool
 */
export type SwapTxParams = {
  readonly poolAddress: PoolAddress
  readonly asset: AnyAsset
  readonly amount: BaseAmount
  readonly memo: string
  readonly walletType: WalletType
  readonly sender: Address
  readonly walletAccount: number
  readonly walletIndex: number
  readonly hdMode: HDMode
  readonly dex: Dex
}

export type SwapStateHandler = (p: SwapTxParams) => SwapState$
export type SwapHandler = (p: SwapTxParams) => SwapTxState$

/**
 * Types of swap txs
 **/

export type SwapTxType = 'in' | ' out'

export type SwapOutTx = {
  readonly asset: AnyAsset
  readonly memo: Memo
}

export type PoolFeeLD = LiveData<Error, AssetWithAmount>

export type SwapFees = {
  /** Inbound tx fee */
  readonly inFee: AssetWithAmount
  /** Outbound tx fee */
  readonly outFee: AssetWithAmount
}

export type SwapFeesRD = RD.RemoteData<Error, SwapFees>
export type SwapFeesLD = LiveData<Error, SwapFees>

export type SwapFeesParams = {
  readonly inAsset: AnyAsset
  readonly memo: string
  readonly outAsset: AnyAsset
}

export type SwapFeesHandler = (p: SwapFeesParams) => SwapFeesLD
export type ReloadSwapFeesHandler = (p: SwapFeesParams) => void

/**
 * State to reflect status of an Saver deposit by doing different requests
 */
export type SaverDepositState = {
  // Number of current step
  readonly step: number
  // Constant total amount of steps
  readonly stepsTotal: 3
  // deposit transaction
  readonly depositTx: TxHashRD
  // RD of all requests
  readonly deposit: RD.RemoteData<ApiError, boolean>
}

export type SaverDepositState$ = Rx.Observable<SaverDepositState>

export type SaverDepositStateHandler = (p: SaverDepositParams) => SaverDepositState$

/**
 * State to reflect status of a borrowers deposit by doing different requests
 */
export type BorrowerDepositState = {
  // Number of current step
  readonly step: number
  // Constant total amount of steps
  readonly stepsTotal: 3
  // deposit transaction
  readonly depositTx: TxHashRD
  // RD of all requests
  readonly deposit: RD.RemoteData<ApiError, boolean>
}

export type BorrowerDepositState$ = Rx.Observable<BorrowerDepositState>

export type BorrowerDepositStateHandler = (p: BorrowerDepositParams) => BorrowerDepositState$

export type SymDepositValidationResult = { pool: boolean; node: boolean }
export type SymDepositTxs = { rune: TxHashRD; asset: TxHashRD }
export type SymDepositFinalityResult = { rune: Tx; asset: Tx }

/**
 * State to reflect status of a sym. deposit by doing different requests
 */
export type SymDepositState = {
  // Number of current step
  readonly step: number
  // Constant total amount of steps
  readonly stepsTotal: 4
  // deposit transactions
  readonly depositTxs: SymDepositTxs
  // RD for all needed steps
  readonly deposit: RD.RemoteData<ApiError, boolean>
}

export type SymDepositState$ = Rx.Observable<SymDepositState>

export type SymDepositStateHandler = (p: SymDepositParams) => SymDepositState$

export type WithdrawFees = {
  /** Inbound tx fee */
  inFee: BaseAmount
  /** Outbound tx fee */
  outFee: BaseAmount
}

/**
 * Withdraw fees
 */
export type SymWithdrawFees = {
  rune: WithdrawFees
  asset: AssetWithAmount
}

export type SymWithdrawFeesRD = RD.RemoteData<Error, SymWithdrawFees>
export type SymWithdrawFeesLD = LiveData<Error, SymWithdrawFees>

export type SymWithdrawFeesHandler = (asset: AnyAsset, dex: Dex) => SymWithdrawFeesLD
export type ReloadWithdrawFeesHandler = (asset: AnyAsset, dex: Dex) => void

/**
 * Saver Withdraw Fees
 */
export type WithdrawAssetFees = WithdrawFees & {
  /** fee asset */
  asset: AnyAsset
}

export type SaverWithdrawFeesRD = RD.RemoteData<Error, WithdrawAssetFees>
export type SaverWithdrawFeesLD = LiveData<Error, WithdrawAssetFees>
export type SaverWithdrawFeesHandler = (asset: AnyAsset) => SaverWithdrawFeesLD

/**
 * State to reflect status of a sym / saver. withdraw by doing different requests
 */
export type WithdrawState = {
  // Number of current step
  readonly step: number
  // Constant total amount of steps
  readonly stepsTotal: 3
  // withdraw transaction
  readonly withdrawTx: TxHashRD
  // RD for all needed steps
  readonly withdraw: RD.RemoteData<ApiError, boolean>
}

export type WithdrawState$ = Rx.Observable<WithdrawState>

export type SymWithdrawParams = {
  readonly memo: Memo
  readonly network: Network
  readonly walletAddress: Address
  readonly walletType: WalletType
  readonly walletAccount: number
  readonly walletIndex: number
  readonly hdMode: HDMode
  readonly dex: Dex
  readonly dexAsset: Asset
}

export type SymWithdrawStateHandler = (p: SymWithdrawParams) => WithdrawState$

export type SaverWithdrawParams = {
  readonly poolAddress: PoolAddress
  readonly asset: AnyAsset
  readonly amount: BaseAmount
  readonly memo: Memo
  readonly network: Network
  readonly walletType: WalletType
  readonly walletAccount: number
  readonly walletIndex: number
  readonly sender: Address
  readonly hdMode: HDMode
  readonly dex: Dex
}

export type SaverWithdrawStateHandler = (p: SaverWithdrawParams) => WithdrawState$

export type RepayLoanParams = {}

export type RepayLoanStateHandler = (p: SaverWithdrawParams) => WithdrawState$

/**
 * State to reflect status for sending
 *
 * Three steps are needed:
 * 1. Send tx
 * 2. Check status of tx
 *
 */
export type SendTxState = {
  // State of steps (current step + total number of steps)
  readonly steps: { current: number; readonly total: 1 }
  // RD of all steps
  readonly status: TxHashRD
}

export type SendTxState$ = Rx.Observable<SendTxState>

export type SendTxStateHandler = (p: SendTxParams) => SendTxState$
