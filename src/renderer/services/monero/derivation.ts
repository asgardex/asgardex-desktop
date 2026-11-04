/**
 * Monero key derivation used by ASGARDEX (app code, no `@xchainjs/xchain-monero` Client involved).
 *
 * Exact scheme
 * ------------
 * 1. `seed        = BIP-39 seed of the keystore phrase` (64 bytes, empty passphrase — `getSeed` of `@xchainjs/xchain-crypto`)
 * 2. `node        = SLIP-10 (ed25519) master key of seed`, derived along `m/44'/128'/0'` (coin type 128 = Monero, hardened)
 * 3. `spend       = sc_reduce32(node.privateKey)`            — private spend key `b`   (mod ed25519 group order `l`)
 * 4. `view        = sc_reduce32(keccak256(spend))`           — private view key  `a`   (exactly as Monero does)
 * 5. `B = b·G`, `A = a·G`                                     — public spend / public view key
 * 6. `address     = base58_monero(prefix ‖ B ‖ A ‖ keccak256(prefix ‖ B ‖ A)[0..4])`
 *    prefix: mainnet `0x12` (18), stagenet `0x18` (24). Testnet maps to stagenet (Monero testnet is deprecated).
 *
 * This is the same result as `@xchainjs/xchain-monero` (pinned by a known-answer test against that SDK), but it
 * is **not** a Monero "25-word" (Electrum-style) seed: other Monero wallets will NOT derive this wallet from the
 * BIP-39 phrase. To use the funds elsewhere, export the keys (password-gated, see `MoneroSettingsPanel`) and
 * restore from keys (e.g. `monero-wallet-cli --generate-from-spend-key`).
 *
 * Only account / index `0` is supported.
 *
 * Key handling
 * ------------
 * - `deriveXmrViewKeys` returns **view-only** material (private view key + public spend key + address). It is the
 *   only thing handed to the scanner / LWS code. The private spend key never leaves this module except through
 *   `deriveXmrExportKeys`, which is only called after the user re-entered the keystore password.
 * - Consequence: outgoing spends are not detectable (key images need the private spend key) — see `scanner.ts`.
 */
import { ed25519 } from '@noble/curves/ed25519'
import { keccak_256 } from '@noble/hashes/sha3'
import { Network } from '@xchainjs/xchain-client'
import { getSeed } from '@xchainjs/xchain-crypto'
import slip10 from 'micro-key-producer/slip10.js'

/** Derivation path (hardened, account/index 0) */
export const XMR_DERIVATION_PATH = "m/44'/128'/0'"

const MAINNET_PREFIX = 0x12
const STAGENET_PREFIX = 0x18

/** Ed25519 group order `l` */
const ED25519_ORDER = ed25519.CURVE.n

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const ENCODED_BLOCK_SIZES = [0, 2, 3, 5, 6, 7, 9, 10, 11]

export type XmrViewKeys = {
  network: Network
  /** Primary address (standard address, account 0 / index 0) */
  address: string
  /** Private view key (32 bytes). Allows seeing incoming payments + amounts — not spending. */
  privateViewKey: Uint8Array
  /** Public spend key `B` (32 bytes) */
  publicSpendKey: Uint8Array
}

export type XmrExportKeys = {
  address: string
  privateSpendKeyHex: string
  privateViewKeyHex: string
  publicSpendKeyHex: string
  publicViewKeyHex: string
}

export const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

const bytesToNumberLE = (bytes: Uint8Array): bigint => {
  let value = BigInt(0)
  for (let i = bytes.length - 1; i >= 0; i--) value = (value << BigInt(8)) | BigInt(bytes[i])
  return value
}

const numberToBytesLE = (value: bigint, length: number): Uint8Array => {
  const out = new Uint8Array(length)
  let tmp = value
  for (let i = 0; i < length; i++) {
    out[i] = Number(tmp & BigInt(0xff))
    tmp >>= BigInt(8)
  }
  return out
}

/** `sc_reduce32`: little-endian 32 bytes mod `l` */
export const scReduce32 = (bytes: Uint8Array): Uint8Array => {
  if (bytes.length !== 32) throw new Error(`scReduce32 expects 32 bytes, got ${bytes.length}`)
  return numberToBytesLE(bytesToNumberLE(bytes) % ED25519_ORDER, 32)
}

/** Raw (non-clamped) scalar · G, as Monero does */
const scalarToPublicKey = (scalar: Uint8Array): Uint8Array =>
  ed25519.ExtendedPoint.BASE.multiply(bytesToNumberLE(scalar)).toRawBytes()

const encodeBlock = (data: Uint8Array): string => {
  const size = ENCODED_BLOCK_SIZES[data.length]
  let num = BigInt(0)
  for (const byte of data) num = (num << BigInt(8)) | BigInt(byte)
  const chars: string[] = new Array(size)
  for (let i = size - 1; i >= 0; i--) {
    chars[i] = ALPHABET[Number(num % BigInt(58))]
    num /= BigInt(58)
  }
  return chars.join('')
}

/** Monero flavour of base58 (8-byte blocks -> 11 chars) */
const base58Encode = (data: Uint8Array): string => {
  let out = ''
  for (let i = 0; i < data.length; i += 8) out += encodeBlock(data.slice(i, i + 8))
  return out
}

const getAddressPrefix = (network: Network): number => (network === Network.Mainnet ? MAINNET_PREFIX : STAGENET_PREFIX)

export const encodeXmrAddress = ({
  publicSpendKey,
  publicViewKey,
  network
}: {
  publicSpendKey: Uint8Array
  publicViewKey: Uint8Array
  network: Network
}): string => {
  const payload = new Uint8Array(65)
  payload[0] = getAddressPrefix(network)
  payload.set(publicSpendKey, 1)
  payload.set(publicViewKey, 33)
  const full = new Uint8Array(69)
  full.set(payload, 0)
  full.set(keccak_256(payload).slice(0, 4), 65)
  return base58Encode(full)
}

const derivePrivateSpendKey = (phrase: string): Uint8Array => {
  const seed = getSeed(phrase)
  const node = slip10.fromMasterSeed(seed).derive(XMR_DERIVATION_PATH)
  return scReduce32(node.privateKey)
}

const derivePrivateViewKey = (privateSpendKey: Uint8Array): Uint8Array => scReduce32(keccak_256(privateSpendKey))

/**
 * View-only key material for the scanner / LWS. The private spend key is derived, used for the public keys,
 * and wiped again — it is not part of the result.
 */
export const deriveXmrViewKeys = (phrase: string, network: Network): XmrViewKeys => {
  const spend = derivePrivateSpendKey(phrase)
  try {
    const privateViewKey = derivePrivateViewKey(spend)
    const publicSpendKey = scalarToPublicKey(spend)
    const publicViewKey = scalarToPublicKey(privateViewKey)
    return {
      network,
      address: encodeXmrAddress({ publicSpendKey, publicViewKey, network }),
      privateViewKey,
      publicSpendKey
    }
  } finally {
    spend.fill(0)
  }
}

/**
 * Private spend + view keys for the (password-gated) export. **Call only after the keystore password was
 * confirmed in the UI.** The result must never be logged, persisted or sent anywhere.
 */
export const deriveXmrExportKeys = (phrase: string, network: Network): XmrExportKeys => {
  const spend = derivePrivateSpendKey(phrase)
  try {
    const view = derivePrivateViewKey(spend)
    const publicSpendKey = scalarToPublicKey(spend)
    const publicViewKey = scalarToPublicKey(view)
    return {
      address: encodeXmrAddress({ publicSpendKey, publicViewKey, network }),
      privateSpendKeyHex: bytesToHex(spend),
      privateViewKeyHex: bytesToHex(view),
      publicSpendKeyHex: bytesToHex(publicSpendKey),
      publicViewKeyHex: bytesToHex(publicViewKey)
    }
  } finally {
    spend.fill(0)
  }
}
