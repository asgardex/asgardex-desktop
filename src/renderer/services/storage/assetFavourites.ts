import { Network } from '@xchainjs/xchain-client'
import { AnyAsset } from '@xchainjs/xchain-util'
import { function as FP, array as A, either as E } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { assetFavouritesListsIO, assetFavouritesStorageIO, AssetFavouritesLists } from '../../../shared/api/io'
import { eqAsset } from '../../helpers/fp/eq'
import { logger } from '../../helpers/logger'
import { observableState } from '../../helpers/stateHelper'
import { getCurrentNetworkState, network$ } from '../app/service'

const DEFAULT_FAVOURITES: AssetFavouritesLists = {
  testnet: [],
  stagenet: [],
  mainnet: []
}

const {
  get$: favouritesByNetwork$,
  get: favouritesByNetwork,
  set: setFavourites
} = observableState<AssetFavouritesLists>(DEFAULT_FAVOURITES)

export type FavouriteChange = {
  network: Network
  asset: AnyAsset
  /** True when this click added the asset. */
  added: boolean
}

/**
 * Add appends once. Remove drops a match. Repeating either leaves the list as it is.
 */
export const applyFavouriteChange = (favourites: AnyAsset[], asset: AnyAsset, added: boolean): AnyAsset[] => {
  const exists = A.elem(eqAsset)(asset)(favourites)
  if (added) return exists ? favourites : [...favourites, asset]
  return exists ? favourites.filter((item) => !eqAsset.equals(item, asset)) : favourites
}

/** Replay clicks that happened before the file loaded onto the stored lists. */
export const applyFavouriteChanges = (
  lists: AssetFavouritesLists,
  changes: readonly FavouriteChange[]
): AssetFavouritesLists =>
  changes.reduce(
    (acc, change) => ({
      ...acc,
      [change.network]: applyFavouriteChange(acc[change.network], change.asset, change.added)
    }),
    lists
  )

/**
 * Append a new favourite. Remove an existing one and leave the others in place.
 * The first asset starred stays first.
 */
export const toggleAssetInFavourites = (favourites: AnyAsset[], asset: AnyAsset): AnyAsset[] =>
  applyFavouriteChange(favourites, asset, !A.elem(eqAsset)(asset)(favourites))

/**
 * Run each save after the previous one settles, so an older write cannot finish last.
 * A failed save does not block the next one.
 */
export const createSaveQueue = () => {
  let pending: Promise<void> = Promise.resolve()
  return (save: () => Promise<unknown>): void => {
    pending = pending
      .catch(() => undefined)
      .then(save)
      .then(
        () => undefined,
        () => undefined
      )
  }
}

const enqueueSave = createSaveQueue()

const updateStorage = (favourites: AssetFavouritesLists) => {
  const encoded = assetFavouritesListsIO.encode(favourites)
  enqueueSave(() => window.apiAssetFavouritesStorage.save({ favourites: encoded }))
}

let hydrated = false
/**
 * True only after the stored file was read and decoded. If the read fails, the stars
 * still work for this session but are never written. Saving would replace the lists of
 * every network with what is in memory and wipe the user's file.
 */
let canSave = false
const pendingChanges: FavouriteChange[] = []

const finishHydration = (stored: AssetFavouritesLists, loaded: boolean) => {
  const changes = pendingChanges.splice(0, pendingChanges.length)
  const merged = applyFavouriteChanges(stored, changes)
  // Ready before publish, and the snapshot is queued first. A subscriber that toggles
  // inside set() then appends a newer save instead of being left in the pending list.
  hydrated = true
  canSave = loaded
  if (canSave && changes.length > 0) updateStorage(merged)
  setFavourites(merged)
}

const failHydration = (reason: string) => {
  logger.warn(`Asset favourites could not be loaded (${reason}). Stars will not be saved this session.`)
  finishHydration(favouritesByNetwork(), false)
}

window.apiAssetFavouritesStorage.get().then(
  (result) => {
    FP.pipe(
      result,
      assetFavouritesStorageIO.decode,
      E.fold(
        () => failHydration('decode failed'),
        ({ favourites }) => finishHydration(favourites, true)
      )
    )
  },
  () => failHydration('read failed')
)

const favourites$: Rx.Observable<AnyAsset[]> = FP.pipe(
  Rx.combineLatest([network$, favouritesByNetwork$]),
  RxOp.map(([network, state]) => state[network]),
  RxOp.shareReplay(1)
)

const toggleFavourite = (asset: AnyAsset) => {
  const network = getCurrentNetworkState()
  const current = favouritesByNetwork()
  const added = !A.elem(eqAsset)(asset)(current[network])
  const updated: AssetFavouritesLists = {
    ...current,
    [network]: applyFavouriteChange(current[network], asset, added)
  }
  setFavourites(updated)
  if (!hydrated) {
    pendingChanges.push({ network, asset, added })
    return
  }
  if (canSave) updateStorage(updated)
}

export { favourites$, toggleFavourite }
