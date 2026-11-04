/**
 * Minimal MyMonero-compatible light-wallet server (LWS) client.
 *
 * - Only ever talks to a `ConfirmedLws` (see `lwsConfirmation.ts`), so an unconfirmed URL can't be contacted.
 * - Sends the private **view key** (never the spend key — it is not available here) to the server.
 * - Never logs or reports the URL: its path may be a secret. Errors only carry a status code / generic text.
 * - Only incoming payments are used (balance = `total_received`): the server's `total_sent` can't be verified without
 *   the spend key (key images), so it is ignored. Outgoing spends are therefore not reflected.
 */
import { baseAmount } from '@xchainjs/xchain-util'

import { bytesToHex, XmrViewKeys } from './derivation'
import { ConfirmedLws } from './lwsConfirmation'

export const XMR_DECIMAL = 12

export class XmrLwsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'XmrLwsError'
  }
}

export type LwsFetch = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

type LwsTx = {
  hash: string
  timestamp: string
  total_received: string
  height: number
  mempool?: boolean
}

const post = async (lws: ConfirmedLws, path: string, body: Record<string, unknown>, fetchFn: LwsFetch) => {
  let response: Awaited<ReturnType<LwsFetch>>
  try {
    response = await fetchFn(`${lws.url}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  } catch {
    // The underlying error can contain the URL -> replaced by a generic one
    throw new XmrLwsError('Could not reach the Monero light-wallet server')
  }
  if (!response.ok) throw new XmrLwsError(`Monero light-wallet server error (HTTP ${response.status})`)
  try {
    return await response.json()
  } catch {
    throw new XmrLwsError('Invalid response of the Monero light-wallet server')
  }
}

const credentials = (viewKeys: XmrViewKeys) => ({
  address: viewKeys.address,
  view_key: bytesToHex(viewKeys.privateViewKey)
})

/** Registers the address at the server (permanent) — only call for a confirmed server */
export const lwsLogin = (
  lws: ConfirmedLws,
  viewKeys: XmrViewKeys,
  fetchFn: LwsFetch = fetch as unknown as LwsFetch
): Promise<unknown> =>
  post(lws, '/login', { ...credentials(viewKeys), create_account: true, generated_locally: false }, fetchFn)

const toBigInt = (value: unknown): bigint => {
  if (typeof value !== 'string' || !/^\d+$/.test(value))
    throw new XmrLwsError('Invalid amount of the light-wallet server')
  return BigInt(value)
}

/** Total received (piconero) */
export const lwsGetTotalReceived = async (
  lws: ConfirmedLws,
  viewKeys: XmrViewKeys,
  fetchFn: LwsFetch = fetch as unknown as LwsFetch
): Promise<bigint> => {
  const info = (await post(lws, '/get_address_info', credentials(viewKeys), fetchFn)) as { total_received?: unknown }
  return toBigInt(info?.total_received)
}

export type LwsIncomingTx = { hash: string; date: Date; amount: ReturnType<typeof baseAmount>; height: number }

/** Confirmed incoming transactions, newest first */
export const lwsGetIncomingTxs = async (
  lws: ConfirmedLws,
  viewKeys: XmrViewKeys,
  fetchFn: LwsFetch = fetch as unknown as LwsFetch
): Promise<LwsIncomingTx[]> => {
  const result = (await post(lws, '/get_address_txs', credentials(viewKeys), fetchFn)) as { transactions?: LwsTx[] }
  return (result?.transactions ?? [])
    .filter((tx) => !tx.mempool && tx.height > 0 && toBigInt(tx.total_received) > BigInt(0))
    .sort((a, b) => b.height - a.height)
    .map((tx) => ({
      hash: tx.hash,
      date: new Date(tx.timestamp),
      amount: baseAmount(toBigInt(tx.total_received).toString(), XMR_DECIMAL),
      height: tx.height
    }))
}
