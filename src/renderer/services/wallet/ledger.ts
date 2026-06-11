import * as RD from '@devexperts/remote-data-ts'
import { BTCChain } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { Chain } from '@xchainjs/xchain-util'
import { array as A, function as FP, option as O, number as N } from 'fp-ts'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { KeystoreId, LedgerErrorId } from '../../../shared/api/types'
import { LEDGER_IPC_TIMEOUT_MS } from '../../../shared/const'
import { isError } from '../../../shared/utils/guard'
import { HDMode, WalletAddress, WalletType } from '../../../shared/wallet/types'
import { eqChain, eqKeystoreId, eqNetwork, eqOLedgerAddress } from '../../helpers/fp/eq'
import { liveData } from '../../helpers/rx/liveData'
import { observableState, triggerStream } from '../../helpers/stateHelper'
import { Network$ } from '../app/types'
import { INITIAL_LEDGER_ADDRESSES } from './const'
import {
  GetLedgerAddressHandler,
  GetLedgerAddressesHandler,
  KeystoreState$,
  LedgerAddresses,
  LedgerService,
  VerifyLedgerAddressHandler,
  AddLedgerAddressHandler,
  RemoveLedgerAddressHandler,
  isKeystoreUnlocked,
  KeystoreWalletsUI$,
  RemovedKeystoreId$,
  LedgerAddress,
  LedgerAddressesLD
} from './types'
import { fromIPCLedgerAddressesIO, toIPCLedgerAddressesIO } from './util'

/**
 * Backwards-compatible HDMode normalization for Ledger Bitcoin entries. Legacy
 * Ledger BTC addresses persisted before the multi-derivation UI may carry
 * `hdMode: 'default'`; the modern UI writes `'p2wpkh'`. Treat them as equivalent
 * so the dedup / remove / filter logic doesn't double-count or strand old data.
 */
export const normalizeHDMode = (chain: Chain, hdMode: HDMode): HDMode =>
  eqChain.equals(chain, BTCChain) && hdMode === 'default' ? 'p2wpkh' : hdMode

type EntryKey = { chain: Chain; network: Network; keystoreId: KeystoreId; hdMode: HDMode }

const sameLedgerEntry = (a: EntryKey, b: EntryKey): boolean =>
  eqKeystoreId.equals(a.keystoreId, b.keystoreId) &&
  eqChain.equals(a.chain, b.chain) &&
  eqNetwork.equals(a.network, b.network) &&
  normalizeHDMode(a.chain, a.hdMode) === normalizeHDMode(b.chain, b.hdMode)

export const createLedgerService = ({
  keystore$,
  wallets$,
  network$
}: {
  keystore$: KeystoreState$
  wallets$: KeystoreWalletsUI$
  network$: Network$
}): LedgerService => {
  /**
   * State of all Ledger addresses added to a keystore wallet
   * Note: Only ONE Ledger for a Keystore / Chain / Network combo possible
   */
  const {
    get$: ledgerAddresses$,
    get: ledgerAddresses,
    set: setLedgerAddresses
  } = observableState<LedgerAddresses>(INITIAL_LEDGER_ADDRESSES)

  const saveLedgerAddresses = (addresses: LedgerAddresses): LedgerAddressesLD =>
    FP.pipe(
      setLedgerAddresses(addresses),
      () => toIPCLedgerAddressesIO(addresses),
      (ioAddresses) => Rx.from(window.apiHDWallet.saveLedgerAddresses(ioAddresses)),
      RxOp.map(RD.fromEither),
      RxOp.catchError((error: Error) => Rx.of(RD.failure(error))),
      liveData.map(fromIPCLedgerAddressesIO),
      RxOp.startWith(RD.pending)
    )

  const selectedKeystoreId$: Rx.Observable<O.Option<KeystoreId>> = FP.pipe(
    keystore$,
    // Check unlocked keystore only
    RxOp.map(FP.flow(O.chain(O.fromPredicate(isKeystoreUnlocked)))),
    RxOp.map(FP.flow(O.map(({ id }) => id))),
    RxOp.distinctUntilChanged(),
    RxOp.shareReplay(1)
  )

  /**
   * Stream of removed `KeystoreId`s
   * by comparing changes of `KeystoreWalletsUI[]`
   */
  const removedKeystoreId$: RemovedKeystoreId$ = FP.pipe(
    wallets$,
    // get prev. + curr. `KeystoreWalletsUI[]`
    RxOp.pairwise(),
    // Transform pair of `KeystoreWalletsUI[]` to pair of `KeystoreId[]`
    RxOp.map((pair) => FP.pipe(pair, A.map(FP.flow(A.map(({ id }) => id))))),
    RxOp.map(([prev, curr]) =>
      // Gets the difference
      FP.pipe(prev, A.difference(N.Eq)(curr), A.head)
    )
  )

  /**
   * Stream of Ledger addresses depending on selected keystoreId + network
   */
  const currentLedgerAddresses$ = FP.pipe(
    Rx.combineLatest([network$, selectedKeystoreId$, ledgerAddresses$]),
    RxOp.map(([network, oKeystoreId, addresses]) =>
      FP.pipe(
        oKeystoreId,
        O.fold(
          () => INITIAL_LEDGER_ADDRESSES,
          (id) =>
            FP.pipe(
              addresses,
              A.map((v) => v),
              A.filter(
                ({ keystoreId, network: n }) => eqKeystoreId.equals(id, keystoreId) && eqNetwork.equals(n, network)
              )
            )
        )
      )
    ),
    RxOp.startWith(INITIAL_LEDGER_ADDRESSES)
  )

  /**
   * Update address by given chain, network, keystoreId, hdMode.
   *
   * The dedup key includes `hdMode` so chains that support multiple derivations
   * (currently Bitcoin: P2WPKH and P2TR) can hold both in parallel instead of
   * having a later add silently overwrite an earlier one.
   */
  const _addLedgerAddress = (address: LedgerAddress): LedgerAddressesLD => {
    return FP.pipe(
      ledgerAddresses(),
      A.filter((entry) => !sameLedgerEntry(entry, address)),
      A.prepend(address),
      saveLedgerAddresses
    )
  }

  /**
   * Stream of the Ledger address for a given chain.
   *
   * When `hdMode` is supplied, returns the entry matching that exact derivation
   * (with legacy `'default'` BTC entries normalized to `'p2wpkh'`); otherwise
   * prefers the chain's default derivation and falls back to any entry for the
   * chain. Entries are stored newest-first (`_addLedgerAddress` prepends), so
   * without the preference, chain-only callers (swap target address, deposits,
   * history) would get whichever BTC derivation was added last — the preference
   * makes them deterministic when both P2WPKH and P2TR exist.
   */
  const getLedgerAddress$: GetLedgerAddressHandler = (chain: Chain, hdMode?: HDMode) =>
    FP.pipe(
      currentLedgerAddresses$,
      RxOp.map((addresses) => {
        const byChain = FP.pipe(
          addresses,
          A.filter(({ chain: c }) => eqChain.equals(c, chain))
        )
        if (hdMode !== undefined) {
          return FP.pipe(
            byChain,
            A.findFirst(
              ({ hdMode: entryHdMode }) => normalizeHDMode(chain, entryHdMode) === normalizeHDMode(chain, hdMode)
            )
          )
        }
        return FP.pipe(
          byChain,
          A.findFirst(
            ({ hdMode: entryHdMode }) => normalizeHDMode(chain, entryHdMode) === normalizeHDMode(chain, 'default')
          ),
          O.alt(() => A.head(byChain))
        )
      }),
      RxOp.distinctUntilChanged(eqOLedgerAddress.equals)
    )

  /**
   * All Ledger addresses for a given chain (filtered to the current keystore +
   * network via `currentLedgerAddresses$`). Used by the balance pipeline to fan
   * out per-derivation balances for BTC.
   */
  const getLedgerAddresses$: GetLedgerAddressesHandler = (chain: Chain) =>
    FP.pipe(
      currentLedgerAddresses$,
      RxOp.map((addresses) =>
        FP.pipe(
          addresses,
          A.filter(({ chain: c }) => eqChain.equals(c, chain))
        )
      )
    )

  const verifyLedgerAddress$: VerifyLedgerAddressHandler = ({ chain, network, walletAccount, walletIndex, hdMode }) =>
    FP.pipe(
      Rx.from(
        window.apiHDWallet.verifyLedgerAddress({
          chain,
          network,
          walletAccount,
          walletIndex,
          hdMode
        })
      ),
      RxOp.catchError((error: Error) => Rx.of(RD.failure(error))),
      RxOp.switchMap((verified) =>
        Rx.of(verified ? RD.success(true) : RD.failure(Error(`Could not verify Ledger for ${chain}`)))
      ),
      RxOp.startWith(RD.pending)
    )

  /**
   * Removes a ledger address from `LedgerAddresses`.
   *
   * When `hdMode` is supplied, only the matching derivation is removed (with the
   * legacy `'default'` → `'p2wpkh'` BTC normalization). When omitted, every entry
   * for `(keystoreId, chain, network)` is removed — the historical behaviour,
   * still used by call sites that don't yet pass `hdMode`.
   */
  const removeLedgerAddress: RemoveLedgerAddressHandler = ({ id, chain, network, hdMode }) =>
    FP.pipe(
      ledgerAddresses(),
      A.filter(
        ({ chain: c, network: n, keystoreId, hdMode: entryHdMode }) =>
          !(
            eqKeystoreId.equals(id, keystoreId) &&
            eqChain.equals(c, chain) &&
            eqNetwork.equals(n, network) &&
            (hdMode === undefined || normalizeHDMode(chain, entryHdMode) === normalizeHDMode(chain, hdMode))
          )
      ),
      saveLedgerAddresses
    )

  /**
   * Add Ledger by asking address from it
   */
  const addLedgerAddress$: AddLedgerAddressHandler = ({ id, chain, network, hdMode, walletAccount, walletIndex }) =>
    FP.pipe(
      Rx.from(
        window.apiHDWallet.getLedgerAddress({
          chain,
          network,
          walletAccount,
          walletIndex,
          hdMode
        })
      ),
      // Client-side guard. Main-process timeout + headroom for IPC round-trip and
      // post-transport work so the UI spinner always resolves into success or error.
      RxOp.timeout(LEDGER_IPC_TIMEOUT_MS),
      RxOp.map(RD.fromEither),
      RxOp.catchError((error) =>
        Rx.of(
          RD.failure({
            errorId: LedgerErrorId.GET_ADDRESS_FAILED,
            msg: isError(error) ? (error?.message ?? error.toString()) : `${error}`
          })
        )
      ),
      liveData.map<WalletAddress, LedgerAddress>(({ address }) => {
        const ledgerAddress: LedgerAddress = {
          keystoreId: id,
          chain,
          network,
          hdMode,
          walletAccount,
          walletIndex,
          address,
          type: WalletType.Ledger
        }
        // store address in memory
        _addLedgerAddress(ledgerAddress)
        return ledgerAddress
      }),
      RxOp.startWith(RD.pending)
    )

  // Whenever a keystore have been removed, remove its related ledger addresses
  removedKeystoreId$.subscribe((oKeystoreId: O.Option<KeystoreId>) =>
    FP.pipe(
      oKeystoreId,
      O.map((id) =>
        FP.pipe(
          ledgerAddresses(),
          A.filter(({ keystoreId }) => keystoreId !== id),
          saveLedgerAddresses
        )
      )
    )
  )

  // `TriggerStream` to reload persistent `LedgerAddresses`
  const { stream$: reloadPersistentLedgerAddresses$, trigger: reloadPersistentLedgerAddresses } = triggerStream()

  /**
   * Persistent `KeystoreWallets` stored on disc.
   */
  const persistentLedgerAddresses$: LedgerAddressesLD = FP.pipe(
    reloadPersistentLedgerAddresses$,
    RxOp.switchMap(() => Rx.from(window.apiHDWallet.getLedgerAddresses())),
    RxOp.map(RD.fromEither),
    RxOp.catchError((error: Error) => Rx.of(RD.failure(error))),
    liveData.map(fromIPCLedgerAddressesIO),
    RxOp.startWith(RD.pending),
    RxOp.shareReplay(1)
  )

  // Subscribe persistentLedgerAddresses$
  // to update internal `LedgerAddresses`
  // whenever data are loaded from disc,
  persistentLedgerAddresses$.subscribe((ledgersRD) =>
    FP.pipe(
      ledgersRD,
      RD.map((ledgers) => {
        setLedgerAddresses(ledgers)
        return true
      })
    )
  )

  return {
    currentLedgerAddresses$,
    addLedgerAddress$,
    getLedgerAddress$,
    getLedgerAddresses$,
    verifyLedgerAddress$,
    removeLedgerAddress,
    reloadPersistentLedgerAddresses,
    persistentLedgerAddresses$
  }
}
