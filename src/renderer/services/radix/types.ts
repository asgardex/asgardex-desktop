import { Client } from '@xchainjs/xchain-radix'
import { Address, AnyAsset, BaseAmount } from '@xchainjs/xchain-util'
import * as O from 'fp-ts/lib/Option'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import * as C from '../clients'
import { TxHashLD } from '../wallet/types'

export type Client$ = C.Client$<Client>

export type ClientState = C.ClientState<Client>
export type ClientState$ = C.ClientState$<Client>

export type SendTxParams = {
  walletType: WalletType
  sender?: Address
  recipient: Address
  amount: BaseAmount
  asset: AnyAsset
  memo: string
  walletAccount: number
  walletIndex: number
  hdMode: HDMode
}

export type SendPoolTxParams = SendTxParams & {
  router: O.Option<Address>
}
export type TransactionService = {
  sendPoolTx$: (params: SendPoolTxParams) => TxHashLD
} & C.TransactionService<SendTxParams>

export type FeesService = C.FeesService
