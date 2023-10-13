import { Client as AvaxClient } from '@xchainjs/xchain-avax'
import { XChainClient } from '@xchainjs/xchain-client'

import * as C from '../clients'

export type Client = XChainClient & AvaxClient
export type Client$ = C.Client$<Client>

export type ClientState = C.ClientState<Client>
export type ClientState$ = C.ClientState$<Client>
