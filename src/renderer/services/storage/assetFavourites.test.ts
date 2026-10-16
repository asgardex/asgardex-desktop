import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { AssetBSC } from '@xchainjs/xchain-bsc'
import { Network } from '@xchainjs/xchain-client'
import { AssetETH } from '@xchainjs/xchain-ethereum'
import { assetToString } from '@xchainjs/xchain-util'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { assetFavouritesListsIO, assetFavouritesStorageIO, AssetFavouritesStorageEncoded } from '../../../shared/api/io'
import {
  applyFavouriteChanges,
  createSaveQueue,
  toggleAssetInFavourites,
  type FavouriteChange
} from './assetFavourites'

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

describe('applyFavouriteChanges', () => {
  const base = { ...emptyLists, mainnet: [AssetBTC], testnet: [AssetETH] }

  it('appends a star onto the stored list', () => {
    const changes: FavouriteChange[] = [{ network: Network.Mainnet, asset: AssetETH, added: true }]
    expect(applyFavouriteChanges(base, changes).mainnet).toEqual([AssetBTC, AssetETH])
    expect(applyFavouriteChanges(base, changes).testnet).toEqual([AssetETH])
  })

  it('keeps a stored star when the click only repeated an add', () => {
    const changes: FavouriteChange[] = [{ network: Network.Mainnet, asset: AssetBTC, added: true }]
    expect(applyFavouriteChanges(base, changes).mainnet).toEqual([AssetBTC])
  })

  it('applies an add and a later remove in order', () => {
    const changes: FavouriteChange[] = [
      { network: Network.Mainnet, asset: AssetETH, added: true },
      { network: Network.Mainnet, asset: AssetETH, added: false }
    ]
    expect(applyFavouriteChanges(base, changes).mainnet).toEqual([AssetBTC])
  })
})

describe('createSaveQueue', () => {
  it('runs the next save only after the previous one settles', async () => {
    const enqueue = createSaveQueue()
    const order: string[] = []
    let releaseFirst: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    enqueue(async () => {
      order.push('a-start')
      await gate
      order.push('a-end')
    })
    enqueue(async () => {
      order.push('b')
    })

    await vi.waitUntil(() => order.includes('a-start'))
    expect(order).toEqual(['a-start'])

    releaseFirst()
    await vi.waitUntil(() => order.at(-1) === 'b')
    expect(order).toEqual(['a-start', 'a-end', 'b'])
  })

  it('runs the next save when the previous one fails', async () => {
    const enqueue = createSaveQueue()
    const order: string[] = []
    enqueue(() => Promise.reject(new Error('disk')))
    enqueue(async () => {
      order.push('b')
    })
    await vi.waitUntil(() => order.length === 1)
    expect(order).toEqual(['b'])
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

  it('replays a star made before load onto the stored lists', async () => {
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
    expect(seen.at(-1)).toEqual([assetToString(AssetBSC)])

    resolveGet(stored({ ...emptyLists, mainnet: [AssetBTC], testnet: [AssetETH] }))
    await vi.waitUntil(() => saves.length === 1)

    expect(seen.at(-1)).toEqual([assetToString(AssetBTC), assetToString(AssetBSC)])
    expect(saves[0]).toEqual({
      favourites: assetFavouritesListsIO.encode({
        ...emptyLists,
        mainnet: [AssetBTC, AssetBSC],
        testnet: [AssetETH]
      })
    })
    sub.unsubscribe()
  })

  it('does not remove a stored star that was starred again before load', async () => {
    let resolveGet: (value: AssetFavouritesStorageEncoded) => void = () => {}
    const getPromise = new Promise<AssetFavouritesStorageEncoded>((resolve) => {
      resolveGet = resolve
    })
    install({
      get: () => getPromise,
      save: (data) => Promise.resolve({ ...stored(emptyLists), ...data })
    })

    const { toggleFavourite, favourites$ } = await import('./assetFavourites')
    const seen: string[][] = []
    const sub = favourites$.subscribe((assets) => seen.push(assets.map(assetToString)))

    toggleFavourite(AssetBTC)
    resolveGet(stored({ ...emptyLists, mainnet: [AssetBTC, AssetETH] }))
    await vi.waitUntil(() => seen.at(-1)?.length === 2)

    expect(seen.at(-1)).toEqual([assetToString(AssetBTC), assetToString(AssetETH)])
    sub.unsubscribe()
  })

  it('saves a star made before a failed load', async () => {
    let rejectGet: (reason: Error) => void = () => {}
    const getPromise = new Promise<AssetFavouritesStorageEncoded>((_, reject) => {
      rejectGet = reject
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

    toggleFavourite(AssetETH)
    rejectGet(new Error('disk'))
    await vi.waitUntil(() => saves.length === 1)

    expect(seen.at(-1)).toEqual([assetToString(AssetETH)])
    expect(saves[0]).toEqual({
      favourites: assetFavouritesListsIO.encode({ ...emptyLists, mainnet: [AssetETH] })
    })
    sub.unsubscribe()
  })

  it('does not save when the load arrives with no clicks', async () => {
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

  it('writes a later toggle only after the earlier save finishes', async () => {
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

    const { toggleFavourite } = await import('./assetFavourites')
    toggleFavourite(AssetETH)
    toggleFavourite(AssetBTC)

    await vi.waitUntil(() => calls === 1)
    expect(writes).toEqual([])

    releaseFirst()
    await vi.waitUntil(() => writes.length === 2)
    expect(writes).toEqual([[assetToString(AssetETH)], [assetToString(AssetETH), assetToString(AssetBTC)]])
  })
})
