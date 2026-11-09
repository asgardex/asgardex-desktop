/**
 * In-app confirmation of a light-wallet server (LWS).
 *
 * Why
 * ---
 * Using an LWS means the **private view key** is sent to that server (it then sees every incoming payment and amount),
 * and the registration is permanent (there is no deregister). So a server must only ever be contacted after the user
 * explicitly confirmed *that exact URL* inside the app (see `MoneroSettingsPanel`, password-gated).
 *
 * How it is bound
 * ---------------
 * A confirmation is a MAC over `network | address | url`, keyed with a secret derived from the private view key of the
 * wallet (`HMAC-SHA256(key = keccak256(domain ‖ viewKey), msg)`). It is stored next to the URL in the persisted
 * settings. Consequences:
 * - Editing `lwsUrl` in storage (or an old/foreign confirmation) leaves the confirmation invalid for the new URL
 *   -> the URL is **not used**, no view key is sent, until the user confirms again in the UI.
 * - A confirmation for one wallet/network/URL is invalid for any other.
 * - Whoever can edit storage but does not know the view key cannot forge a confirmation.
 *
 * The scanner/LWS code only accepts a `ConfirmedLws` — a value that can only be created by `getConfirmedLws`
 * after verifying the MAC — so an unconfirmed URL can't reach the network by accident.
 */
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha2'
import { keccak_256 } from '@noble/hashes/sha3'

import { bytesToHex, XmrViewKeys } from './derivation'

export type LwsConfirmation = {
  /** The exact (normalized) URL which was confirmed */
  url: string
  /** MAC (hex) binding the confirmation to wallet + network + URL */
  tag: string
}

declare const confirmedBrand: unique symbol

/** An LWS URL whose confirmation has been verified for the current wallet. Created by `getConfirmedLws` only. */
export type ConfirmedLws = { readonly url: string; readonly [confirmedBrand]: true }

const DOMAIN = new TextEncoder().encode('asgardex/xmr/lws-confirmation/v1')

const computeTag = (viewKeys: XmrViewKeys, url: string): string => {
  const key = keccak_256(Uint8Array.from([...DOMAIN, ...viewKeys.privateViewKey]))
  const message = new TextEncoder().encode(`${viewKeys.network}|${viewKeys.address}|${url}`)
  return bytesToHex(hmac(sha256, key, message))
}

/** Creates a confirmation. Call it only after the user confirmed the dialog and re-entered the password. */
export const createLwsConfirmation = (viewKeys: XmrViewKeys, url: string): LwsConfirmation => ({
  url,
  tag: computeTag(viewKeys, url)
})

const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export const isLwsConfirmationValid = (
  viewKeys: XmrViewKeys,
  url: string,
  confirmation: LwsConfirmation | null | undefined
): boolean =>
  url !== '' &&
  !!confirmation &&
  confirmation.url === url &&
  typeof confirmation.tag === 'string' &&
  constantTimeEqual(confirmation.tag, computeTag(viewKeys, url))

/**
 * Returns the LWS to use, or `undefined` when none is configured **or it is not (re-)confirmed for this exact URL**.
 */
export const getConfirmedLws = (
  viewKeys: XmrViewKeys,
  config: { lwsUrl: string; lwsConfirmation: LwsConfirmation | null }
): ConfirmedLws | undefined =>
  isLwsConfirmationValid(viewKeys, config.lwsUrl, config.lwsConfirmation)
    ? ({ url: config.lwsUrl } as ConfirmedLws)
    : undefined
