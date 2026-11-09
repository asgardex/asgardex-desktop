import * as RD from '@devexperts/remote-data-ts'
import { function as FP } from 'fp-ts'
import * as RxOp from 'rxjs/operators'

import { XMRChain } from '../../../shared/utils/chainIds'
import { isError } from '../../../shared/utils/guard'
import { logger } from '../../helpers/logger'
import { clientNetwork$ } from '../app/service'
import * as C from '../clients'
import { userChains$ } from '../storage/userChains'
import { keystoreService } from '../wallet/keystore'
import { getPhrase } from '../wallet/util'
import { xmrAckVersion$ } from './ack'
import { createReadOnlyXmrClient } from './client'
import { createClientState$, createPendingAck$, createViewKeys$ } from './clientState'
import { xmrConnectionConfig$ } from './config'
import { Client$, ClientState, ClientState$ } from './types'

/** `true` while the user has enabled XMR (opt-in chain: not part of `DEFAULT_ENABLED_CHAINS`) */
const xmrEnabled$ = userChains$.pipe(
  RxOp.map((chains) => chains.includes(XMRChain)),
  RxOp.distinctUntilChanged(),
  RxOp.shareReplay(1)
)

/**
 * View-only keys of the keystore wallet (derived locally; nothing leaves the device).
 * The phrase is only read here, to derive them — it is never handed to a `Client`.
 */
const viewKeys$ = createViewKeys$({
  phrase$: keystoreService.keystoreState$.pipe(RxOp.map(getPhrase)),
  network$: clientNetwork$
})

/** Wallet whose receive-only acknowledgement is still pending (drives the acknowledgement dialog) */
const pendingAck$ = createPendingAck$({ viewKeys$, ackVersion$: xmrAckVersion$, enabled$: xmrEnabled$ })

/**
 * Receive-only client. Exists only after the user acknowledged the receive-only terms (so no address is exposed and
 * no node is contacted before). Whenever the keystore, network or connection settings change, a new client is created.
 */
const clientState$: ClientState$ = createClientState$({
  viewKeys$,
  config$: xmrConnectionConfig$,
  ackVersion$: xmrAckVersion$,
  enabled$: xmrEnabled$
})

const client$: Client$ = clientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

/**
 * Client without wallet. Used for explorer URLs only.
 */
const readOnlyClientState$: ClientState$ = FP.pipe(
  clientNetwork$,
  RxOp.map((network): ClientState => {
    try {
      return RD.success(createReadOnlyXmrClient(network))
    } catch (error) {
      logger.error('Failed to create read-only XMR client', error)
      return RD.failure<Error>(isError(error) ? error : new Error('Failed to create read-only XMR client'))
    }
  }),
  RxOp.startWith<ClientState>(RD.pending),
  RxOp.shareReplay(1)
)

const readOnlyClient$: Client$ = readOnlyClientState$.pipe(RxOp.map(RD.toOption), RxOp.shareReplay(1))

/**
 * `Address` (O.none until the receive-only acknowledgement)
 */
const address$: C.WalletAddress$ = C.address$(client$, XMRChain)

/**
 * `Address` (O.none until the receive-only acknowledgement)
 */
const addressUI$: C.WalletAddress$ = C.addressUI$(client$, XMRChain)

/**
 * Explorer url depending on selected network
 */
const explorerUrl$: C.ExplorerUrl$ = C.explorerUrl$(readOnlyClient$)

export { client$, clientState$, readOnlyClient$, viewKeys$, pendingAck$, address$, addressUI$, explorerUrl$ }
