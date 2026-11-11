/**
 * Regression: Chainflip mainnet started listing `Bsc`. `cChainToXChain` threw
 * inside AssetsTableCollapsable's render, which blanked the wallet right after
 * unlock (no error boundary). `Bsc` now maps to the app BSC chain. A chain this
 * map still does not know must be skipped the same way, without throwing.
 *
 * Renders the real `<App/>` provider tree (real services/contexts) with the
 * wallet assets view, fully OFFLINE:
 * - `@chainflip/sdk/swap` SwapSDK is replaced by a fake returning fixtures that
 *   include `Bsc` and a future, unknown chain.
 * - every outgoing socket connection and `fetch` is rejected, so the result
 *   cannot depend on network availability.
 * No wallet, keystore or secrets are involved.
 */
import net from 'node:net'

import { act, createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'

const { getAssetsSpy } = vi.hoisted(() => {
  const chainflipAssetsFixture = [
    { chain: 'Bitcoin', asset: 'BTC', symbol: 'BTC', name: 'Bitcoin', decimals: 8 },
    { chain: 'Ethereum', asset: 'ETH', symbol: 'ETH', name: 'Ether', decimals: 18 },
    {
      chain: 'Ethereum',
      asset: 'USDC',
      symbol: 'USDC',
      name: 'USDC',
      decimals: 6,
      contractAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    },
    // Chainflip BSC, mapped to the app BSC chain
    { chain: 'Bsc', asset: 'BNB', symbol: 'BNB', name: 'BNB', decimals: 18 },
    {
      chain: 'Bsc',
      asset: 'USDT',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 18,
      contractAddress: '0x55d398326f99059ff775485246999027b3197955'
    },
    // Any future chain must be skipped as well
    { chain: 'FutureChain', asset: 'FUT', symbol: 'FUT', name: 'Future', decimals: 18 }
  ]
  return { getAssetsSpy: vi.fn(async () => chainflipAssetsFixture) }
})

vi.mock('@chainflip/sdk/swap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@chainflip/sdk/swap')>()
  class FakeSwapSDK {
    constructor() {
      return new Proxy(this, {
        get: (_target, prop) => {
          if (prop === 'getAssets') return getAssetsSpy
          if (prop === 'then') return undefined
          return async () => []
        }
      })
    }
  }
  return { ...actual, SwapSDK: FakeSwapSDK }
})

// Render the real wallet assets view (the post-unlock landing route) instead of
// the routed AppView shell, which would redirect to unlock without a keystore.
vi.mock('../app/AppView', async () => {
  const { AssetsView } = await import('./AssetsView')
  return { AppView: () => createElement(AssetsView) }
})

const originalConnect = net.Socket.prototype.connect
const blockedConnections: string[] = []

beforeAll(() => {
  // Offline guard: refuse every outgoing socket connection.
  net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
    const [opts] = args as [{ host?: string; port?: number } | number]
    blockedConnections.push(typeof opts === 'object' ? `${opts.host}:${opts.port}` : String(opts))
    process.nextTick(() => this.destroy(new Error('network disabled in test')))
    return this
  } as typeof net.Socket.prototype.connect
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Promise.reject(new Error('network disabled in test')))
  )
})

afterAll(() => {
  net.Socket.prototype.connect = originalConnect
  vi.unstubAllGlobals()
})

const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 50)))

it('wallet assets view renders inside the real App providers when Chainflip lists unknown chains', async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  window.location.hash = '#/wallet/assets'

  const { App } = await import('../../App')
  const container = document.createElement('div')
  document.body.appendChild(container)
  let root: Root | undefined
  try {
    root = createRoot(container)
    await act(async () => {
      root?.render(createElement(App))
    })
    await vi.waitFor(() => expect(getAssetsSpy).toHaveBeenCalled())
    // let the Chainflip asset list propagate through getAssetsData$ into render
    for (let i = 0; i < 5; i++) await flush()

    expect(container.innerHTML.length).toBeGreaterThan(0)
  } finally {
    await act(async () => root?.unmount())
    container.remove()
  }
}, 60000)
