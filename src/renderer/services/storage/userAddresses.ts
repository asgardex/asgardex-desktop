import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { TrustedAddress, UserTrustedAddressStorage } from '../../../shared/api/types'
import { ADDRESS_STORAGE_DEFAULT } from '../../../shared/const'
import { eqChain, eqString } from '../../helpers/fp/eq'
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

const sameEntry = (saved: TrustedAddress, next: TrustedAddress) =>
  eqChain.equals(saved.chain, next.chain) && eqString.equals(saved.address, next.address)

/** Returns false when this chain and address are already stored together. */
const addAddress = (userAddress: TrustedAddress): boolean => {
  const savedAddress: UserTrustedAddressStorage = FP.pipe(
    getStorageState(),
    O.getOrElse(() => ADDRESS_STORAGE_DEFAULT)
  )

  const alreadySaved = savedAddress.addresses.some((saved) => sameEntry(saved, userAddress))
  if (alreadySaved) return false

  modifyStorage(
    O.some({
      addresses: [...savedAddress.addresses, userAddress]
    })
  )
  return true
}

const removeAddress = (userAddress: TrustedAddress) => {
  const savedAddresses: UserTrustedAddressStorage = FP.pipe(
    getStorageState(),
    O.getOrElse(() => ADDRESS_STORAGE_DEFAULT)
  )

  if (!savedAddresses.addresses.some((saved) => sameEntry(saved, userAddress))) return

  modifyStorage(
    O.some({
      addresses: savedAddresses.addresses.filter((saved) => !sameEntry(saved, userAddress))
    })
  )
}

export { userAddresses$, addAddress, removeAddress }
