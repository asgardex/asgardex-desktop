/**
 * RingCT amount verification for received outputs.
 *
 * Why
 * ---
 * `scanBlocks` of `@xchainjs/xchain-monero` (0.2.9) decrypts the amount of an output from `rct_signatures.ecdhInfo`, but
 * never checks it against the output's Pedersen commitment `outPk`. A node (or anything between us and it) could
 * alter `ecdhInfo` and make an output look like any amount. Before an output is credited we therefore check, in the app:
 *
 *     C == mask·G + amount·H
 *
 * with `C = outPk[i]`, and `mask`, `amount` derived from the shared secret of the output (view key · tx public key):
 *
 *     derivation = 8·a·R                      (a = private view key, R = tx public key)
 *     scalar     = Hs(derivation ‖ varint(i)) (Hs = keccak256, reduced mod l)
 *     amount     = ecdhInfo[i].amount ⊕ keccak256("amount" ‖ scalar)[0..8]      (little endian, compact format)
 *     mask       = Hs("commitment_mask" ‖ scalar)
 *
 * What it does NOT prove: that the transaction exists on chain or is valid (ring signatures, double spends). That still
 * relies on the node, so the amount is "received, as reported by the node you use, with a consistent commitment".
 *
 * Only the compact RingCT format (rct type >= 4: Bulletproofs 2 / CLSAG / Bulletproofs+) is supported. Coinbase
 * outputs, pre-RingCT outputs and the old 32-byte `ecdhInfo` formats (types 0-3) are *not* counted: they are reported
 * as rejected ('unsupported-tx-type'), never silently as 0.
 */
import { ed25519 } from '@noble/curves/ed25519'
import { keccak_256 } from '@noble/hashes/sha3'

import { scReduce32 } from './derivation'

type Point = InstanceType<typeof ed25519.ExtendedPoint>

/**
 * Monero's second generator `H` (= 8·hash_to_point(G)). Checked against real chain data in `commitment.test.ts`
 * (sum(pseudoOuts) - sum(outPk) == fee·H for a mainnet transaction).
 */
export const XMR_H_HEX = '8b655970153799af2aeadc9ff1add0ea6c7251d54154cfa92c173a0dd39c1f94'

/** Smallest RingCT type with the compact (8 byte amount) `ecdhInfo`: RCTTypeBulletproof2 */
export const MIN_COMPACT_RCT_TYPE = 4

export type XmrRejectReason =
  /** coinbase / pre-RingCT / old `ecdhInfo` format: the amount cannot be verified, so it is not counted */
  | 'unsupported-tx-type'
  /** no `outPk` for the output */
  | 'missing-commitment'
  /** `ecdhInfo` missing or malformed, or the shared secret could not be computed */
  | 'undecryptable'
  /** `C != mask·G + amount·H` */
  | 'commitment-mismatch'
  /** the scanner's amount is not the amount we decrypted ourselves */
  | 'amount-mismatch'

export type RctSignatures = {
  type?: unknown
  ecdhInfo?: unknown
  outPk?: unknown
}

export type OutputVerification = { ok: true; amount: bigint } | { ok: false; reason: XmrRejectReason }

const CURVE_ORDER = ed25519.CURVE.n
const H: Point = ed25519.ExtendedPoint.fromHex(XMR_H_HEX)
const G: Point = ed25519.ExtendedPoint.BASE

const isHex = (v: unknown, bytes: number): v is string =>
  typeof v === 'string' && v.length === bytes * 2 && /^[0-9a-fA-F]+$/.test(v)
const hexToBytes = (hex: string): Uint8Array => Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)))

const bytesToBigIntLE = (bytes: Uint8Array): bigint =>
  bytes.reduceRight((acc, v) => (acc << BigInt(8)) | BigInt(v), BigInt(0))

/** `scalar·P`, where `scalar` may be 0 (noble rejects 0) */
const mul = (point: Point, scalar: bigint): Point => {
  const s = ((scalar % CURVE_ORDER) + CURVE_ORDER) % CURVE_ORDER
  return s === BigInt(0) ? ed25519.ExtendedPoint.ZERO : point.multiply(s)
}

const varint = (value: number): Uint8Array => {
  const out: number[] = []
  let v = value
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80)
    v = Math.floor(v / 128)
  }
  out.push(v)
  return Uint8Array.from(out)
}

const concat = (...parts: Uint8Array[]): Uint8Array => Uint8Array.from(parts.flatMap((p) => Array.from(p)))
const ascii = (s: string) => new TextEncoder().encode(s)

/** `mask·G + amount·H` */
export const commit = (mask: bigint, amount: bigint): Point => mul(G, mask).add(mul(H, amount))

/**
 * Verifies output `outputIndex` of a transaction against its commitment, and returns the amount we decrypted.
 *
 * @param privateViewKey 32 bytes, little endian scalar
 * @param txPubKey transaction public key `R` (32 bytes)
 */
export const verifyOutputCommitment = ({
  privateViewKey,
  txPubKey,
  outputIndex,
  rct
}: {
  privateViewKey: Uint8Array
  txPubKey: Uint8Array
  outputIndex: number
  rct: RctSignatures | undefined
}): OutputVerification => {
  const type = rct?.type
  if (typeof type !== 'number' || type < MIN_COMPACT_RCT_TYPE) return { ok: false, reason: 'unsupported-tx-type' }

  const outPk = Array.isArray(rct?.outPk) ? (rct?.outPk as unknown[])[outputIndex] : undefined
  if (!isHex(outPk, 32)) return { ok: false, reason: 'missing-commitment' }

  const ecdh = Array.isArray(rct?.ecdhInfo) ? (rct?.ecdhInfo as Array<{ amount?: unknown }>)[outputIndex] : undefined
  const encryptedAmount = ecdh?.amount
  if (!isHex(encryptedAmount, 8)) return { ok: false, reason: 'undecryptable' }

  let amount: bigint
  let mask: bigint
  try {
    const derivation = ed25519.ExtendedPoint.fromHex(txPubKey)
      .multiply(bytesToBigIntLE(privateViewKey))
      .multiply(BigInt(8))
      .toRawBytes()
    const scalar = scReduce32(keccak_256(concat(derivation, varint(outputIndex))))
    const xor = keccak_256(concat(ascii('amount'), scalar)).slice(0, 8)
    const enc = hexToBytes(encryptedAmount)
    amount = bytesToBigIntLE(Uint8Array.from(enc, (b, i) => b ^ xor[i]))
    mask = bytesToBigIntLE(scReduce32(keccak_256(concat(ascii('commitment_mask'), scalar))))
  } catch {
    return { ok: false, reason: 'undecryptable' }
  }

  try {
    const commitment = ed25519.ExtendedPoint.fromHex(outPk)
    if (!commit(mask, amount).equals(commitment)) return { ok: false, reason: 'commitment-mismatch' }
  } catch {
    return { ok: false, reason: 'commitment-mismatch' }
  }
  return { ok: true, amount }
}
