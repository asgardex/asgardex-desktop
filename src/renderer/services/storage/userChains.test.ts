import { firstValueFrom } from 'rxjs'
import { filter } from 'rxjs/operators'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UserChainStorage } from '../../../shared/api/types'
import { EnabledChain } from '../../../shared/utils/chain'
import { BTCChain, ETHChain } from '../../../shared/utils/chainIds'

const chainFile = (chains: string[]): UserChainStorage => ({
  version: '3',
  chains: chains as EnabledChain[]
})

const loadUserChains = async (
  stored: UserChainStorage,
  save: (data: Partial<UserChainStorage>) => Promise<UserChainStorage>
) => {
  window.apiChainStorage = {
    get: () => Promise.resolve(stored),
    save,
    remove: () => Promise.resolve(),
    exists: () => Promise.resolve(true)
  }
  vi.resetModules()
  const mod = await import('./userChains')
  await firstValueFrom(mod.userChainsLoaded$.pipe(filter(Boolean)))
  const chains = await firstValueFrom(mod.userChains$)
  return { chains, addChain: mod.addChain }
}

describe('userChains', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('drops XRD from an upgraded chain list and writes the filtered list once', async () => {
    const stored = chainFile([BTCChain, 'XRD', ETHChain])
    const save = vi.fn(async (partial: Partial<UserChainStorage>) => ({ ...stored, ...partial }))

    const { chains, addChain } = await loadUserChains(stored, save)

    expect(chains).toEqual([BTCChain, ETHChain])
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith({ chains: [BTCChain, ETHChain] })

    addChain('XRD')
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('leaves a supported chain list on disk', async () => {
    const stored = chainFile([BTCChain, ETHChain])
    const save = vi.fn(async (partial: Partial<UserChainStorage>) => ({ ...stored, ...partial }))

    const { chains } = await loadUserChains(stored, save)

    expect(chains).toEqual([BTCChain, ETHChain])
    expect(save).not.toHaveBeenCalled()
  })

  it('hides XRD when the cleanup write fails', async () => {
    const stored = chainFile([BTCChain, 'XRD'])
    const save = vi.fn(async () => Promise.reject(new Error('disk')))

    const { chains } = await loadUserChains(stored, save)

    expect(chains).toEqual([BTCChain])
    expect(save).toHaveBeenCalledTimes(1)
  })
})
