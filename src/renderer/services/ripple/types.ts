import { Client } from '@xchainjs/xchain-ripple'
import { BaseAmount, AnyAsset, Address } from '@xchainjs/xchain-util'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import * as C from '../clients'

export type Client$ = C.Client$<Client>

export type ClientState = C.ClientState<Client>
export type ClientState$ = C.ClientState$<Client>

export type FeesService = C.FeesService

export type SendTxParams = {
  walletType: WalletType
  recipient: Address
  amount: BaseAmount
  asset: AnyAsset
  memo: string
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
  sender?: Address
}

export type TransactionService = C.TransactionService<SendTxParams>
