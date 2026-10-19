import { AnyAsset } from '@xchainjs/xchain-util'
import { function as FP, array as A, either as E } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { assetFavouritesListsIO, assetFavouritesStorageIO, AssetFavouritesLists } from '../../../shared/api/io'
import { eqAsset } from '../../helpers/fp/eq'
import { observableState } from '../../helpers/stateHelper'
import { getCurrentNetworkState, network$ } from '../app/service'

const DEFAULT_FAVOURITES: AssetFavouritesLists = {
  testnet: [],
  stagenet: [],
  mainnet: []
}

const { get$: favouritesByNetwork$, set: setFavourites } = observableState<AssetFavouritesLists>(DEFAULT_FAVOURITES)

/**
 * Append a new favourite. Remove an existing one and leave the others in place.
 * The first asset starred stays first.
 */
export const toggleAssetInFavourites = (favourites: AnyAsset[], asset: AnyAsset): AnyAsset[] => {
  const exists = A.elem(eqAsset)(asset)(favourites)
  return exists ? favourites.filter((item) => !eqAsset.equals(item, asset)) : [...favourites, asset]
}

/** Null until a read succeeds. A failed read is not a list we are allowed to save. */
let known: AssetFavouritesLists | null = null
let saveInFlight = false

const saveKnown = () => {
  if (known === null || saveInFlight) return
  saveInFlight = true
  const snapshot = known
  window.apiAssetFavouritesStorage.save({ favourites: assetFavouritesListsIO.encode(snapshot) }).then(
    () => {
      saveInFlight = false
      if (known !== snapshot) saveKnown()
    },
    () => {
      saveInFlight = false
      if (known !== snapshot) saveKnown()
    }
  )
}

window.apiAssetFavouritesStorage.get().then(
  (result) => {
    FP.pipe(
      result,
      assetFavouritesStorageIO.decode,
      E.fold(
        () => undefined,
        ({ favourites }) => {
          known = favourites
          setFavourites(favourites)
        }
      )
    )
  },
  () => undefined
)

const favourites$: Rx.Observable<AnyAsset[]> = FP.pipe(
  Rx.combineLatest([network$, favouritesByNetwork$]),
  RxOp.map(([network, state]) => state[network]),
  RxOp.shareReplay(1)
)

const toggleFavourite = (asset: AnyAsset) => {
  if (known === null) return
  const network = getCurrentNetworkState()
  known = {
    ...known,
    [network]: toggleAssetInFavourites(known[network], asset)
  }
  setFavourites(known)
  saveKnown()
}

export { favourites$, toggleFavourite }
