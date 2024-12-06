import { useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import * as A from 'fp-ts/lib/Array'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import * as Rx from 'rxjs'
import * as RxOp from 'rxjs/operators'

import { EnabledChain } from '../../shared/utils/chain'
import { useMayachainContext } from '../contexts/MayachainContext'
import { sequenceTRD } from '../helpers/fpHelpers'
import {
  LastblockItems,
  Mimir,
  MimirHalt,
  MimirHaltLpGlobal,
  MimirHaltRD,
  MimirHaltTradingGlobal
} from '../services/mayachain/types'
import { userChains$ } from '../services/storage/userChains'
import { DEFAULT_MIMIR_HALT } from '../services/thorchain/const'

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

export const useMayachainMimirHalt = (): { mimirHaltRD: MimirHaltRD; mimirHalt: MimirHalt } => {
  const { mimir$, mayachainLastblockState$ } = useMayachainContext()

  const [enabledChains, setEnabledChains] = useState<EnabledChain[]>([])

  useEffect(() => {
    const subscription = userChains$.subscribe(setEnabledChains)
    return () => subscription.unsubscribe()
  }, [])

  const createMimirGroup = (keys: string[], mimir: Mimir, lastHeight?: number) => {
    return keys.reduce((acc, key) => {
      acc[key] = getMimirStatus(mimir[key], lastHeight)
      return acc
    }, {} as Record<string, boolean>)
  }

  const [mimirHaltRD] = useObservableState<MimirHaltRD>(
    () =>
      FP.pipe(
        Rx.combineLatest([mimir$, mayachainLastblockState$]),
        RxOp.map(([mimirRD, chainLastblockRD]) =>
          FP.pipe(
            sequenceTRD(mimirRD, chainLastblockRD),
            RD.map(([mimir, lastblockItems]) => {
              const lastHeight = getLastHeightMaya(lastblockItems)

              const haltChainKeys = enabledChains.map((chain) => `halt${chain}Chain`)
              const haltTradingKeys = enabledChains.map((chain) => `halt${chain}ChainTrading`)
              const pauseLPKeys = enabledChains.map((chain) => `pauseLp${chain}`)

              const haltChain = createMimirGroup(haltChainKeys, mimir, lastHeight)
              const haltTrading = createMimirGroup(haltTradingKeys, mimir, lastHeight)
              const pauseLP = createMimirGroup(pauseLPKeys, mimir, lastHeight)

              const haltTradingGlobal: MimirHaltTradingGlobal = {
                haltTrading: getMimirStatus(mimir.HALTTRADING, lastHeight)
              }

              const pauseLpGlobal: MimirHaltLpGlobal = {
                pauseLp: getMimirStatus(mimir.PAUSELP, lastHeight)
              }

              return { ...haltChain, ...haltTrading, ...pauseLP, ...haltTradingGlobal, ...pauseLpGlobal } as MimirHalt
            })
          )
        ),
        RxOp.shareReplay(1)
      ),
    RD.initial
  )

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
