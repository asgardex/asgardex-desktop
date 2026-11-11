import { describe, expect, it } from 'vitest'

import { migrateNineRealmsUrls } from './fileStore'

describe('migrateNineRealmsUrls', () => {
  it('rewrites retired thorchain.network hosts to Liquify', () => {
    const stored = {
      midgard: {
        mainnet: 'https://midgard.thorchain.network',
        stagenet: '',
        testnet: 'https://testnet.midgard.thorchain.info'
      },
      thornodeApi: { mainnet: 'https://thornode.thorchain.network' },
      thornodeRpc: { mainnet: 'https://rpc.thorchain.network' }
    }

    const { data, changed } = migrateNineRealmsUrls(stored)

    expect(changed).toBe(true)
    expect(data.midgard.mainnet).toBe('https://gateway.liquify.com/chain/thorchain_midgard')
    expect(data.midgard.testnet).toBe('https://testnet.midgard.thorchain.info')
    expect(data.thornodeApi.mainnet).toBe('https://gateway.liquify.com/chain/thorchain_api')
    expect(data.thornodeRpc.mainnet).toBe('https://gateway.liquify.com/chain/thorchain_rpc')
  })

  it('leaves a Liquify config untouched', () => {
    const stored = {
      midgard: { mainnet: 'https://gateway.liquify.com/chain/thorchain_midgard' }
    }

    expect(migrateNineRealmsUrls(stored)).toEqual({ data: stored, changed: false })
  })
})
