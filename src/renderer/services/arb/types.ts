import { Client as ArbClient } from '@xchainjs/xchain-arbitrum'
import { XChainClient } from '@xchainjs/xchain-client'

import * as C from '../clients'

export type Client = XChainClient & ArbClient
export type Client$ = C.Client$<Client>

export type ClientState = C.ClientState<Client>
export type ClientState$ = C.ClientState$<Client>
