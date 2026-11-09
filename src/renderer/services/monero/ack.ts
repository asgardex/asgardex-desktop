import { Network } from '@xchainjs/xchain-client'

import { observableState } from '../../helpers/stateHelper'
import { KeyValueStorage } from './config'

/**
 * "Receive-only" acknowledgement. The XMR address is not shown (and nothing is scanned) before the user acknowledged,
 * per wallet address + network, that the wallet
 *  - can't send yet,
 *  - can't be restored from the seed phrase by other Monero wallets (different derivation),
 *  - and how to get funds out (export keys).
 * It is a UX gate stored in the renderer's storage, not a security boundary.
 */
export const XMR_ACK_STORAGE_PREFIX = 'asgardex-xmr-receive-ack:v1'

const ackKey = (network: Network, address: string) => `${XMR_ACK_STORAGE_PREFIX}:${network}:${address}`

const defaultStorage = (): KeyValueStorage | undefined =>
  typeof window !== 'undefined' ? window.localStorage : undefined

export const isXmrReceiveAcknowledged = (
  network: Network,
  address: string,
  storage: KeyValueStorage | undefined = defaultStorage()
): boolean => {
  try {
    return storage?.getItem(ackKey(network, address)) === '1'
  } catch {
    return false
  }
}

/** Bumped whenever an acknowledgement is stored, so streams can re-evaluate */
const { get$: xmrAckVersion$, set: setAckVersion, get: getAckVersion } = observableState<number>(0)
export { xmrAckVersion$ }

export const acknowledgeXmrReceive = (
  network: Network,
  address: string,
  storage: KeyValueStorage | undefined = defaultStorage()
): void => {
  try {
    storage?.setItem(ackKey(network, address), '1')
  } catch {
    // not persisted -> asked again next session
  }
  setAckVersion(getAckVersion() + 1)
}
