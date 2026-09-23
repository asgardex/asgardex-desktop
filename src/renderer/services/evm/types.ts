import * as RD from '@devexperts/remote-data-ts'
import { FeeOption, Network, XChainClient } from '@xchainjs/xchain-client'
import ClientKeystore, { TxParams as BaseEvmTxParams } from '@xchainjs/xchain-evm'
import { Address, AnyAsset, Asset, BaseAmount, TokenAsset } from '@xchainjs/xchain-util'
import { option as O } from 'fp-ts'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { LiveData } from '../../helpers/rx/liveData'
import { FeeLD, FeesLD, Memo } from '../chain/types'
import * as C from '../clients'
import { ApiError, TxHashLD } from '../wallet/types'

export type ApproveFeeHandler = (p: ApproveParams) => FeeLD

export type LoadApproveFeeHandler = (p: ApproveParams) => void

export type SendTxParams = {
  asset: AnyAsset
  recipient: Address
  sender?: Address
  amount: BaseAmount
  memo: Memo
  feeOption: FeeOption
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
  walletType: WalletType
}

export type SendPoolTxParams = SendTxParams & {
  router: O.Option<Address>
}

/**
 * EVM transfer params
 */
export type EvmTxParams = BaseEvmTxParams & {
  asset: Asset | TokenAsset
}

/**
 * `ApproveParams`
 * are used to `approve but also to estimate `approveFees`
 *
 * `amount` is optional:
 * - omit → unlimited (`MAX_APPROVAL`) — default for swap/deposit CTAs
 * - `0` → revoke allowance
 * - finite → limited approve
 */
export type ApproveParams = {
  network: Network
  walletType: WalletType
  walletAccount: number
  walletIndex: number
  contractAddress: Address
  spenderAddress: Address
  fromAddress: Address // needed for estimating fees
  hdMode: HDMode
  amount?: BaseAmount
}

export type IsApproveParams = { contractAddress: Address; spenderAddress: Address; fromAddress: Address }

/** Params for reading the raw ERC-20 allowance (includes token decimals for BaseAmount). */
export type AllowanceParams = IsApproveParams & { decimals: number }

export type PoolInTxFeeParams = {
  asset: AnyAsset
  amount: BaseAmount
  recipient: Address
  memo?: string
}

export type IsApprovedRD = RD.RemoteData<ApiError, boolean>
export type IsApprovedLD = LiveData<ApiError, boolean>
export type AllowanceRD = RD.RemoteData<ApiError, BaseAmount>
export type AllowanceLD = LiveData<ApiError, BaseAmount>

export type TransactionService = {
  sendPoolTx$: (params: SendPoolTxParams) => TxHashLD
  approveERC20Token$: (params: ApproveParams) => TxHashLD
  isApprovedERC20Token$: (params: IsApproveParams) => LiveData<ApiError, boolean>
  getERC20Allowance$: (params: AllowanceParams) => AllowanceLD
} & C.TransactionService<SendTxParams>

export type TxParams = {
  walletIndex?: number
  asset?: AnyAsset
  amount: BaseAmount
  recipient: Address
  memo?: string
  from?: Address
}

export type FeesService = {
  poolInTxFees$: (params: PoolInTxFeeParams) => C.FeesLD
  approveFee$: ApproveFeeHandler
  reloadApproveFee: LoadApproveFeeHandler
  reloadFees: (params: TxParams) => void
  fees$: (params: TxParams) => FeesLD
}

export type Client = XChainClient & ClientKeystore
export type Client$ = C.Client$<Client>

export type ClientState = C.ClientState<Client>
export type ClientState$ = C.ClientState$<Client>
