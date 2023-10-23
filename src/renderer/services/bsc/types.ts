import { Client as BscClient } from '@xchainjs/xchain-bsc'
import { XChainClient } from '@xchainjs/xchain-client'

import * as C from '../clients'

export type Client = XChainClient & BscClient
export type Client$ = C.Client$<Client>

export type ClientState = C.ClientState<Client>
export type ClientState$ = C.ClientState$<Client>
