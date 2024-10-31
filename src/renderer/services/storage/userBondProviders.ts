import { Network } from '@xchainjs/xchain-client'
import { Address } from '@xchainjs/xchain-util'
import * as A from 'fp-ts/Array'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { UserBondProvidersStorage } from '../../../shared/api/types'
import { USER_BOND_PROVIDERS_STORAGE_DEFAULT } from '../../../shared/const'
import { eqString } from '../../helpers/fp/eq'
import { observableState } from '../../helpers/stateHelper'
import { network$ } from '../app/service'
import { StoragePartialState, StorageState } from './types'

const {
  get$: getStorageState$,
  get: getStorageState,
  set: setStorageState
} = observableState<StorageState<UserBondProvidersStorage>>(O.none)

const modifyStorage = (oPartialData: StoragePartialState<UserBondProvidersStorage>) => {
  FP.pipe(
    oPartialData,
    O.map((partialData) =>
      window.apiUserBondProvidersStorage.save(partialData).then((newData) => setStorageState(O.some(newData)))
    )
  )
}

// Run at the start of application
window.apiUserBondProvidersStorage.get().then(
  (result) => setStorageState(O.some(result)),
  (_) => setStorageState(O.none /* any error while parsing JSON file*/)
)

const userBondProviders$: Rx.Observable<Address[]> = FP.pipe(
  Rx.combineLatest([network$, getStorageState$]),
  RxOp.map(([network, storageState]) =>
    FP.pipe(
      storageState,
      O.map((userBondProviders) => userBondProviders[network]),
      O.getOrElse((): Address[] => [])
    )
  ),
  RxOp.shareReplay(1)
)

const addBondProvidersAddress = (bondProviders: Address, network: Network) => {
  const savedBondProviders: UserBondProvidersStorage = FP.pipe(
    getStorageState(),
    O.getOrElse(() => USER_BOND_PROVIDERS_STORAGE_DEFAULT)
  )

  FP.pipe(savedBondProviders[network], A.elem(eqString)(bondProviders), (isBondProvidersExistsInSavedArray) => {
    if (!isBondProvidersExistsInSavedArray) {
      modifyStorage(O.some({ ...savedBondProviders, [network]: [...savedBondProviders[network], bondProviders] }))
    }
  })
}

const removeBondProvidersByAddress = (bondProviders: Address, network: Network) => {
  const savedBondProviders: UserBondProvidersStorage = FP.pipe(
    getStorageState(),
    O.getOrElse(() => USER_BOND_PROVIDERS_STORAGE_DEFAULT)
  )

  FP.pipe(savedBondProviders[network], A.elem(eqString)(bondProviders), (isBondProvidersExistsInSavedArray) => {
    // to avoid re-writing and re-firing to the initial stream
    if (isBondProvidersExistsInSavedArray) {
      modifyStorage(
        O.some({
          ...savedBondProviders,
          [network]: FP.pipe(
            savedBondProviders[network],
            A.filter((savedBondProviders) => savedBondProviders !== bondProviders)
          )
        })
      )
    }
  })
}

export { userBondProviders$, addBondProvidersAddress, removeBondProvidersByAddress }
