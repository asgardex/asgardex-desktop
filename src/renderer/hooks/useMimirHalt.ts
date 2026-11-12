import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { array as A, function as FP, option as O } from 'fp-ts'
import { isEqual } from 'lodash'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { useThorchainContext } from '../contexts/ThorchainContext'
import { sequenceTRD } from '../helpers/fpHelpers'
import { createMimirLookup } from '../helpers/mimirLookup'
import { failIfHeightStalled } from '../helpers/rx/failIfHeightStalled'
import { holdLastKnown } from '../helpers/rx/holdLastKnown'
import { memoizeBySources } from '../helpers/rx/memoizeBySources'
import { HALT_NETWORK_KEY, LASTBLOCK_HOLD, LASTBLOCK_STALL_MS, MIMIR_HOLD } from '../services/haltStatusHold'
import { userChains$ } from '../services/storage/userChains'
import { DEFAULT_MIMIR_HALT, UNKNOWN_MIMIR_HALT, getPoolDepositPauseMimirKey } from '../services/thorchain/const'
import {
  MimirHaltRD,
  MimirHalt,
  Mimir,
  MimirHaltTradingGlobal,
  MimirHaltLpGlobal,
  MimirHaltTcy,
  MimirHaltStatusUnknown,
  LastblockItems
} from '../services/thorchain/types'
import { useObservableLayoutState } from './useObservableLayoutState'

/**
 * Helper to check Mimir status by given Mimir value and last height
 */
export const getMimirStatus = (mimir = 0, lastHeight = 0, includeUncertain = false) => {
  if (!Number.isFinite(mimir)) return includeUncertain
  // no mimir (0, or unset / negative) -> no action
  if (mimir <= 0) return false
  // Without height, positive scheduled halts are uncertain: conservative for swaps, unproven for withdraw.
  if (lastHeight <= 0) return mimir === 1 || includeUncertain
  // 1 -> halt | pause
  if (mimir === 1) return true
  // A block height: active from that block on.
  // Same rule as THORNode (`value > 0 && value <= height`, x/thorchain/keeper/v1/keeper_halt.go)
  if (mimir <= lastHeight) return true
  // Height not reached yet -> scheduled, no action
  return false
}

/**
 * `NodePauseChainGlobal` pauses all chains *until* a block height (not from it, as the other halts do).
 * THORNode: `value >= height` (x/thorchain/keeper/v1/keeper_halt.go, `IsChainHalted`)
 * Without height it is never active, not even for the conservative swap path: live mimir always carries an
 * old, expired value, which would otherwise halt every chain. A real pause still reaches swaps through
 * `inbound_addresses` `halted` (THORNode `IsChainHalted`). Only a malformed value stays uncertain.
 */
export const isNodePauseActive = (mimir = 0, lastHeight = 0, includeUncertain = false) =>
  !Number.isFinite(mimir) ? includeUncertain : mimir > 0 && lastHeight > 0 && mimir >= lastHeight

/**
 * Maps THORNode mimir to the `MimirHalt` flags the app reads (`poolHelper`, `AppHaltedChains`).
 * THORNode returns mimir keys upper case (`HALTTHORCHAIN`, `HALTBTCCHAIN`, `HALTBTCTRADING`,
 * `PAUSELPBTC`, `HALTTRADING`, `PAUSELP`, ...). Keys are matched case-insensitively, a key in another
 * casing still counts and logs a warning (see `createMimirLookup`), so it never reads as "no halt".
 *
 * A chain counts as halted (`HALT{CHAIN}CHAIN`) if THORNode halts it (`IsChainHalted`):
 * `HALT{CHAIN}CHAIN`, `SOLVENCYHALT{CHAIN}CHAIN`, or a global `HALTCHAINGLOBAL` / `NODEPAUSECHAINGLOBAL`.
 * The global ones halt every chain, THORChain included, so they also set `HALTTHORCHAIN`.
 */
export const getThorchainMimirHalt = ({
  mimir,
  lastHeight,
  chains,
  includeUncertain = true
}: {
  mimir: Mimir
  lastHeight?: number
  chains: string[]
  /** Apply uncertain values only for conservative swap/deposit checks, never for LP exits. */
  includeUncertain?: boolean
}): MimirHalt => {
  const lookup = createMimirLookup(mimir, 'THORNode')
  const status = (key: string) => lookup(key).some((value) => getMimirStatus(value, lastHeight, includeUncertain))

  const haltAllChains =
    status('HALTCHAINGLOBAL') ||
    lookup('NODEPAUSECHAINGLOBAL').some((value) => isNodePauseActive(value, lastHeight, includeUncertain))

  const flags = chains.reduce<Record<string, boolean>>((acc, chain) => {
    const c = chain.toUpperCase()
    acc[`HALT${c}CHAIN`] = status(`HALT${c}CHAIN`) || status(`SOLVENCYHALT${c}CHAIN`) || haltAllChains
    const keys = [`HALT${c}TRADING`, `PAUSELP${c}`]
    keys.forEach((key) => {
      acc[key] = status(key)
    })
    // THORNode IsPoolDepositPaused is `value > 0`, no height check (keeper_halt.go:129-135).
    // Same case-insensitive lookup as the other halt keys (a PauseLPDeposit in another casing still pauses).
    const depositKey = getPoolDepositPauseMimirKey(c)
    acc[depositKey] = lookup(depositKey).some((value) => value > 0 || (includeUncertain && !Number.isFinite(value)))
    // Token pools have their own key (`PAUSELPDEPOSIT-AVAX-USDT-0X…`), same `value > 0` rule.
    // Match and store under the upper-cased key so `disablePoolActions` (which upper-cases) still hits,
    // and go through `lookup` so a casing mismatch warns the same way as for HALT* keys.
    Object.keys(mimir)
      .map((key) => key.toUpperCase())
      .filter(
        (key) =>
          key.startsWith(`PAUSELPDEPOSIT-${c}-`) &&
          lookup(key).some((value) => value > 0 || (includeUncertain && !Number.isFinite(value)))
      )
      .forEach((key) => {
        acc[key] = true
      })
    return acc
  }, {})
  // THORChain's own halt is global for THORChain routes; detect it even if THOR is not in `chains`
  flags.HALTTHORCHAIN = status('HALTTHORCHAIN') || status('SOLVENCYHALTTHORCHAIN') || haltAllChains

  const haltTradingGlobal: MimirHaltTradingGlobal = { haltGlobalTrading: status('HALTTRADING') }
  const pauseLpGlobal: MimirHaltLpGlobal = { pauseGlobalLp: status('PAUSELP') }
  const haltTcy: MimirHaltTcy = { HALTTCYTRADING: status('HALTTCYTRADING') }
  const known: MimirHaltStatusUnknown = { haltStatusUnknown: false }

  return { ...flags, ...haltTradingGlobal, ...pauseLpGlobal, ...haltTcy, ...known } as MimirHalt
}

const getLastHeightThorchain = (lastblockItems: LastblockItems) => {
  return FP.pipe(
    lastblockItems,
    A.findFirst(({ thorchain }) => thorchain > 0),
    O.map(({ thorchain }) => thorchain),
    O.getOrElse(() => 0)
  )
}

/** Shared halt streams of one service (see `getSharedThorchainMimirHalt$`) */
export type SharedMimirHaltStreams = {
  /** Full halt status: Success only with fresh mimir *and* a fresh, advancing block height */
  mimirHaltRD$: Rx.Observable<MimirHaltRD>
  /**
   * Fresh mimir halts for swaps; uncertain keys or scheduled heights are applied conservatively.
   * - mimir and height known: the full status
   * - mimir known, height unknown (lastblock failed / pending / stalled): positive halts are applied conservatively,
   *   including scheduled heights, but not `NODEPAUSECHAINGLOBAL` (see `isNodePauseActive`)
   * - mimir unknown or stale (`holdLastKnown`): no proven halt
   * `haltStatusUnknown` is `true` unless the full status is known. LP exits use `withdrawMimirHalt$` instead.
   */
  confirmedMimirHalt$: Rx.Observable<MimirHalt>
  /** Proven halts only, from the same held inputs; no inbound trading or uncertain height/key blocks. */
  withdrawMimirHalt$: Rx.Observable<MimirHalt>
}

const UNKNOWN_NO_PROVEN_HALT: MimirHalt = { ...DEFAULT_MIMIR_HALT, haltStatusUnknown: true }

/**
 * THORChain halt status streams, shared by all consumers of the same service streams (see `memoizeBySources`).
 * Inputs are only trusted while fresh (`holdLastKnown`, `failIfHeightStalled`); their state is keyed by network
 * (`HALT_NETWORK_KEY`), so a network switch still resets it for every consumer. Both streams read the same
 * held inputs (one freshness state).
 */
export const getSharedThorchainMimirHalt$ = memoizeBySources(
  (
    mimir$: Rx.Observable<RD.RemoteData<Error, Mimir>>,
    lastblock$: Rx.Observable<RD.RemoteData<Error, LastblockItems>>
  ): SharedMimirHaltStreams => {
    // Inputs are only trusted while fresh (see `holdLastKnown`): old data or a node that stays down
    // ends as a failure -> halt status unknown, never as a stale "no halt"
    const inputs$ = FP.pipe(
      Rx.combineLatest([
        mimir$.pipe(holdLastKnown<Mimir>(MIMIR_HOLD)),
        lastblock$.pipe(
          holdLastKnown<LastblockItems>(LASTBLOCK_HOLD),
          // HTTP 200 with a height that stopped advancing is not live data
          failIfHeightStalled<LastblockItems>({
            getHeight: (items) => Math.max(0, ...items.map(({ thorchain }) => thorchain ?? 0)),
            stallMs: LASTBLOCK_STALL_MS,
            resetKey: HALT_NETWORK_KEY
          })
        ),
        userChains$
      ]),
      // One freshness state for all consumers and both streams, kept while the app runs (like `mimir$`):
      // a consumer mounted later gets the current checked status, e.g. unknown after a stall, instead of
      // starting a fresh hold / stall clock on a replayed old value.
      RxOp.shareReplay(1)
    )

    const mimirHaltRD$ = FP.pipe(
      inputs$,
      RxOp.map(([mimirRD, chainLastblockRD, enabledChains]) =>
        FP.pipe(
          sequenceTRD(mimirRD, chainLastblockRD),
          RD.chain(([mimir, lastblockItems]) => {
            const lastHeight = getLastHeightThorchain(lastblockItems as LastblockItems)
            // Without a height, scheduled halts can't be told from future ones: halt status is unknown
            if (lastHeight <= 0) return RD.failure<Error, MimirHalt>(Error('THORChain block height is unknown'))

            return RD.success(getThorchainMimirHalt({ mimir, lastHeight, chains: enabledChains }))
          })
        )
      ),
      // lastblock ticks every 60s for scheduled-halt height checks; only emit when
      // halt flags actually change so quote/fetch callbacks do not churn identity.
      RxOp.distinctUntilChanged(isEqual),
      RxOp.shareReplay(1)
    )

    const mimirHaltStream = (includeUncertain: boolean) =>
      FP.pipe(
        inputs$,
        RxOp.map(([mimirRD, chainLastblockRD, enabledChains]): MimirHalt => {
          if (!RD.isSuccess(mimirRD)) return UNKNOWN_NO_PROVEN_HALT
          const lastHeight = RD.isSuccess(chainLastblockRD)
            ? getLastHeightThorchain(chainLastblockRD.value as LastblockItems)
            : 0
          if (lastHeight > 0)
            return getThorchainMimirHalt({ mimir: mimirRD.value, lastHeight, chains: enabledChains, includeUncertain })
          // Share freshness, but distinguish conservative swap halts from proven withdrawal halts.
          return {
            ...getThorchainMimirHalt({ mimir: mimirRD.value, lastHeight: 0, chains: enabledChains, includeUncertain }),
            haltStatusUnknown: true
          }
        }),
        RxOp.distinctUntilChanged(isEqual),
        RxOp.shareReplay(1)
      )

    const confirmedMimirHalt$ = mimirHaltStream(true)
    const withdrawMimirHalt$ = mimirHaltStream(false)
    return { mimirHaltRD$, confirmedMimirHalt$, withdrawMimirHalt$ }
  }
)

/**
 * Hook to get halt status defined by `Mimir`
 *
 * Note: Same rule as we have for services - Use this hook in top level *views only (but in child components)
 */
export const useThorchainMimirHalt = (
  enabled = true
): { mimirHaltRD: MimirHaltRD; mimirHalt: MimirHalt; confirmedMimirHalt: MimirHalt; withdrawMimirHalt: MimirHalt } => {
  const { mimir$, thorchainLastblockState$ } = useThorchainContext()

  const streams = useMemo(
    () => (enabled ? getSharedThorchainMimirHalt$(mimir$, thorchainLastblockState$) : undefined),
    [enabled, mimir$, thorchainLastblockState$]
  )
  const mimirHaltSource$ = useMemo((): Rx.Observable<MimirHaltRD> => streams?.mimirHaltRD$ ?? Rx.EMPTY, [streams])
  const confirmedSource$ = useMemo((): Rx.Observable<MimirHalt> => streams?.confirmedMimirHalt$ ?? Rx.EMPTY, [streams])

  const mimirHaltRD = useObservableLayoutState(mimirHaltSource$, RD.initial)
  const confirmed = useObservableLayoutState<MimirHalt | undefined>(confirmedSource$, undefined)
  const withdrawSource$ = useMemo(() => streams?.withdrawMimirHalt$ ?? Rx.EMPTY, [streams])
  const withdraw = useObservableLayoutState<MimirHalt | undefined>(withdrawSource$, undefined)

  // Fail closed: unless the halt status is loaded (still loading or failed), it is unknown - never "no halt".
  // A disabled hook opted out of the status and keeps the default.
  const mimirHalt = useMemo(
    () =>
      FP.pipe(
        mimirHaltRD,
        RD.toOption,
        O.getOrElse<MimirHalt>(() => (enabled ? UNKNOWN_MIMIR_HALT : DEFAULT_MIMIR_HALT))
      ),
    [enabled, mimirHaltRD]
  )

  // Conservative swap halts from fresh mimir, see `SharedMimirHaltStreams.confirmedMimirHalt$`
  const confirmedMimirHalt = enabled ? (confirmed ?? UNKNOWN_NO_PROVEN_HALT) : DEFAULT_MIMIR_HALT

  const withdrawMimirHalt = enabled ? (withdraw ?? UNKNOWN_NO_PROVEN_HALT) : DEFAULT_MIMIR_HALT
  return { mimirHaltRD, mimirHalt, confirmedMimirHalt, withdrawMimirHalt }
}
