import { HttpClient } from '@cosmjs/tendermint-rpc'
import { Network } from '@xchainjs/xchain-client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PUBLIC_LIQUIFY_THORNODE_RPC } from '../../../../shared/thorchain/const'
import { RpcHttpEndpoint, withLiquifyRpcHeaderKey } from './liquifyRpcEndpoints'

// Fake value only — never a real key.
const FAKE = 'fake-rpc-key'

const asEndpoints = (urls: string[]) => urls as unknown as Array<string | RpcHttpEndpoint>

describe('main/api/ledger/thorchain/liquifyRpcEndpoints', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('turns the public Liquify RPC into an {url, headers} endpoint on mainnet (key stays out of the URL)', () => {
    const [endpoint] = asEndpoints(withLiquifyRpcHeaderKey([PUBLIC_LIQUIFY_THORNODE_RPC], Network.Mainnet, FAKE))
    expect(endpoint).toEqual({ url: 'https://gateway.liquify.com/', headers: { 'X-API-KEY': FAKE } })
    expect(JSON.stringify((endpoint as RpcHttpEndpoint).url)).not.toContain(FAKE)
  })

  it('leaves look-alike hosts, http, custom URLs and other Liquify products untouched', () => {
    const urls = [
      'https://rpc.example.org',
      'https://gateway.liquify.com.evil.io/chain/thorchain_rpc',
      'http://gateway.liquify.com/chain/thorchain_rpc',
      'https://gateway.liquify.com/chain/thorchain_api',
      'https://rpc.thorchain.network'
    ]
    expect(withLiquifyRpcHeaderKey(urls, Network.Mainnet, FAKE)).toEqual(urls)
  })

  it('is a no-op for an empty / unsafe key', () => {
    const urls = [PUBLIC_LIQUIFY_THORNODE_RPC]
    expect(withLiquifyRpcHeaderKey(urls, Network.Mainnet, '')).toBe(urls)
    expect(withLiquifyRpcHeaderKey(urls, Network.Mainnet, undefined)).toBe(urls)
    expect(withLiquifyRpcHeaderKey(urls, Network.Mainnet, 'bad key\r\n')).toBe(urls)
  })

  it('is a no-op on non-mainnet networks', () => {
    const urls = [PUBLIC_LIQUIFY_THORNODE_RPC]
    expect(withLiquifyRpcHeaderKey(urls, Network.Stagenet, FAKE)).toBe(urls)
    expect(withLiquifyRpcHeaderKey(urls, Network.Testnet, FAKE)).toBe(urls)
  })

  it('cosmjs sends the header with the request (what the Ledger client does with the endpoint)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const [endpoint] = asEndpoints(withLiquifyRpcHeaderKey([PUBLIC_LIQUIFY_THORNODE_RPC], Network.Mainnet, FAKE))
    const client = new HttpClient(endpoint as RpcHttpEndpoint)
    await client.execute({ jsonrpc: '2.0', id: 1, method: 'health', params: {} })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://gateway.liquify.com/')
    expect(String(url)).not.toContain(FAKE)
    expect(init.headers['X-API-KEY']).toBe(FAKE)
  })
})
