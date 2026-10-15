import { AnyAsset } from '@xchainjs/xchain-util'
import { function as FP, array as A, either as E, taskEither as TE } from 'fp-ts'
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

const {
  get$: favouritesByNetwork$,
  get: favouritesByNetwork,
  set: setFavourites
} = observableState<AssetFavouritesLists>(DEFAULT_FAVOURITES)

/**
 * Append a new favourite. Remove an existing one and leave the others in place.
 * The first asset starred stays first.
 */
export const toggleAssetInFavourites = (favourites: AnyAsset[], asset: AnyAsset): AnyAsset[] =>
  A.elem(eqAsset)(asset)(favourites)
    ? favourites.filter((item) => !eqAsset.equals(item, asset))
    : [...favourites, asset]

const updateStorage = (favourites: AssetFavouritesLists) => {
  FP.pipe(favourites, assetFavouritesListsIO.encode, (encoded) => {
    return TE.tryCatch(
      () => window.apiAssetFavouritesStorage.save({ favourites: encoded }),
      (reason) => Error(String(reason))
    )()
  })
}

window.apiAssetFavouritesStorage.get().then((result) =>
  FP.pipe(
    result,
    assetFavouritesStorageIO.decode,
    E.map(({ favourites }) => setFavourites(favourites))
  )
)

const favourites$: Rx.Observable<AnyAsset[]> = FP.pipe(
  Rx.combineLatest([network$, favouritesByNetwork$]),
  RxOp.map(([network, state]) => state[network]),
  RxOp.shareReplay(1)
)

const toggleFavourite = (asset: AnyAsset) => {
  const network = getCurrentNetworkState()
  const current = favouritesByNetwork()
  const updated: AssetFavouritesLists = {
    ...current,
    [network]: toggleAssetInFavourites(current[network], asset)
  }
  updateStorage(updated)
  setFavourites(updated)
}

export { favourites$, toggleFavourite }
