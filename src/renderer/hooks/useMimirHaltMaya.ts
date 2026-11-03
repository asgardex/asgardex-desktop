import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { array as A, function as FP, option as O } from 'fp-ts'
import { isEqual } from 'lodash'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { useMayachainContext } from '../contexts/MayachainContext'
import { sequenceTRD } from '../helpers/fpHelpers'
import { DEFAULT_MIMIR_HALT } from '../services/mayachain/const'
import {
  LastblockItems,
  Mimir,
  MimirHalt,
  MimirHaltLpGlobal,
  MimirHaltRD,
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
 * Maps MAYANode mimir to the `MimirHalt` flags the app reads (`poolHelperMaya`).
 * MAYANode returns mimir keys upper case, so keys are read exactly as sent, the same as
 * `getThorchainMimirHalt` does for THORNode.
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
  const status = (key: string) => getMimirStatus(mimir[key], lastHeight)

  const flags = chains.reduce<Record<string, boolean>>((acc, chain) => {
    const c = chain.toUpperCase()
    const keys = [`HALT${c}CHAIN`, `HALT${c}TRADING`, `PAUSELP${c}`]
    keys.forEach((key) => {
      acc[key] = status(key)
    })
    return acc
  }, {})
  // MAYAChain's own halt is global for MAYAChain routes; detect it even if MAYA is not in `chains`
  flags.HALTMAYACHAIN = status('HALTMAYACHAIN')

  const haltTradingGlobal: MimirHaltTradingGlobal = { haltGlobalTrading: status('HALTTRADING') }
  const pauseLpGlobal: MimirHaltLpGlobal = { pauseGlobalLp: status('PAUSELP') }

  return { ...flags, ...haltTradingGlobal, ...pauseLpGlobal } as MimirHalt
}

export const useMayachainMimirHalt = (enabled = true): { mimirHaltRD: MimirHaltRD; mimirHalt: MimirHalt } => {
  const { mimir$, mayachainLastblockState$ } = useMayachainContext()

  const mimirHaltSource$ = useMemo((): Rx.Observable<MimirHaltRD> => {
    if (!enabled) return Rx.EMPTY
    return FP.pipe(
      Rx.combineLatest([mimir$, mayachainLastblockState$, userChains$]),
      RxOp.map(([mimirRD, chainLastblockRD, enabledChains]) =>
        FP.pipe(
          sequenceTRD(mimirRD, chainLastblockRD),
          RD.map(([mimir, lastblockItems]) => {
            const lastHeight = getLastHeightMaya(lastblockItems)

            return getMayachainMimirHalt({ mimir, lastHeight, chains: enabledChains })
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

  const mimirHalt = useMemo(
    () =>
      FP.pipe(
        mimirHaltRD,
        RD.toOption,
        O.getOrElse<MimirHalt>(() => DEFAULT_MIMIR_HALT)
      ),
    [mimirHaltRD]
  )

  return { mimirHaltRD, mimirHalt }
}
