import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { AssetBSC } from '@xchainjs/xchain-bsc'
import { AssetETH } from '@xchainjs/xchain-ethereum'
import { assetToString } from '@xchainjs/xchain-util'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { assetFavouritesListsIO, assetFavouritesStorageIO, AssetFavouritesStorageEncoded } from '../../../shared/api/io'
import { toggleAssetInFavourites } from './assetFavourites'

const emptyLists = { testnet: [], stagenet: [], mainnet: [] }

const stored = (lists: typeof emptyLists): AssetFavouritesStorageEncoded =>
  assetFavouritesStorageIO.encode({ favourites: lists, version: '1' })

describe('toggleAssetInFavourites', () => {
  it('appends a new asset and keeps the existing order', () => {
    expect(toggleAssetInFavourites([AssetETH], AssetBTC)).toEqual([AssetETH, AssetBTC])
  })

  it('removes an asset and leaves the others in place', () => {
    expect(toggleAssetInFavourites([AssetETH, AssetBTC, AssetBSC], AssetBTC)).toEqual([AssetETH, AssetBSC])
  })

  it('removes the first asset and leaves the rest in place', () => {
    expect(toggleAssetInFavourites([AssetETH, AssetBTC], AssetETH)).toEqual([AssetBTC])
  })
})

describe('asset favourites storage', () => {
  const original = { ...window.apiAssetFavouritesStorage }

  afterEach(() => {
    window.apiAssetFavouritesStorage = { ...original }
    vi.resetModules()
  })

  const install = (storage: Partial<typeof window.apiAssetFavouritesStorage>) => {
    window.apiAssetFavouritesStorage = { ...original, ...storage }
    vi.resetModules()
  }

  it('shows the stored list and does not write it back', async () => {
    const saves: Partial<AssetFavouritesStorageEncoded>[] = []
    install({
      get: () => Promise.resolve(stored({ ...emptyLists, mainnet: [AssetBTC] })),
      save: (data) => {
        saves.push(data)
        return Promise.resolve(stored(emptyLists))
      }
    })

    const { favourites$ } = await import('./assetFavourites')
    const seen: string[][] = []
    const sub = favourites$.subscribe((assets) => seen.push(assets.map(assetToString)))
    await vi.waitUntil(() => seen.at(-1)?.[0] === assetToString(AssetBTC))

    expect(saves).toEqual([])
    sub.unsubscribe()
  })

  it('ignores a star until the list has loaded', async () => {
    let resolveGet: (value: AssetFavouritesStorageEncoded) => void = () => {}
    const getPromise = new Promise<AssetFavouritesStorageEncoded>((resolve) => {
      resolveGet = resolve
    })
    const saves: Partial<AssetFavouritesStorageEncoded>[] = []
    install({
      get: () => getPromise,
      save: (data) => {
        saves.push(data)
        return Promise.resolve(stored(emptyLists))
      }
    })

    const { toggleFavourite, favourites$ } = await import('./assetFavourites')
    const seen: string[][] = []
    const sub = favourites$.subscribe((assets) => seen.push(assets.map(assetToString)))

    toggleFavourite(AssetBSC)
    expect(saves).toEqual([])
    expect(seen.at(-1)).toEqual([])

    resolveGet(stored({ ...emptyLists, mainnet: [AssetBTC] }))
    await vi.waitUntil(() => seen.at(-1)?.[0] === assetToString(AssetBTC))
    expect(saves).toEqual([])
    sub.unsubscribe()
  })

  it('saves the list after a star', async () => {
    const saves: Partial<AssetFavouritesStorageEncoded>[] = []
    install({
      get: () => Promise.resolve(stored({ ...emptyLists, mainnet: [AssetBTC] })),
      save: (data) => {
        saves.push(data)
        return Promise.resolve(stored(emptyLists))
      }
    })

    const { toggleFavourite, favourites$ } = await import('./assetFavourites')
    const seen: string[][] = []
    const sub = favourites$.subscribe((assets) => seen.push(assets.map(assetToString)))
    await vi.waitUntil(() => seen.at(-1)?.[0] === assetToString(AssetBTC))

    toggleFavourite(AssetETH)
    await vi.waitUntil(() => saves.length === 1)
    expect(saves[0]).toEqual({
      favourites: assetFavouritesListsIO.encode({ ...emptyLists, mainnet: [AssetBTC, AssetETH] })
    })
    sub.unsubscribe()
  })

  it('does not save when the read fails', async () => {
    const saves: Partial<AssetFavouritesStorageEncoded>[] = []
    install({
      get: () => Promise.reject(new Error('disk')),
      save: (data) => {
        saves.push(data)
        return Promise.resolve(stored(emptyLists))
      }
    })

    const { toggleFavourite, favourites$ } = await import('./assetFavourites')
    const seen: string[][] = []
    const sub = favourites$.subscribe((assets) => seen.push(assets.map(assetToString)))
    await Promise.resolve()
    toggleFavourite(AssetETH)
    await Promise.resolve()

    expect(saves).toEqual([])
    expect(seen.at(-1)).toEqual([])
    sub.unsubscribe()
  })

  it('does not save when the stored payload cannot be decoded', async () => {
    const saves: Partial<AssetFavouritesStorageEncoded>[] = []
    install({
      get: () =>
        Promise.resolve({
          version: '1',
          favourites: { mainnet: [{ bad: true }] }
        } as AssetFavouritesStorageEncoded),
      save: (data) => {
        saves.push(data)
        return Promise.resolve(stored(emptyLists))
      }
    })

    const { toggleFavourite } = await import('./assetFavourites')
    await Promise.resolve()
    toggleFavourite(AssetETH)
    await Promise.resolve()

    expect(saves).toEqual([])
  })

  it('writes the latest list after an in-flight save finishes', async () => {
    let releaseFirst: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const writes: string[][] = []
    let calls = 0
    install({
      get: () => Promise.resolve(stored(emptyLists)),
      save: (data) => {
        calls += 1
        const mainnet = data.favourites?.mainnet ?? []
        const record = () => {
          writes.push([...mainnet])
          return Promise.resolve(stored(emptyLists))
        }
        return calls === 1 ? gate.then(record) : record()
      }
    })

    const { toggleFavourite, favourites$ } = await import('./assetFavourites')
    const seen: string[][] = []
    const sub = favourites$.subscribe((assets) => seen.push(assets.map(assetToString)))
    await vi.waitUntil(() => seen.length > 0)

    toggleFavourite(AssetETH)
    toggleFavourite(AssetBTC)

    await vi.waitUntil(() => calls === 1)
    expect(writes).toEqual([])

    releaseFirst()
    await vi.waitUntil(() => writes.length === 2)
    expect(writes).toEqual([[assetToString(AssetETH)], [assetToString(AssetETH), assetToString(AssetBTC)]])
    sub.unsubscribe()
  })
})
