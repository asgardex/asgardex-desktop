import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { array as A, function as FP, option as O } from 'fp-ts'
import { isEqual } from 'lodash'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { useMayachainContext } from '../contexts/MayachainContext'
import { sequenceTRD } from '../helpers/fpHelpers'
import { createMimirLookup } from '../helpers/mimirLookup'
import { failIfHeightStalled } from '../helpers/rx/failIfHeightStalled'
import { holdLastKnown } from '../helpers/rx/holdLastKnown'
import { HALT_NETWORK_KEY, LASTBLOCK_HOLD, LASTBLOCK_STALL_MS, MIMIR_HOLD } from '../services/haltStatusHold'
import { DEFAULT_MIMIR_HALT, UNKNOWN_MIMIR_HALT } from '../services/mayachain/const'
import {
  LastblockItems,
  Mimir,
  MimirHalt,
  MimirHaltLpGlobal,
  MimirHaltRD,
  MimirHaltStatusUnknown,
  MimirHaltTradingGlobal
} from '../services/mayachain/types'
import { userChains$ } from '../services/storage/userChains'
import { useObservableLayoutState } from './useObservableLayoutState'

/**
 * Helper to check Mimir status by given Mimir value and last height
 */
export const getMimirStatus = (mimir = 0, lastHeight = 0) => {
  // no mimir (0, or unset / negative) -> no action
  if (mimir <= 0) return false
  // Unknown height: only the plain `1` is certain, a scheduled height can't be compared to it.
  // (The hooks treat a missing height as "halt status unknown" before they get here.)
  if (lastHeight <= 0) return mimir === 1
  // 1 -> halt | pause
  if (mimir === 1) return true
  // A block height: active after that block.
  // Same rule as MAYANode (`value > 0 && value < height`, x/mayachain/keeper/v1/keeper_halt.go).
  // Note: THORNode uses `value <= height` (see useMimirHalt.ts).
  if (mimir < lastHeight) return true
  // Height not passed yet -> scheduled, no action
  return false
}

/**
 * `NodePauseChainGlobal` pauses all chains *until* a block height (not from it, as the other halts do).
 * MAYANode: `value > height` (x/mayachain/keeper/v1/keeper_halt.go, `IsChainHalted`)
 * Without a known height it cannot be told apart from an old, expired pause, so it is not applied.
 */
export const isNodePauseActive = (mimir = 0, lastHeight = 0) => mimir > 0 && lastHeight > 0 && mimir > lastHeight

/**
 * Maps MAYANode mimir to the `MimirHalt` flags the app reads (`poolHelperMaya`).
 * MAYANode returns mimir keys upper case. Keys are matched case-insensitively, a key in another casing
 * still counts and logs a warning (see `createMimirLookup`), so it never reads as "no halt".
 *
 * A chain counts as halted (`HALT{CHAIN}CHAIN`) if MAYANode halts it (`IsChainHalted`):
 * `HALT{CHAIN}CHAIN`, `SOLVENCYHALT{CHAIN}CHAIN`, or a global `HALTCHAINGLOBAL` / `NODEPAUSECHAINGLOBAL`.
 * The global ones halt every chain, MAYAChain included, so they also set `HALTMAYACHAIN`.
 */
export const getMayachainMimirHalt = ({
  mimir,
  lastHeight,
  chains
}: {
  mimir: Mimir
  lastHeight?: number
  chains: string[]
}): MimirHalt => {
  const lookup = createMimirLookup(mimir, 'MAYANode')
  const status = (key: string) => lookup(key).some((value) => getMimirStatus(value, lastHeight))

  const haltAllChains =
    status('HALTCHAINGLOBAL') || lookup('NODEPAUSECHAINGLOBAL').some((value) => isNodePauseActive(value, lastHeight))

  const flags = chains.reduce<Record<string, boolean>>((acc, chain) => {
    const c = chain.toUpperCase()
    acc[`HALT${c}CHAIN`] = status(`HALT${c}CHAIN`) || status(`SOLVENCYHALT${c}CHAIN`) || haltAllChains
    const keys = [`HALT${c}TRADING`, `PAUSELP${c}`]
    keys.forEach((key) => {
      acc[key] = status(key)
    })
    return acc
  }, {})
  // MAYAChain's own halt is global for MAYAChain routes; detect it even if MAYA is not in `chains`
  flags.HALTMAYACHAIN = status('HALTMAYACHAIN') || status('SOLVENCYHALTMAYACHAIN') || haltAllChains

  const haltTradingGlobal: MimirHaltTradingGlobal = { haltGlobalTrading: status('HALTTRADING') }
  const pauseLpGlobal: MimirHaltLpGlobal = { pauseGlobalLp: status('PAUSELP') }
  const known: MimirHaltStatusUnknown = { haltStatusUnknown: false }

  return { ...flags, ...haltTradingGlobal, ...pauseLpGlobal, ...known } as MimirHalt
}

export const useMayachainMimirHalt = (enabled = true): { mimirHaltRD: MimirHaltRD; mimirHalt: MimirHalt } => {
  const { mimir$, mayachainLastblockState$ } = useMayachainContext()

  const mimirHaltSource$ = useMemo((): Rx.Observable<MimirHaltRD> => {
    if (!enabled) return Rx.EMPTY
    return FP.pipe(
      // Inputs are only trusted while fresh (see `holdLastKnown`): old data or a node that stays down
      // ends as a failure -> halt status unknown, never as a stale "no halt"
      Rx.combineLatest([
        mimir$.pipe(holdLastKnown<Mimir>(MIMIR_HOLD)),
        mayachainLastblockState$.pipe(
          holdLastKnown<LastblockItems>(LASTBLOCK_HOLD),
          // HTTP 200 with a height that stopped advancing is not live data
          failIfHeightStalled<LastblockItems>({
            getHeight: (items) => Math.max(0, ...items.map(({ mayachain }) => mayachain ?? 0)),
            stallMs: LASTBLOCK_STALL_MS,
            resetKey: HALT_NETWORK_KEY
          })
        ),
        userChains$
      ]),
      RxOp.map(([mimirRD, chainLastblockRD, enabledChains]) =>
        FP.pipe(
          sequenceTRD(mimirRD, chainLastblockRD),
          RD.chain(([mimir, lastblockItems]) => {
            const lastHeight = getLastHeightMaya(lastblockItems)
            // Without a height, scheduled halts can't be told from future ones: halt status is unknown
            if (lastHeight <= 0) return RD.failure<Error, MimirHalt>(Error('MAYAChain block height is unknown'))

            return RD.success(getMayachainMimirHalt({ mimir, lastHeight, chains: enabledChains }))
          })
        )
      ),
      // lastblock ticks every 60s for scheduled-halt height checks; only emit when
      // halt flags actually change so quote/fetch callbacks do not churn identity.
      RxOp.distinctUntilChanged(isEqual),
      RxOp.shareReplay(1)
    )
  }, [enabled, mayachainLastblockState$, mimir$])

  const mimirHaltRD = useObservableLayoutState(mimirHaltSource$, RD.initial)

  const getLastHeightMaya = (lastblockItems: LastblockItems) => {
    return FP.pipe(
      lastblockItems,
      A.findFirst(({ mayachain }) => mayachain > 0),
      O.map(({ mayachain }) => mayachain),
      O.getOrElse(() => 0)
    )
  }

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

  return { mimirHaltRD, mimirHalt }
}
