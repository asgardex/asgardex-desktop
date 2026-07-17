import { Chain } from '@xchainjs/xchain-util'
import equal from 'fast-deep-equal'
import { function as FP, option as O } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS, KeystoreChainHDSettings } from '../../../shared/wallet/types'
import { getKeystoreHDSettings, keystoreHDSettings$, setKeystoreHDSettingsRecord } from '../storage/common'
import { keystoreService } from './keystore'
import { getKeystoreId } from './util'

/**
 * Keystore HD settings are scoped by keystore id so two keystore wallets don't
 * silently share a derivation selection. This service resolves the *active*
 * keystore id and exposes per-chain read/write of its settings; the raw storage
 * lives in `storage/common.ts`.
 */

// Active keystore id as a string key, or O.none when no keystore wallet is active.
const activeKeystoreIdKey$: Rx.Observable<O.Option<string>> = keystoreService.keystoreState$.pipe(
  RxOp.map((state) => FP.pipe(getKeystoreId(state), O.map(String))),
  RxOp.distinctUntilChanged(equal)
)

/**
 * Effective HD settings for a keystore chain — the active keystore's stored
 * selection, or the default (0/0/'default') when unset or no keystore is active.
 */
export const keystoreChainHDSettings$ = (chain: Chain): Rx.Observable<KeystoreChainHDSettings> =>
  Rx.combineLatest([activeKeystoreIdKey$, keystoreHDSettings$]).pipe(
    RxOp.map(([oIdKey, record]) =>
      FP.pipe(
        oIdKey,
        O.chain((idKey) => O.fromNullable(record[idKey]?.[chain])),
        O.getOrElse(() => DEFAULT_KEYSTORE_CHAIN_HD_SETTINGS)
      )
    ),
    RxOp.distinctUntilChanged(equal),
    RxOp.shareReplay({ bufferSize: 1, refCount: true })
  )

/**
 * Persist HD settings for a keystore chain under the active keystore id.
 * No-op when no keystore wallet is active.
 */
export const setKeystoreChainHDSettings = (chain: Chain, settings: KeystoreChainHDSettings): void => {
  FP.pipe(
    getKeystoreId(keystoreService.keystoreState()),
    O.map(String),
    O.map((idKey) => {
      const record = getKeystoreHDSettings()
      setKeystoreHDSettingsRecord({
        ...record,
        [idKey]: { ...(record[idKey] ?? {}), [chain]: settings }
      })
    })
  )
}
