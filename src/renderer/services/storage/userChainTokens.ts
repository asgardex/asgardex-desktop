import { Asset } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { UserAssetStorage } from '../../../shared/api/types'
import { ASSETS_STORAGE_DEFAULT } from '../../../shared/const'
import { eqString } from '../../helpers/fp/eq'
import { observableState } from '../../helpers/stateHelper'
import { StoragePartialState, StorageState } from './types'

const {
  get$: getStorageState$,
  get: getStorageState,
  set: setStorageState
} = observableState<StorageState<UserAssetStorage>>(O.none)

const modifyStorage = (oPartialData: StoragePartialState<UserAssetStorage>) => {
  FP.pipe(
    oPartialData,
    O.map((partialData) => window.apiAssetStorage.save(partialData).then((newData) => setStorageState(O.some(newData))))
  )
}

// Run at the start of application
window.apiAssetStorage.get().then(
  (result) => setStorageState(O.some(result)),
  (_) => setStorageState(O.none /* any error while parsing JSON file*/)
)

const userAssets$: Rx.Observable<Asset[]> = FP.pipe(
  Rx.combineLatest([getStorageState$]),
  RxOp.map(([storageState]) =>
    FP.pipe(
      storageState,
      O.map((assets) => assets.assets),
      O.getOrElse((): Asset[] => [])
    )
  ),
  RxOp.shareReplay(1)
)

const addAsset = (asset: Asset) => {
  const savedAssets: UserAssetStorage = FP.pipe(
    getStorageState(),
    O.getOrElse(() => ASSETS_STORAGE_DEFAULT)
  )

  FP.pipe(
    savedAssets.assets,
    A.map((savedAsset) => savedAsset.symbol),
    A.elem(eqString)(asset.symbol),
    (isAssetExistsInSavedArray) => {
      if (!isAssetExistsInSavedArray) {
        modifyStorage(
          O.some({
            assets: [...savedAssets.assets, asset]
          })
        )
      }
    }
  )
}

const removeAsset = (asset: Asset) => {
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
        modifyStorage(
          O.some({
            assets: FP.pipe(
              savedAssets.assets,
              A.filter((savedAsset) => savedAsset.symbol !== asset.symbol)
            )
          })
        )
      }
    }
  )
}

export { userAssets$, addAsset, removeAsset }
