import { Client } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import * as Rx from 'rxjs'

import { LedgerBTCTxInfo } from '../../../shared/api/types'
import * as C from '../clients'
import { LedgerTxHashLD } from '../wallet/types'

export type Client$ = C.Client$<Client>

export type ClientState = C.ClientState<Client>
export type ClientState$ = C.ClientState$<Client>

export type LedgerService = {
  ledgerTxRD$: LedgerTxHashLD
  pushLedgerTx: (network: Network, params: LedgerBTCTxInfo) => Rx.Subscription
  resetLedgerTx: () => void
}
