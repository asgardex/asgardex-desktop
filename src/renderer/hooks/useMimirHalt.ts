import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { array as A, function as FP, option as O } from 'fp-ts'
import { isEqual } from 'lodash'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { useThorchainContext } from '../contexts/ThorchainContext'
import { sequenceTRD } from '../helpers/fpHelpers'
import { createMimirLookup } from '../helpers/mimirLookup'
import { userChains$ } from '../services/storage/userChains'
import { DEFAULT_MIMIR_HALT, UNKNOWN_MIMIR_HALT, getPoolDepositPauseMimirKey } from '../services/thorchain/const'
import {
  MimirHaltRD,
  MimirHalt,
  Mimir,
  MimirHaltTradingGlobal,
  MimirHaltLpGlobal,
  MimirHaltStatusUnknown,
  LastblockItems
} from '../services/thorchain/types'
import { useObservableLayoutState } from './useObservableLayoutState'

/**
 * Helper to check Mimir status by given Mimir value and last height
 */
export const getMimirStatus = (mimir = 0, lastHeight = 0) => {
  // no mimir (0, or unset / negative) -> no action
  if (mimir <= 0) return false
  // 1 -> halt | pause
  if (mimir === 1) return true
  // A block height: active from that block on.
  // Same rule as THORNode (`value > 0 && value <= height`, x/thorchain/keeper/v1/keeper_halt.go)
  if (mimir <= lastHeight) return true
  // Height not reached yet -> scheduled, no action
  return false
}

/**
 * Maps THORNode mimir to the `MimirHalt` flags the app reads (`poolHelper`, `AppHaltedChains`).
 * THORNode returns mimir keys upper case (`HALTTHORCHAIN`, `HALTBTCCHAIN`, `HALTBTCTRADING`,
 * `PAUSELPBTC`, `HALTTRADING`, `PAUSELP`, ...). Keys are matched case-insensitively, a key in another
 * casing still counts and logs a warning (see `createMimirLookup`), so it never reads as "no halt".
 *
 */
export const getThorchainMimirHalt = ({
  mimir,
  lastHeight,
  chains
}: {
  mimir: Mimir
  lastHeight?: number
  chains: string[]
}): MimirHalt => {
  const lookup = createMimirLookup(mimir, 'THORNode')
  const status = (key: string) => lookup(key).some((value) => getMimirStatus(value, lastHeight))

  const flags = chains.reduce<Record<string, boolean>>((acc, chain) => {
    const c = chain.toUpperCase()
    const keys = [`HALT${c}CHAIN`, `HALT${c}TRADING`, `PAUSELP${c}`]
    keys.forEach((key) => {
      acc[key] = status(key)
    })
    // THORNode IsPoolDepositPaused is `value > 0`, no height check (keeper_halt.go:129-135)
    const depositKey = getPoolDepositPauseMimirKey(c)
    acc[depositKey] = (mimir[depositKey] ?? 0) > 0
    // Token pools have their own key (`PAUSELPDEPOSIT-AVAX-USDT-0X…`), same `value > 0` rule
    Object.keys(mimir)
      .filter((key) => key.startsWith(`PAUSELPDEPOSIT-${c}-`) && mimir[key] > 0)
      .forEach((key) => {
        acc[key] = true
      })
    return acc
  }, {})
  // THORChain's own halt is global for THORChain routes; detect it even if THOR is not in `chains`
  flags.HALTTHORCHAIN = status('HALTTHORCHAIN')

  const haltTradingGlobal: MimirHaltTradingGlobal = { haltGlobalTrading: status('HALTTRADING') }
  const pauseLpGlobal: MimirHaltLpGlobal = { pauseGlobalLp: status('PAUSELP') }
  const known: MimirHaltStatusUnknown = { haltStatusUnknown: false }

  return { ...flags, ...haltTradingGlobal, ...pauseLpGlobal, ...known } as MimirHalt
}

/**
 * Hook to get halt status defined by `Mimir`
 *
 * Note: Same rule as we have for services - Use this hook in top level *views only (but in child components)
 */
export const useThorchainMimirHalt = (enabled = true): { mimirHaltRD: MimirHaltRD; mimirHalt: MimirHalt } => {
  const { mimir$, thorchainLastblockState$ } = useThorchainContext()

  const mimirHaltSource$ = useMemo((): Rx.Observable<MimirHaltRD> => {
    if (!enabled) return Rx.EMPTY
    return FP.pipe(
      Rx.combineLatest([mimir$, thorchainLastblockState$, userChains$]),
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
  }, [enabled, mimir$, thorchainLastblockState$])

  const mimirHaltRD = useObservableLayoutState(mimirHaltSource$, RD.initial)

  const getLastHeightThorchain = (lastblockItems: LastblockItems) => {
    return FP.pipe(
      lastblockItems,
      A.findFirst(({ thorchain }) => thorchain > 0),
      O.map(({ thorchain }) => thorchain),
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
