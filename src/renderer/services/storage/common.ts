import equal from 'fast-deep-equal'
import { pipe } from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import * as RxOp from 'rxjs/operators'
import { CommonStorage } from '../../../shared/api/types'
import { DEFAULT_EVM_HD_MODE } from '../../../shared/evm/types'
import { DEFAULT_LOCALE } from '../../../shared/i18n/const'
import { DEFAULT_MAYANODE_API_URLS, DEFAULT_MAYANODE_RPC_URLS } from '../../../shared/mayachain/const'
import { DEFAULT_MIDGARD_MAYA_URLS } from '../../../shared/mayaMidgard/const'
import { DEFAULT_MIDGARD_URLS } from '../../../shared/midgard/const'
import { DEFAULT_THORNODE_API_URLS, DEFAULT_THORNODE_RPC_URLS } from '../../../shared/thorchain/const'
import { observableState } from '../../helpers/stateHelper'
import { StorageState, StoragePartialState } from './types'

// State management
const {
  get$: getStorageState$,
  get: getStorageState,
  set: setStorageState
} = observableState<StorageState<CommonStorage>>(O.none)

const locale$ = pipe(
  getStorageState$,
  RxOp.map(O.map(({ locale }) => locale)),
  RxOp.map(O.getOrElse(() => DEFAULT_LOCALE)),
  RxOp.distinctUntilChanged()
)

const evmHDMode$ = pipe(
  getStorageState$,
  RxOp.map(O.map(({ evmDerivationMode }) => evmDerivationMode)),
  RxOp.map(O.getOrElse(() => DEFAULT_EVM_HD_MODE)),
  RxOp.distinctUntilChanged()
)

const midgard$ = pipe(
  getStorageState$,
  RxOp.map(O.map(({ midgard }) => midgard)),
  RxOp.map(O.getOrElse(() => DEFAULT_MIDGARD_URLS)),
  RxOp.distinctUntilChanged(equal)
)

const midgardMaya$ = pipe(
  getStorageState$,
  RxOp.map(O.map(({ midgardMaya }) => midgardMaya)),
  RxOp.map(O.getOrElse(() => DEFAULT_MIDGARD_MAYA_URLS)),
  RxOp.distinctUntilChanged(equal)
)

const thornodeApi$ = pipe(
  getStorageState$,
  RxOp.map(O.map(({ thornodeApi }) => thornodeApi)),
  RxOp.map(O.getOrElse(() => DEFAULT_THORNODE_API_URLS)),
  RxOp.distinctUntilChanged(equal)
)

const mayanodeApi$ = pipe(
  getStorageState$,
  RxOp.map(O.map(({ mayanodeApi }) => mayanodeApi)),
  RxOp.map(O.getOrElse(() => DEFAULT_MAYANODE_API_URLS)),
  RxOp.distinctUntilChanged(equal)
)

const thornodeRpc$ = pipe(
  getStorageState$,
  RxOp.map(O.map(({ thornodeRpc }) => thornodeRpc)),
  RxOp.map(O.getOrElse(() => DEFAULT_THORNODE_RPC_URLS)),
  RxOp.distinctUntilChanged(equal)
)

const mayanodeRpc$ = pipe(
  getStorageState$,
  RxOp.map(O.map(({ mayanodeRpc }) => mayanodeRpc)),
  RxOp.map(O.getOrElse(() => DEFAULT_MAYANODE_RPC_URLS)),
  RxOp.distinctUntilChanged(equal)
)

// Update function
const modifyStorage = (oPartialData: StoragePartialState<CommonStorage>) => {
  pipe(
    oPartialData,
    O.map((partialData) =>
      window.apiCommonStorage.save(partialData).then((newData) => setStorageState(O.some(newData)))
    )
  )
}

// Initial state load
window.apiCommonStorage.get().then(
  (result) => setStorageState(O.some(result)),
  (_) => setStorageState(O.none)
)

export {
  getStorageState$,
  getStorageState,
  modifyStorage,
  locale$,
  evmHDMode$,
  midgard$,
  midgardMaya$,
  thornodeApi$,
  mayanodeApi$,
  thornodeRpc$,
  mayanodeRpc$
}
