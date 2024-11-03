import { TokenAsset, Chain } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import { isEqual } from 'lodash'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { UserAssetStorage } from '../../../shared/api/types'
import { ASSETS_STORAGE_DEFAULT } from '../../../shared/const'
import { eqString } from '../../helpers/fp/eq'
import { observableState } from '../../helpers/stateHelper'
import { StoragePartialState, StorageState } from './types'

// Observable state management for storage
const {
  get$: getStorageState$,
  get: getStorageState,
  set: setStorageState
} = observableState<StorageState<UserAssetStorage>>(O.none)

// Modify and persist storage state
const modifyStorage = (oPartialData: StoragePartialState<UserAssetStorage>) => {
  FP.pipe(
    oPartialData,
    O.map((partialData) => window.apiAssetStorage.save(partialData).then((newData) => setStorageState(O.some(newData))))
  )
}

// Initialize storage state from persistent storage at application start
window.apiAssetStorage.get().then(
  (result) => setStorageState(O.some(result)),
  (_) => setStorageState(O.none /* Handle any error while parsing JSON file*/)
)

// Single observable for all assets across chains
const userAssets$: Rx.Observable<TokenAsset[]> = FP.pipe(
  getStorageState$,
  RxOp.map((storageState) =>
    FP.pipe(
      storageState,
      O.map((data) => data.assets),
      O.getOrElse((): TokenAsset[] => [])
    )
  ),
  RxOp.shareReplay(1)
)
const arraysAreEqual = (a: TokenAsset[], b: TokenAsset[]) => isEqual(a, b)

// Function to get assets by chain from the userAssets$ observable
const getUserAssetsByChain$ = (chain: Chain): Rx.Observable<TokenAsset[]> =>
  userAssets$.pipe(
    RxOp.map((assets) => assets.filter((asset) => asset.chain === chain)),
    RxOp.distinctUntilChanged(arraysAreEqual), // Only emit if the array actually changes
    RxOp.shareReplay(1)
  )

// Add asset and persist only if it doesn't exist for the chain
const addAsset = (asset: TokenAsset) => {
  const savedAssets: UserAssetStorage = FP.pipe(
    getStorageState(),
    O.getOrElse(() => ASSETS_STORAGE_DEFAULT)
  )

  FP.pipe(
    savedAssets.assets,
    A.map((savedAsset) => savedAsset.symbol.toUpperCase()),
    A.elem(eqString)(asset.symbol.toUpperCase()),
    (isAssetExistsInSavedArray) => {
      if (!isAssetExistsInSavedArray) {
        const updatedAssets = [...savedAssets.assets, asset]
        modifyStorage(O.some({ assets: updatedAssets })) // Persist updated assets
      }
    }
  )
}

// Remove asset and persist only if it exists for the chain
const removeAsset = (asset: TokenAsset) => {
  const savedAssets: UserAssetStorage = FP.pipe(
    getStorageState(),
    O.getOrElse(() => ASSETS_STORAGE_DEFAULT)
  )

  FP.pipe(
    savedAssets.assets,
    A.map((savedAsset) => savedAsset.symbol),
    A.elem(eqString)(asset.symbol),
    (isAssetExistsInSavedArray) => {
      if (isAssetExistsInSavedArray) {
        const updatedAssets = FP.pipe(
          savedAssets.assets,
          A.filter((savedAsset) => savedAsset.symbol !== asset.symbol)
        )
        modifyStorage(O.some({ assets: updatedAssets })) // Persist updated assets
      }
    }
  )
}

export { getUserAssetsByChain$, addAsset, removeAsset }
