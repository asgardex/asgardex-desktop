import * as RD from '@devexperts/remote-data-ts'
import { FeeOption, Network } from '@xchainjs/xchain-client'
import { FeesWithGasPricesAndLimits } from '@xchainjs/xchain-evm'
import { Address, AnyAsset, Asset, BaseAmount } from '@xchainjs/xchain-util'
import { ethers } from 'ethers'
import * as O from 'fp-ts/lib/Option'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { LiveData } from '../../helpers/rx/liveData'
import { FeeLD, FeesLD, Memo } from '../chain/types'
import * as C from '../clients'
import { ApiError, TxHashLD } from '../wallet/types'

export type FeesWithGasPricesAndLimitsRD = RD.RemoteData<Error, FeesWithGasPricesAndLimits>
export type FeesWithGasPricesAndLimitsLD = LiveData<Error, FeesWithGasPricesAndLimits>

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
 * `ApproveParams`
 * are used to `approve but also to estimate `approveFees`
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
}

export type IsApproveParams = { contractAddress: Address; spenderAddress: Address; fromAddress: Address }

export type PollInTxFeeParams = {
  address: Address
  abi: ethers.ContractInterface
  func: string
  params: Array<unknown>
}

export type IsApprovedRD = RD.RemoteData<ApiError, boolean>
export type IsApprovedLD = LiveData<ApiError, boolean>

export type TransactionService = {
  sendPoolTx$: (params: SendPoolTxParams) => TxHashLD
  approveERC20Token$: (params: ApproveParams) => TxHashLD
  isApprovedERC20Token$: (params: IsApproveParams) => LiveData<ApiError, boolean>
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
  poolInTxFees$: (params: PollInTxFeeParams) => C.FeesLD
  poolOutTxFee$: (asset: Asset) => C.FeesLD
  approveFee$: ApproveFeeHandler
  reloadApproveFee: LoadApproveFeeHandler
  reloadFees: (params: TxParams) => void
  fees$: (params: TxParams) => FeesLD
}
