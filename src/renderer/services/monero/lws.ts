/**
 * Minimal MyMonero-compatible light-wallet server (LWS) client.
 *
 * - Only ever talks to a `ConfirmedLws` (see `lwsConfirmation.ts`), so an unconfirmed URL can't be contacted.
 * - Sends the private **view key** (never the spend key — it is not available here) to the server.
 * - Never logs or reports the URL: its path may be a secret. Errors only carry a status code / generic text.
 * - Balance: `total_received` only (as reported by the server, unverified). `total_sent` is NOT subtracted: without the
 *   spend key the server cannot tell real spends from decoys (ring members), so its number may be far off. It is only
 *   returned separately (`serverReportedSpent`) so the UI can show it on its own, clearly labelled and unverified.
 * - All requests use `redirect: 'error'`: a server must not forward the view key to another host.
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
  init: { method: string; headers: Record<string, string>; body: string; redirect: 'error' }
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
      body: JSON.stringify(body),
      redirect: 'error'
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

export type LwsBalance = {
  /** piconero */
  received: bigint
  /**
   * piconero "spent" as reported by the server (`total_sent`); `undefined` = not reported. NOT verifiable here and
   * may include decoys: must never be subtracted from `received`.
   */
  serverReportedSpent: bigint | undefined
}

/** Received amount of the address, and the spends the server claims (shown separately, never subtracted) */
export const lwsGetBalance = async (
  lws: ConfirmedLws,
  viewKeys: XmrViewKeys,
  fetchFn: LwsFetch = fetch as unknown as LwsFetch
): Promise<LwsBalance> => {
  const info = (await post(lws, '/get_address_info', credentials(viewKeys), fetchFn)) as {
    total_received?: unknown
    total_sent?: unknown
  }
  const received = toBigInt(info?.total_received)
  const serverReportedSpent =
    info?.total_sent === undefined || info.total_sent === null ? undefined : toBigInt(info.total_sent)
  return { received, serverReportedSpent }
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
