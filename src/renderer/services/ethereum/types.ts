import { XChainClient } from '@xchainjs/xchain-client'
import { Client as EthereumClient } from '@xchainjs/xchain-ethereum'

import * as C from '../clients'

export type Client = XChainClient & EthereumClient
export type Client$ = C.Client$<Client>

export type ClientState = C.ClientState<Client>
export type ClientState$ = C.ClientState$<Client>
