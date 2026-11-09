import { Network } from '@xchainjs/xchain-client'
import { Client } from '@xchainjs/xchain-monero'

import { bytesToHex, deriveXmrExportKeys, deriveXmrViewKeys, encodeXmrAddress, XMR_DERIVATION_PATH } from './derivation'

// BIP-39 test vector. NEVER use for funds.
const TEST_PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const OTHER_PHRASE = 'legal winner thank year wave sausage worth useful legal winner thank yellow'

/**
 * Known answers for the standard test phrase. Pinned: a change here means every user's XMR address changes.
 */
const KAT_SPEND_KEY = '8f2d521d4334f4d5d174c47aacb346e7633516416fae089d74ecfd0c389a6b08'
const KAT_VIEW_KEY = '84b0087a63854856686f80596a5a1a6090795b4d1311139173262170d7e7180f'
// Cross-checked once with the independent `monero-python` library (`Seed(spend_key)` -> same address / view key).
const KAT = {
  [Network.Mainnet]: '44jKQv6ZKMd5ecLLmkNJGi7azgSptEq8ki7TFiat1TfLfdDQ1tQ7ZYa3cRh7X2uRwvLDjddWh97ajeyhR2seKSECQeDx1WR',
  [Network.Stagenet]: '54wMVm1Wxxj5ecLLmkNJGi7azgSptEq8ki7TFiat1TfLfdDQ1tQ7ZYa3cRh7X2uRwvLDjddWh97ajeyhR2seKSECQbVpqZb'
}

describe('services/monero/derivation', () => {
  it('documents the derivation path', () => {
    expect(XMR_DERIVATION_PATH).toBe("m/44'/128'/0'")
  })

  describe('known-answer address (standard BIP-39 test phrase)', () => {
    it('mainnet', () => {
      expect(deriveXmrViewKeys(TEST_PHRASE, Network.Mainnet).address).toBe(KAT[Network.Mainnet])
    })
    it('stagenet (and testnet, which maps to stagenet)', () => {
      expect(deriveXmrViewKeys(TEST_PHRASE, Network.Stagenet).address).toBe(KAT[Network.Stagenet])
      expect(deriveXmrViewKeys(TEST_PHRASE, Network.Testnet).address).toBe(KAT[Network.Stagenet])
    })
    it('private spend / view keys', () => {
      const keys = deriveXmrExportKeys(TEST_PHRASE, Network.Mainnet)
      expect(keys.privateSpendKeyHex).toBe(KAT_SPEND_KEY)
      expect(keys.privateViewKeyHex).toBe(KAT_VIEW_KEY)
      expect(keys.address).toBe(KAT[Network.Mainnet])
    })
    it('has the shape of a Monero standard address', () => {
      expect(KAT[Network.Mainnet]).toHaveLength(95)
      expect(KAT[Network.Mainnet].startsWith('4')).toBe(true)
      expect(KAT[Network.Stagenet]).toHaveLength(95)
      expect(KAT[Network.Stagenet].startsWith('5')).toBe(true)
    })
  })

  describe.each([TEST_PHRASE, OTHER_PHRASE])('matches @xchainjs/xchain-monero for %s', (phrase) => {
    it.each([Network.Mainnet, Network.Stagenet, Network.Testnet])('%s', (network) => {
      const sdk = new Client({ network, phrase } as ConstructorParameters<typeof Client>[0])
      expect(deriveXmrViewKeys(phrase, network).address).toBe(sdk.getAddress(0))
    })
  })

  it('view key = sc_reduce32(keccak256(spend)); public keys and address are consistent', () => {
    const keys = deriveXmrExportKeys(TEST_PHRASE, Network.Mainnet)
    const view = deriveXmrViewKeys(TEST_PHRASE, Network.Mainnet)
    expect(keys.address).toBe(view.address)
    expect(keys.privateViewKeyHex).toBe(bytesToHex(view.privateViewKey))
    expect(keys.publicSpendKeyHex).toBe(bytesToHex(view.publicSpendKey))
    expect(keys.privateSpendKeyHex).toHaveLength(64)
    expect(keys.privateViewKeyHex).toHaveLength(64)
    expect(
      encodeXmrAddress({
        publicSpendKey: view.publicSpendKey,
        publicViewKey: Uint8Array.from(Buffer.from(keys.publicViewKeyHex, 'hex')),
        network: Network.Mainnet
      })
    ).toBe(view.address)
  })

  it('view-only keys do not contain the private spend key', () => {
    const view = deriveXmrViewKeys(TEST_PHRASE, Network.Mainnet)
    const exported = deriveXmrExportKeys(TEST_PHRASE, Network.Mainnet)
    expect(Object.keys(view).sort()).toEqual(['address', 'network', 'privateViewKey', 'publicSpendKey'])
    expect(JSON.stringify(Object.values(view).map((v) => (v instanceof Uint8Array ? bytesToHex(v) : v)))).not.toContain(
      exported.privateSpendKeyHex
    )
  })

  it('rejects invalid phrases', () => {
    expect(() => deriveXmrViewKeys('not a valid phrase', Network.Mainnet)).toThrow()
  })
})
