import { array as A, function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { UserChainStorage } from '../../../shared/api/types'
import { CHAINS_STORAGE_DEFAULT } from '../../../shared/const'
import { EnabledChain } from '../../../shared/utils/chain'
import { eqString } from '../../helpers/fp/eq'
import { observableState } from '../../helpers/stateHelper'
import { StoragePartialState, StorageState } from './types'

const {
  get$: getStorageState$,
  get: getStorageState,
  set: setStorageState
} = observableState<StorageState<UserChainStorage>>(O.none)

/** False until `apiChainStorage.get()` resolves or fails. The first `userChains$` value is `[]` either way. */
const { get$: userChainsLoaded$, set: setUserChainsLoaded } = observableState(false)

const modifyStorage = (oPartialData: StoragePartialState<UserChainStorage>) => {
  FP.pipe(
    oPartialData,
    O.map((partialData) => window.apiChainStorage.save(partialData).then((newData) => setStorageState(O.some(newData))))
  )
}

// Run at the start of application
window.apiChainStorage.get().then(
  (result) => {
    setStorageState(O.some(result))
    setUserChainsLoaded(true)
  },
  (_) => {
    setStorageState(O.none /* any error while parsing JSON file*/)
    setUserChainsLoaded(true)
  }
)

const userChains$: Rx.Observable<EnabledChain[]> = FP.pipe(
  Rx.combineLatest([getStorageState$]),
  RxOp.map(([storageState]) =>
    FP.pipe(
      storageState,
      O.map((chains) => chains.chains),
      O.getOrElse((): EnabledChain[] => [])
    )
  ),
  RxOp.shareReplay(1)
)

const addChain = (chain: string) => {
  const savedChains: UserChainStorage = FP.pipe(
    getStorageState(),
    O.getOrElse(() => CHAINS_STORAGE_DEFAULT)
  )

  FP.pipe(savedChains.chains, A.elem(eqString)(chain), (isChainExistsInSavedArray) => {
    if (!isChainExistsInSavedArray) {
      modifyStorage(O.some({ chains: [...savedChains.chains, chain] }))
    }
  })
}

const removeChain = (chain: string) => {
  const savedChains: UserChainStorage = FP.pipe(
    getStorageState(),
    O.getOrElse(() => CHAINS_STORAGE_DEFAULT)
  )

  FP.pipe(savedChains.chains, A.elem(eqString)(chain), (isChainExistsInSavedArray) => {
    // to avoid re-writing and re-firing to the initial stream
    if (isChainExistsInSavedArray) {
      modifyStorage(
        O.some({
          chains: FP.pipe(
            savedChains.chains,
            A.filter((savedChain) => savedChain !== chain)
          )
        })
      )
    }
  })
}

export { userChains$, userChainsLoaded$, addChain, removeChain }
