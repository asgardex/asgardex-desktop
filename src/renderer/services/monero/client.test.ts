import { Network } from '@xchainjs/xchain-client'
import { option as O } from 'fp-ts'

import { createReadOnlyXmrClient, createXmrClient } from './client'
import { DEFAULT_XMR_CONNECTION_CONFIG } from './config'

// BIP-39 test vector (never use for funds)
const PHRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('services/monero/client', () => {
  const fetchSpy = vi.fn(() => Promise.reject(new Error('network access is not expected in this test')))
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy)
    fetchSpy.mockClear()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('derives a valid mainnet address locally, deterministically', async () => {
    const resolveHeight = vi.fn().mockResolvedValue(O.some(3_000_000))
    const client = await createXmrClient({
      phrase: PHRASE,
      network: Network.Mainnet,
      config: DEFAULT_XMR_CONNECTION_CONFIG,
      resolveHeight
    })
    const address = await client.getAddressAsync(0)
    expect(address.startsWith('4')).toBe(true)
    expect(client.validateAddress(address)).toBe(true)
    expect(client.getAddress(0)).toBe(address)

    const again = await createXmrClient({
      phrase: PHRASE,
      network: Network.Mainnet,
      config: DEFAULT_XMR_CONNECTION_CONFIG,
      resolveHeight
    })
    expect(again.getAddress(0)).toBe(address)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('derives a stagenet address on Stagenet / Testnet', async () => {
    const resolveHeight = vi.fn().mockResolvedValue(O.none)
    const client = await createXmrClient({
      phrase: PHRASE,
      network: Network.Stagenet,
      config: DEFAULT_XMR_CONNECTION_CONFIG,
      resolveHeight
    })
    expect(client.getAddress(0).startsWith('5')).toBe(true)
  })

  it('asks for the height of the derived address (resolveHeight gets the address)', async () => {
    const resolveHeight = vi.fn().mockResolvedValue(O.some(1))
    const client = await createXmrClient({
      phrase: PHRASE,
      network: Network.Mainnet,
      config: DEFAULT_XMR_CONNECTION_CONFIG,
      resolveHeight
    })
    expect(resolveHeight).toHaveBeenCalledTimes(1)
    expect(resolveHeight.mock.calls[0][0]).toMatchObject({
      network: Network.Mainnet,
      address: client.getAddress(0)
    })
  })

  it('can not send: no wallet-rpc configured, so transfer() is rejected before any request', async () => {
    const client = await createXmrClient({
      phrase: PHRASE,
      network: Network.Mainnet,
      config: DEFAULT_XMR_CONNECTION_CONFIG,
      resolveHeight: vi.fn().mockResolvedValue(O.some(1))
    })
    await expect(
      client.transfer({
        recipient: client.getAddress(0),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        amount: { amount: () => ({ toFixed: () => '1' }) } as any
      })
    ).rejects.toThrow(/wallet-rpc/i)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('the read-only client has no phrase', () => {
    const client = createReadOnlyXmrClient(Network.Mainnet)
    expect(() => client.getAddress(0)).toThrow()
    expect(client.getExplorerUrl()).toContain('xmrchain.net')
  })
})
