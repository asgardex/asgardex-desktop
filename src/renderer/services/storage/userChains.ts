import { array as A, function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { UserChainStorage } from '../../../shared/api/types'
import { CHAINS_STORAGE_DEFAULT } from '../../../shared/const'
import { EnabledChain, isSupportedChain } from '../../../shared/utils/chain'
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

/** Chain ids this build still understands. Disk can contain retired ones such as XRD. */
const supportedChains = (chains: readonly string[]): EnabledChain[] => chains.filter(isSupportedChain)

const publishChains = (storage: UserChainStorage) => {
  setStorageState(O.some({ ...storage, chains: supportedChains(storage.chains) }))
  setUserChainsLoaded(true)
}

// Run at the start of application.
// The chain file stays on storage version 3, so an upgraded install still has its old list.
// Drop retired ids before the list is published, and write that list back once.
window.apiChainStorage.get().then(
  (result) => {
    const chains = supportedChains(result.chains)
    if (chains.length === result.chains.length) {
      publishChains(result)
      return
    }

    window.apiChainStorage.save({ chains }).then(
      (saved) => publishChains(saved),
      () => publishChains({ ...result, chains })
    )
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
      O.map((storage) => supportedChains(storage.chains)),
      O.getOrElse((): EnabledChain[] => [])
    )
  ),
  RxOp.shareReplay(1)
)

const savedChainStorage = (): UserChainStorage =>
  FP.pipe(
    getStorageState(),
    O.map((storage) => ({ ...storage, chains: supportedChains(storage.chains) })),
    O.getOrElse(() => CHAINS_STORAGE_DEFAULT)
  )

const addChain = (chain: string) => {
  if (!isSupportedChain(chain)) return

  const savedChains = savedChainStorage()

  FP.pipe(savedChains.chains, A.elem(eqString)(chain), (isChainExistsInSavedArray) => {
    if (!isChainExistsInSavedArray) {
      modifyStorage(O.some({ chains: [...savedChains.chains, chain] }))
    }
  })
}

const removeChain = (chain: string) => {
  const savedChains = savedChainStorage()

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
