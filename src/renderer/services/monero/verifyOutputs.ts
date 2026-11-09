import { RctSignatures, verifyOutputCommitment, XmrRejectReason } from './commitment'
import { XmrViewKeys } from './derivation'

/** Output as found by `scanBlocks` (amount not yet verified) */
export type UnverifiedXmrOutput = {
  txHash: string
  outputIndex: number
  /** piconero, as decrypted by the SDK (not trusted) */
  amount: bigint
  height: number
  timestamp: number
  txPubKey: Uint8Array
}

export type XmrRejectedOutput = {
  txHash: string
  outputIndex: number
  height: number
  reason: XmrRejectReason
}

export type VerifiedXmrOutput = Omit<UnverifiedXmrOutput, 'txPubKey'>

export type DaemonTx = { tx_hash: string; as_json: string }
export type FetchTransactions = (daemonUrl: string, hashes: string[]) => Promise<DaemonTx[]>

const TX_BATCH = 25

/** `get_transactions` of the daemon. Redirects are an error: a node must not forward us elsewhere. */
export const fetchDaemonTransactions: FetchTransactions = async (daemonUrl, hashes) => {
  const response = await fetch(`${daemonUrl}/get_transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txs_hashes: hashes, decode_as_json: true }),
    redirect: 'error'
  })
  if (!response.ok) throw new Error('Could not load transactions from the Monero node')
  const json = (await response.json()) as { txs?: DaemonTx[] }
  return Array.isArray(json?.txs) ? json.txs : []
}

/**
 * Verifies the amounts of the outputs found by the scanner against their RingCT commitments (see `commitment.ts`).
 * Only verified outputs are returned as `verified` (with the amount *we* decrypted). Everything else is returned as
 * `rejected` with the reason; nothing is counted as 0 or credited on trust.
 *
 * Throws when the node does not return a transaction we need: the caller must treat the chunk as failed (the scan
 * height must not advance past outputs which could not be checked).
 */
export const verifyOwnedOutputs = async ({
  daemonUrl,
  viewKeys,
  outputs,
  fetchTransactions = fetchDaemonTransactions
}: {
  daemonUrl: string
  viewKeys: XmrViewKeys
  outputs: UnverifiedXmrOutput[]
  fetchTransactions?: FetchTransactions
}): Promise<{ verified: VerifiedXmrOutput[]; rejected: XmrRejectedOutput[] }> => {
  const verified: VerifiedXmrOutput[] = []
  const rejected: XmrRejectedOutput[] = []
  if (outputs.length === 0) return { verified, rejected }

  const hashes = [...new Set(outputs.map((o) => o.txHash))]
  const rctByTx = new Map<string, RctSignatures | undefined>()
  for (let i = 0; i < hashes.length; i += TX_BATCH) {
    const batch = hashes.slice(i, i + TX_BATCH)
    const txs = await fetchTransactions(daemonUrl, batch)
    for (const tx of txs) {
      if (!batch.includes(tx.tx_hash)) continue
      try {
        rctByTx.set(tx.tx_hash, (JSON.parse(tx.as_json) as { rct_signatures?: RctSignatures }).rct_signatures)
      } catch {
        throw new Error('The Monero node returned an unreadable transaction')
      }
    }
  }

  for (const o of outputs) {
    if (!rctByTx.has(o.txHash)) {
      throw new Error('The Monero node did not return a transaction needed to verify an incoming amount')
    }
    const result = verifyOutputCommitment({
      privateViewKey: viewKeys.privateViewKey,
      txPubKey: o.txPubKey,
      outputIndex: o.outputIndex,
      rct: rctByTx.get(o.txHash)
    })
    if (!result.ok) {
      rejected.push({ txHash: o.txHash, outputIndex: o.outputIndex, height: o.height, reason: result.reason })
    } else if (result.amount !== o.amount) {
      rejected.push({ txHash: o.txHash, outputIndex: o.outputIndex, height: o.height, reason: 'amount-mismatch' })
    } else {
      verified.push({
        txHash: o.txHash,
        outputIndex: o.outputIndex,
        amount: result.amount,
        height: o.height,
        timestamp: o.timestamp
      })
    }
  }
  return { verified, rejected }
}
