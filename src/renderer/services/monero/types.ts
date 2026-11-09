import { Client } from '@xchainjs/xchain-monero'
import { Address, AnyAsset, BaseAmount } from '@xchainjs/xchain-util'

import { HDMode, WalletType } from '../../../shared/wallet/types'
import * as C from '../clients'

export type Client$ = C.Client$<Client>

export type ClientState = C.ClientState<Client>
export type ClientState$ = C.ClientState$<Client>

/**
 * Params of `sendTx`. XMR is watch-only, sending is always rejected — the type exists
 * to keep the same shape as other chain services (`sendTx$` in `chain/transaction/common.ts`).
 */
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

export type FeesService = {
  fees$: () => C.FeesLD
  reloadFees: () => void
}

export type TransactionService = C.TransactionService<SendTxParams>
