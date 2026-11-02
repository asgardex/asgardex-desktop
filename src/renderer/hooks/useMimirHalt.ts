import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { array as A, function as FP, option as O } from 'fp-ts'
import { isEqual } from 'lodash'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { useThorchainContext } from '../contexts/ThorchainContext'
import { sequenceTRD } from '../helpers/fpHelpers'
import { userChains$ } from '../services/storage/userChains'
import { DEFAULT_MIMIR_HALT } from '../services/thorchain/const'
import {
  MimirHaltRD,
  MimirHalt,
  Mimir,
  MimirHaltTradingGlobal,
  MimirHaltLpGlobal,
  LastblockItems
} from '../services/thorchain/types'
import { useObservableLayoutState } from './useObservableLayoutState'

/**
 * Helper to check Mimir status by given Mimir value and last height
 */
export const getMimirStatus = (mimir = 0, lastHeight = 0) => {
  // no mimir -> no action
  if (mimir === 0) return false
  // 1 -> halt | pause
  if (mimir === 1) return true
  // compare to current block height
  if (mimir < lastHeight) return true
  // No action for other cases
  return false
}
/**
 * Mimir keys from THORNode are upper case (`HALTTHORCHAIN`, `HALTBTCCHAIN`, `HALTBTCTRADING`,
 * `PAUSELPBTC`, `HALTTRADING`, `PAUSELP`, ...). Lookups are case-insensitive so a key that
 * arrives in another case is still found, and the result always uses the upper-case keys
 * `MimirHalt` (and `poolHelper`, `AppHaltedChains`) read.
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
  const mimirUpper: Mimir = Object.entries(mimir).reduce<Mimir>((acc, [key, value]) => {
    acc[key.toUpperCase()] = value
    return acc
  }, {})
  const status = (key: string) => getMimirStatus(mimirUpper[key.toUpperCase()], lastHeight)

  const flags = chains.reduce<Record<string, boolean>>((acc, chain) => {
    const c = chain.toUpperCase()
    const keys = [`HALT${c}CHAIN`, `HALT${c}TRADING`, `PAUSELP${c}`, `PAUSELPDEPOSIT-${c}-${c}`]
    keys.forEach((key) => {
      acc[key] = status(key)
    })
    return acc
  }, {})
  // THORChain's own halt is global for THORChain routes; detect it even if THOR is not in `chains`
  flags.HALTTHORCHAIN = status('HALTTHORCHAIN')

  const haltTradingGlobal: MimirHaltTradingGlobal = { haltGlobalTrading: status('HALTTRADING') }
  const pauseLpGlobal: MimirHaltLpGlobal = { pauseGlobalLp: status('PAUSELP') }

  return { ...flags, ...haltTradingGlobal, ...pauseLpGlobal } as MimirHalt
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
          RD.map(([mimir, lastblockItems]) => {
            const lastHeight = getLastHeightThorchain(lastblockItems as LastblockItems)

            return getThorchainMimirHalt({ mimir, lastHeight, chains: enabledChains })
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
