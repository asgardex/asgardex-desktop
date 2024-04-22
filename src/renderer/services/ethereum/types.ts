import { XChainClient } from '@xchainjs/xchain-client'
import ClientKeystore from '@xchainjs/xchain-evm'

import * as C from '../clients'

export type Client = XChainClient & ClientKeystore
export type Client$ = C.Client$<Client>

export type ClientState = C.ClientState<Client>
export type ClientState$ = C.ClientState$<Client>
