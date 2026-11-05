/**
 * Test helper: a fake Monero daemon (global `fetch`) serving ONE RingCT transaction paying `viewKeys.address`.
 * Uses real crypto, so the real `scanBlocks` of `@xchainjs/xchain-monero` finds the output with view-only keys.
 */
import { ed25519 } from '@noble/curves/ed25519'
import { keccak_256 } from '@noble/hashes/sha3'

import { XMR_H_HEX } from './commitment'
import { bytesToHex, scReduce32, XmrViewKeys } from './derivation'

const concat = (...parts: Uint8Array[]): Uint8Array => Uint8Array.from(parts.flatMap((p) => Array.from(p)))
const leBig = (b: Uint8Array): bigint => b.reduceRight((acc, v) => (acc << BigInt(8)) | BigInt(v), BigInt(0))

/** How a (malicious) node can tamper with the RingCT data of a payment */
export type TxForgery =
  /** `ecdhInfo` encrypts a bigger amount than the commitment `outPk` commits to */
  | 'inflated-ecdh'
  /** `outPk` is a commitment to another amount (ecdhInfo is the honest one) */
  | 'wrong-outpk'
  /** no `outPk` at all */
  | 'missing-outpk'
  /** pre-RingCT / old format: `rct_signatures.type` 3 and no commitments */
  | 'old-type'

export const buildPaymentTx = ({
  viewKeys,
  publicViewKeyHex,
  amount,
  forge
}: {
  viewKeys: XmrViewKeys
  publicViewKeyHex: string
  amount: bigint
  forge?: TxForgery
}) => {
  const r = leBig(keccak_256(new TextEncoder().encode('fake-tx-secret'))) % ed25519.CURVE.n
  const R = ed25519.ExtendedPoint.BASE.multiply(r)
  const A = ed25519.ExtendedPoint.fromHex(publicViewKeyHex)
  const B = ed25519.ExtendedPoint.fromHex(bytesToHex(viewKeys.publicSpendKey))
  const D = A.multiply(r).multiply(BigInt(8)).toRawBytes() // derivation 8·r·A
  const index = Uint8Array.from([0])
  const hs = scReduce32(keccak_256(concat(D, index)))
  const P = ed25519.ExtendedPoint.BASE.multiply(leBig(hs)).add(B).toRawBytes()
  const viewTag = keccak_256(concat(new TextEncoder().encode('view_tag'), D, index))[0]
  const mask = keccak_256(concat(new TextEncoder().encode('amount'), hs)).slice(0, 8)
  const amountLe = new Uint8Array(8)
  let tmp = amount
  for (let i = 0; i < 8; i++) {
    amountLe[i] = Number(tmp & BigInt(0xff))
    tmp >>= BigInt(8)
  }
  const encrypt = (value: bigint) => {
    const le = new Uint8Array(8)
    let t = value
    for (let i = 0; i < 8; i++) {
      le[i] = Number(t & BigInt(0xff))
      t >>= BigInt(8)
    }
    return le.map((v, i) => v ^ mask[i])
  }
  const enc = forge === 'inflated-ecdh' ? encrypt(amount * BigInt(10)) : amountLe.map((v, i) => v ^ mask[i])

  // Pedersen commitment C = mask·G + amount·H (mask = Hs("commitment_mask" || scalar)), built independently of the app
  const commitmentMask = leBig(scReduce32(keccak_256(concat(new TextEncoder().encode('commitment_mask'), hs))))
  const Hpoint = ed25519.ExtendedPoint.fromHex(XMR_H_HEX)
  const commitTo = (value: bigint) =>
    bytesToHex(
      ed25519.ExtendedPoint.BASE.multiply(commitmentMask)
        .add(value === BigInt(0) ? ed25519.ExtendedPoint.ZERO : Hpoint.multiply(value))
        .toRawBytes()
    )
  const outPk =
    forge === 'missing-outpk' || forge === 'old-type'
      ? []
      : [commitTo(forge === 'wrong-outpk' ? amount * BigInt(10) : amount)]

  return {
    vin: [{ key: { k_image: 'cd'.repeat(32) } }],
    extra: [1, ...Array.from(R.toRawBytes()), 0],
    vout: [{ target: { tagged_key: { key: bytesToHex(P), view_tag: viewTag.toString(16).padStart(2, '0') } } }],
    rct_signatures: {
      type: forge === 'old-type' ? 3 : 6,
      txnFee: 0,
      ecdhInfo: [{ amount: bytesToHex(enc) }],
      outPk
    }
  }
}

export type FakeDaemon = {
  fetch: ReturnType<typeof vi.fn>
  /** all requests: [url, body] */
  requests: () => Array<{ url: string; body: string; redirect?: string }>
  setTip: (tip: number) => void
}

export const createFakeDaemon = ({
  tip,
  txHeight,
  txHash = 'ab'.repeat(32),
  tx,
  omitTxBody = false,
  failRequest
}: {
  tip: number
  txHeight: number
  txHash?: string
  tx: unknown
  /** the node serves the transaction to the SDK scanner (1st `get_transactions`) but withholds it afterwards */
  omitTxBody?: boolean
  /** requests of this kind are rejected (network error): JSON-RPC method name, or `get_transactions` */
  failRequest?: 'get_block_headers_range' | 'get_block' | 'get_transactions'
}): FakeDaemon => {
  const state = { tip }
  let txCalls = 0
  const log: Array<{ url: string; body: string; redirect?: string }> = []
  const respond = (data: unknown) =>
    Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: () => Promise.resolve(data) })
  const fetchFn = vi.fn((url: string, init?: { body?: string; redirect?: string }) => {
    const body = init?.body ?? ''
    log.push({ url, body, redirect: init?.redirect })
    const parsed = body ? JSON.parse(body) : {}
    if (failRequest && (parsed.method === failRequest || url.endsWith(`/${failRequest}`))) {
      return Promise.reject(new Error('fake daemon: request failed'))
    }
    if (url.endsWith('/json_rpc')) {
      switch (parsed.method) {
        case 'get_block_count':
          return respond({ result: { count: state.tip } })
        case 'get_block_headers_range': {
          const { start_height, end_height } = parsed.params
          const headers = []
          for (let h = start_height; h <= end_height; h++) {
            headers.push({ height: h, timestamp: 1_700_000_000 + h, num_txes: h === txHeight ? 1 : 0 })
          }
          return respond({ result: { headers } })
        }
        case 'get_block':
          return respond({
            result: {
              tx_hashes: parsed.params.height === txHeight ? [txHash] : [],
              block_header: { timestamp: 1_700_000_000 + parsed.params.height }
            }
          })
        default:
          return respond({ error: { message: 'unexpected method', code: -1 } })
      }
    }
    if (url.endsWith('/get_transactions')) {
      txCalls += 1
      const withhold = omitTxBody && txCalls > 1
      return respond({
        txs: parsed.txs_hashes
          .filter((h: string) => h === txHash && !withhold)
          .map((h: string) => ({
            tx_hash: h,
            as_json: JSON.stringify(tx),
            block_height: txHeight,
            block_timestamp: 1_700_000_000 + txHeight,
            in_pool: false
          }))
      })
    }
    return Promise.reject(new Error(`unexpected request ${url}`))
  })
  return { fetch: fetchFn, requests: () => log, setTip: (t) => (state.tip = t) }
}
