import { Network } from '@xchainjs/xchain-client'
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('shared/thorchain Midgard Liquify auth', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('resolveMidgardUrl injects authenticated gateway URL on mainnet when key is set', async () => {
    vi.stubEnv('VITE_LIQUIFY_THORCHAIN_MIDGARD_KEY', 'THORCHAIN_MIDGARDTESTKEY')
    const { resolveMidgardUrl, PUBLIC_LIQUIFY_THORCHAIN_MIDGARD, liquifyAuthenticatedUrl } = await import('./const')

    expect(resolveMidgardUrl(PUBLIC_LIQUIFY_THORCHAIN_MIDGARD, Network.Mainnet)).toBe(
      liquifyAuthenticatedUrl('THORCHAIN_MIDGARDTESTKEY')
    )
    expect(resolveMidgardUrl('', Network.Mainnet)).toBe('https://gateway.liquify.com/api=THORCHAIN_MIDGARDTESTKEY')
  })

  it('resolveMidgardUrl leaves custom Expert URLs alone', async () => {
    vi.stubEnv('VITE_LIQUIFY_THORCHAIN_MIDGARD_KEY', 'THORCHAIN_MIDGARDTESTKEY')
    const { resolveMidgardUrl } = await import('./const')

    expect(resolveMidgardUrl('https://custom.midgard.example', Network.Mainnet)).toBe('https://custom.midgard.example')
  })

  it('resolveMidgardUrl does not inject on stagenet', async () => {
    vi.stubEnv('VITE_LIQUIFY_THORCHAIN_MIDGARD_KEY', 'THORCHAIN_MIDGARDTESTKEY')
    const { resolveMidgardUrl, PUBLIC_LIQUIFY_THORCHAIN_MIDGARD } = await import('./const')

    expect(resolveMidgardUrl(PUBLIC_LIQUIFY_THORCHAIN_MIDGARD, Network.Stagenet)).toBe(PUBLIC_LIQUIFY_THORCHAIN_MIDGARD)
  })

  it('maskMidgardUrl strips authenticated Liquify paths', async () => {
    const { maskMidgardUrl, PUBLIC_LIQUIFY_THORCHAIN_MIDGARD } = await import('./const')

    expect(maskMidgardUrl('https://gateway.liquify.com/api=THORCHAIN_MIDGARDTESTKEY')).toBe(
      PUBLIC_LIQUIFY_THORCHAIN_MIDGARD
    )
  })
})
