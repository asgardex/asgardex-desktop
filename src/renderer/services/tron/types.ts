import { FeeOption, Network, XChainClient } from '@xchainjs/xchain-client'
import {
  Client as ClientKeystore,
  ApproveParams as TronApproveParams,
  IsApprovedParams as TronIsApprovedParams
} from '@xchainjs/xchain-tron'
import { Address, AnyAsset, BaseAmount } from '@xchainjs/xchain-util'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import { LiveData } from '../../helpers/rx/liveData'
import * as C from '../clients'
import { ApiError, TxHashLD } from '../wallet/types'

export type Client = XChainClient & ClientKeystore
export type Client$ = C.Client$<Client>

export type ClientState = C.ClientState<Client>
export type ClientState$ = C.ClientState$<Client>

export type SendTxParams = {
  asset: AnyAsset
  recipient: Address
  sender?: Address
  amount: BaseAmount
  memo?: string
  feeOption: FeeOption
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
  walletType: WalletType
}

export type ApproveParams = {
  network: Network
  walletType: WalletType
  walletAccount: number
  walletIndex: number
  contractAddress: Address
  spenderAddress: Address
  fromAddress: Address
  hdMode: HDMode
} & TronApproveParams

export type IsApproveParams = {
  contractAddress: Address
  spenderAddress: Address
  fromAddress: Address
} & TronIsApprovedParams

export type IsApprovedLD = LiveData<ApiError, boolean>

export type TransactionService = {
  approveTRC20Token$: (params: ApproveParams) => TxHashLD
  isApprovedTRC20Token$: (params: IsApproveParams) => IsApprovedLD
} & C.TransactionService<SendTxParams>
