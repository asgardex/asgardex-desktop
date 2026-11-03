import { Network } from '@xchainjs/xchain-client'
import { Client, defaultXMRParams } from '@xchainjs/xchain-monero'
import { option as O } from 'fp-ts'

import { buildXmrClientParams, resolveRestoreHeight, XmrConnectionConfig } from './config'

/**
 * Creates the Monero client from a keystore phrase (**watch-only usage**).
 *
 * The client is created twice on purpose: the first (restore height `0`) only derives the address locally,
 * so the first-use height can be remembered per address; the second one is the client which is returned.
 * If the height can't be resolved (no daemon reachable), restore height stays `0` and balance requests fail with
 * a clear error of the SDK ("Daemon scan range too large …") instead of scanning from genesis.
 */
export const createXmrClient = async ({
  phrase,
  network,
  config,
  resolveHeight = resolveRestoreHeight
}: {
  phrase: string
  network: Network
  config: XmrConnectionConfig
  resolveHeight?: typeof resolveRestoreHeight
}): Promise<Client> => {
  const baseParams = { ...defaultXMRParams, network, phrase }
  const probe = new Client({ ...baseParams, ...buildXmrClientParams({ config, network, restoreHeight: 0 }) })
  const address = probe.getAddress(0)
  probe.purgeClient()

  const oHeight = await resolveHeight({ config, network, address })
  const restoreHeight = O.getOrElse(() => 0)(oHeight)
  return new Client({ ...baseParams, ...buildXmrClientParams({ config, network, restoreHeight }) })
}

/** Client without phrase: explorer URLs only (no address / balance) */
export const createReadOnlyXmrClient = (network: Network): Client => new Client({ ...defaultXMRParams, network })
