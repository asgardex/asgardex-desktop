import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { TrustedAddress, UserTrustedAddressStorage } from '../../../shared/api/types'
import { ADDRESS_STORAGE_DEFAULT } from '../../../shared/const'
import { eqString } from '../../helpers/fp/eq'
import { observableState } from '../../helpers/stateHelper'
import { StoragePartialState, StorageState } from './types'

const {
  get$: getStorageState$,
  get: getStorageState,
  set: setStorageState
} = observableState<StorageState<UserTrustedAddressStorage>>(O.none)

const modifyStorage = (oPartialData: StoragePartialState<UserTrustedAddressStorage>) => {
  FP.pipe(
    oPartialData,
    O.map((partialData) =>
      window.apiAddressStorage.save(partialData).then((newData) => setStorageState(O.some(newData)))
    )
  )
}

// Run at the start of application
window.apiAddressStorage.get().then(
  (result) => setStorageState(O.some(result)),
  (_) => setStorageState(O.none /* any error while parsing JSON file*/)
)

const userAddresses$: Rx.Observable<TrustedAddress[]> = FP.pipe(
  Rx.combineLatest([getStorageState$]),
  RxOp.map(([storageState]) =>
    FP.pipe(
      storageState,
      O.map((addresses) => addresses.addresses),
      O.getOrElse((): TrustedAddress[] => [])
    )
  ),
  RxOp.shareReplay(1)
)

const addAddress = (userAddress: TrustedAddress) => {
  const savedAddress: UserTrustedAddressStorage = FP.pipe(
    getStorageState(),
    O.getOrElse(() => ADDRESS_STORAGE_DEFAULT)
  )

  FP.pipe(
    savedAddress.addresses,
    A.map((savedAddress) => savedAddress.address),
    A.elem(eqString)(userAddress.address),
    (isAddressExistsInSavedArray) => {
      if (!isAddressExistsInSavedArray) {
        modifyStorage(
          O.some({
            addresses: [...savedAddress.addresses, userAddress]
          })
        )
      }
    }
  )
}

const removeAddress = (userAddress: TrustedAddress) => {
  const savedAddresses: UserTrustedAddressStorage = FP.pipe(
    getStorageState(),
    O.getOrElse(() => ADDRESS_STORAGE_DEFAULT)
  )

  FP.pipe(
    savedAddresses.addresses,
    A.map((savedAddress) => savedAddress.address),
    A.elem(eqString)(userAddress.address),
    (isAssetExistsInSavedArray) => {
      if (isAssetExistsInSavedArray) {
        modifyStorage(
          O.some({
            addresses: FP.pipe(
              savedAddresses.addresses,
              A.filter((savedAddress) => savedAddress.address !== userAddress.address)
            )
          })
        )
      }
    }
  )
}

export { userAddresses$, addAddress, removeAddress }
