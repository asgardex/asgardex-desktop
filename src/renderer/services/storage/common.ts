import equal from 'fast-deep-equal'
import { pipe } from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import * as RxOp from 'rxjs/operators'

import { CommonStorage, LastOpenedWallet } from '../../../shared/api/types'
import { DEFAULT_ARB_RPC_URLS } from '../../../shared/arb/const'
import { DEFAULT_AVAX_RPC_URLS } from '../../../shared/avax/const'
import { DEFAULT_BASE_RPC_URLS } from '../../../shared/base/const'
import { DEFAULT_BSC_RPC_URLS } from '../../../shared/bsc/const'
import { DEFAULT_EVM_GAS_MULTIPLIER } from '../../../shared/const'
import { DEFAULT_ETH_RPC_URLS } from '../../../shared/ethereum/const'
import { DEFAULT_EVM_HD_MODE } from '../../../shared/evm/types'
import { DEFAULT_LOCALE } from '../../../shared/i18n/const'
import { DEFAULT_MAYANODE_API_URLS, DEFAULT_MAYANODE_RPC_URLS } from '../../../shared/mayachain/const'
import { DEFAULT_MIDGARD_MAYA_URLS } from '../../../shared/mayaMidgard/const'
import { DEFAULT_MIDGARD_URLS } from '../../../shared/midgard/const'
import { DEFAULT_THORNODE_API_URLS, DEFAULT_THORNODE_RPC_URLS } from '../../../shared/thorchain/const'
import { KeystoreHDSettingsRecord } from '../../../shared/wallet/types'
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

const ethRpc$ = pipe(
  getStorageState$,
  RxOp.map(O.map(({ ethRpc }) => ethRpc)),
  RxOp.map(O.getOrElse(() => DEFAULT_ETH_RPC_URLS)),
  RxOp.distinctUntilChanged(equal)
)

const bscRpc$ = pipe(
  getStorageState$,
  RxOp.map(O.map(({ bscRpc }) => bscRpc)),
  RxOp.map(O.getOrElse(() => DEFAULT_BSC_RPC_URLS)),
  RxOp.distinctUntilChanged(equal)
)

const arbRpc$ = pipe(
  getStorageState$,
  RxOp.map(O.map(({ arbRpc }) => arbRpc)),
  RxOp.map(O.getOrElse(() => DEFAULT_ARB_RPC_URLS)),
  RxOp.distinctUntilChanged(equal)
)

const avaxRpc$ = pipe(
  getStorageState$,
  RxOp.map(O.map(({ avaxRpc }) => avaxRpc)),
  RxOp.map(O.getOrElse(() => DEFAULT_AVAX_RPC_URLS)),
  RxOp.distinctUntilChanged(equal)
)

const baseRpc$ = pipe(
  getStorageState$,
  RxOp.map(O.map(({ baseRpc }) => baseRpc)),
  RxOp.map(O.getOrElse(() => DEFAULT_BASE_RPC_URLS)),
  RxOp.distinctUntilChanged(equal)
)

// Last opened wallet (keystore or vultisig) for restoring on app startup
const lastOpenedWallet$ = pipe(
  getStorageState$,
  RxOp.map(O.map(({ lastOpenedWallet }) => lastOpenedWallet)),
  RxOp.map(O.getOrElse<LastOpenedWallet | undefined>(() => undefined)),
  RxOp.distinctUntilChanged(equal)
)

const evmGasMultiplier$ = pipe(
  getStorageState$,
  RxOp.map(O.map(({ evmGasMultiplier }) => evmGasMultiplier)),
  // Cast to number to work with the observable types, but the value is always a valid GasMultiplier
  RxOp.map(O.getOrElse((): number => DEFAULT_EVM_GAS_MULTIPLIER)),
  RxOp.distinctUntilChanged()
)

// Per-keystore, per-chain HD derivation selections. Absent → {} (each chain
// falls back to the default 0/0/'default' at read time).
const keystoreHDSettings$ = pipe(
  getStorageState$,
  RxOp.map(O.map(({ keystoreHDSettings }) => keystoreHDSettings ?? {})),
  RxOp.map(O.getOrElse<KeystoreHDSettingsRecord>(() => ({}))),
  RxOp.distinctUntilChanged(equal)
)

const getKeystoreHDSettings = (): KeystoreHDSettingsRecord =>
  pipe(
    getStorageState(),
    O.chain((s) => O.fromNullable(s.keystoreHDSettings)),
    O.getOrElse<KeystoreHDSettingsRecord>(() => ({}))
  )

const setKeystoreHDSettingsRecord = (keystoreHDSettings: KeystoreHDSettingsRecord): Promise<void> =>
  modifyStorage(O.some({ keystoreHDSettings }))

// Update function — returns the save promise so callers can await persistence
const modifyStorage = (oPartialData: StoragePartialState<CommonStorage>): Promise<void> =>
  pipe(
    oPartialData,
    O.map((partialData) =>
      window.apiCommonStorage.save(partialData).then((newData) => {
        setStorageState(O.some(newData))
      })
    ),
    O.getOrElse(() => Promise.resolve())
  )

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
  mayanodeRpc$,
  ethRpc$,
  bscRpc$,
  arbRpc$,
  avaxRpc$,
  baseRpc$,
  lastOpenedWallet$,
  evmGasMultiplier$,
  keystoreHDSettings$,
  getKeystoreHDSettings,
  setKeystoreHDSettingsRecord
}
