import { Network } from '@xchainjs/xchain-client'

import { sanitizeXmrConnectionConfig, XmrConnectionConfig } from './config'
import { deriveXmrViewKeys } from './derivation'
import { createLwsConfirmation, getConfirmedLws, isLwsConfirmationValid } from './lwsConfirmation'

// BIP-39 test vectors. NEVER use for funds.
const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const OTHER_PHRASE = 'legal winner thank year wave sausage worth useful legal winner thank yellow'

const URL_A = 'https://lws-a.example/secret/path'
const URL_B = 'https://lws-b.example'

const keys = (phrase = PHRASE, network = Network.Mainnet) => deriveXmrViewKeys(phrase, network)

const configWith = (lwsUrl: string, lwsConfirmation: XmrConnectionConfig['lwsConfirmation']): XmrConnectionConfig => ({
  daemonUrl: '',
  lwsUrl,
  lwsConfirmation,
  restoreHeight: null
})

describe('services/monero/lwsConfirmation', () => {
  it('an LWS without confirmation is never returned (default: opt-in + confirm)', () => {
    expect(getConfirmedLws(keys(), configWith(URL_A, null))).toBeUndefined()
    expect(getConfirmedLws(keys(), configWith('', null))).toBeUndefined()
  })

  it('a confirmation for exactly this URL, wallet and network is accepted', () => {
    const confirmation = createLwsConfirmation(keys(), URL_A)
    expect(confirmation.url).toBe(URL_A)
    expect(confirmation.tag).toMatch(/^[0-9a-f]{64}$/)
    expect(getConfirmedLws(keys(), configWith(URL_A, confirmation))?.url).toBe(URL_A)
  })

  describe('re-confirmation is required whenever the URL changes', () => {
    it('URL changed in the settings (confirmation of the old URL is kept in the object)', () => {
      const confirmation = createLwsConfirmation(keys(), URL_A)
      expect(getConfirmedLws(keys(), configWith(URL_B, confirmation))).toBeUndefined()
    })

    it('URL edited directly in storage -> sanitizing drops the confirmation -> no LWS', () => {
      const confirmation = createLwsConfirmation(keys(), URL_A)
      const stored = JSON.parse(JSON.stringify({ ...configWith(URL_A, confirmation), lwsUrl: URL_B }))
      const loaded = sanitizeXmrConnectionConfig(stored)
      expect(loaded.lwsUrl).toBe(URL_B)
      expect(loaded.lwsConfirmation).toBeNull()
      expect(getConfirmedLws(keys(), loaded)).toBeUndefined()
    })

    it('URL AND confirmation url both edited in storage, tag copied -> MAC does not match', () => {
      const confirmation = createLwsConfirmation(keys(), URL_A)
      const forged = { url: URL_B, tag: confirmation.tag }
      expect(getConfirmedLws(keys(), sanitizeXmrConnectionConfig(configWith(URL_B, forged)))).toBeUndefined()
    })

    it('a trailing slash / any byte of difference is a different URL', () => {
      const confirmation = createLwsConfirmation(keys(), URL_A)
      expect(isLwsConfirmationValid(keys(), `${URL_A}/`, { ...confirmation, url: `${URL_A}/` })).toBe(false)
      expect(isLwsConfirmationValid(keys(), URL_A, confirmation)).toBe(true)
    })
  })

  describe('bound to wallet and network', () => {
    it('not valid for another wallet', () => {
      const confirmation = createLwsConfirmation(keys(PHRASE), URL_A)
      expect(getConfirmedLws(keys(OTHER_PHRASE), configWith(URL_A, confirmation))).toBeUndefined()
    })

    it('not valid for another network', () => {
      const confirmation = createLwsConfirmation(keys(PHRASE, Network.Mainnet), URL_A)
      expect(getConfirmedLws(keys(PHRASE, Network.Stagenet), configWith(URL_A, confirmation))).toBeUndefined()
    })
  })

  it('rejects garbage tags and missing confirmations', () => {
    expect(isLwsConfirmationValid(keys(), URL_A, { url: URL_A, tag: '' })).toBe(false)
    expect(isLwsConfirmationValid(keys(), URL_A, { url: URL_A, tag: '00'.repeat(32) })).toBe(false)
    expect(isLwsConfirmationValid(keys(), URL_A, null)).toBe(false)
    expect(isLwsConfirmationValid(keys(), URL_A, undefined)).toBe(false)
    expect(isLwsConfirmationValid(keys(), '', { url: '', tag: createLwsConfirmation(keys(), '').tag })).toBe(false)
  })

  it('the tag does not contain the view key', () => {
    const k = keys()
    const tag = createLwsConfirmation(k, URL_A).tag
    const viewHex = Array.from(k.privateViewKey, (b) => b.toString(16).padStart(2, '0')).join('')
    expect(tag).not.toContain(viewHex)
  })
})
