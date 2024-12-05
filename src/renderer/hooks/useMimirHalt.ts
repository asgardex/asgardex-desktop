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
import { useThorchainContext } from '../contexts/ThorchainContext'
import { sequenceTRD } from '../helpers/fpHelpers'
import { LastblockItems as LastblockItemsMaya } from '../services/mayachain/types'
import { userChains$ } from '../services/storage/userChains'
import { DEFAULT_MIMIR_HALT } from '../services/thorchain/const'
import {
  MimirHaltRD,
  MimirHalt,
  MimirHaltTradingGlobal,
  MimirHaltLpGlobal,
  LastblockItems
} from '../services/thorchain/types'

/**
 * Helper to check Mimir status by given Mimir value and last height
 */
export const getMimirStatus = (mimir = 0, lastHeight = 0): boolean => {
  if (mimir === 0) return false
  if (mimir === 1) return true
  return mimir < lastHeight
}

export const useMimirHalt = (): { mimirHaltRD: MimirHaltRD; mimirHalt: MimirHalt } => {
  const { mimir$: thorMimir$, thorchainLastblockState$ } = useThorchainContext()
  const { mimir$: mayaMimir$, mayachainLastblockState$ } = useMayachainContext()

  const [enabledChains, setEnabledChains] = useState<EnabledChain[]>([])

  useEffect(() => {
    const subscription = userChains$.subscribe(setEnabledChains)
    return () => subscription.unsubscribe()
  }, [])

  const createMimirGroup = (keys: string[], mimir: Record<string, number>, lastHeight: number) =>
    keys.reduce((acc, key) => {
      acc[key] = getMimirStatus(mimir[key], lastHeight)
      return acc
    }, {} as Record<string, boolean>)

  const combinedMimir$ = Rx.combineLatest([thorMimir$, thorchainLastblockState$, mayaMimir$, mayachainLastblockState$])

  const [mimirHaltRD] = useObservableState<MimirHaltRD>(
    () =>
      combinedMimir$.pipe(
        RxOp.map(([thorMimirRD, thorLastBlockRD, mayaMimirRD, mayaLastBlockRD]) =>
          FP.pipe(
            sequenceTRD(thorMimirRD, thorLastBlockRD, mayaMimirRD, mayaLastBlockRD),
            RD.map(([thorMimir, thorLastBlock, mayaMimir, mayaLastBlock]) => {
              const thorLastHeight = getLastHeightThorchain(thorLastBlock as LastblockItems)
              const mayaLastHeight = getLastHeightMaya(mayaLastBlock as LastblockItemsMaya)

              const haltChainKeys = enabledChains.map((chain) => `halt${chain}Chain`)
              const haltTradingKeys = enabledChains.map((chain) => `halt${chain}ChainTrading`)
              const pauseLPKeys = enabledChains.map((chain) => `pauseLp${chain}`)

              const thorHaltChain = createMimirGroup(haltChainKeys, thorMimir, thorLastHeight)
              const thorHaltTrading = createMimirGroup(haltTradingKeys, thorMimir, thorLastHeight)
              const thorPauseLP = createMimirGroup(pauseLPKeys, thorMimir, thorLastHeight)

              const mayaHaltChain = createMimirGroup(haltChainKeys, mayaMimir, mayaLastHeight)
              const mayaHaltTrading = createMimirGroup(haltTradingKeys, mayaMimir, mayaLastHeight)
              const mayaPauseLP = createMimirGroup(pauseLPKeys, mayaMimir, mayaLastHeight)

              const haltTradingGlobal: MimirHaltTradingGlobal = {
                haltTrading: getMimirStatus(
                  thorMimir.HALTTRADING || mayaMimir.HALTTRADING,
                  Math.max(thorLastHeight, mayaLastHeight)
                )
              }

              const pauseLpGlobal: MimirHaltLpGlobal = {
                pauseLp: getMimirStatus(
                  thorMimir.PAUSELP || mayaMimir.PAUSELP,
                  Math.max(thorLastHeight, mayaLastHeight)
                )
              }

              return {
                ...thorHaltChain,
                ...thorHaltTrading,
                ...thorPauseLP,
                ...mayaHaltChain,
                ...mayaHaltTrading,
                ...mayaPauseLP,
                ...haltTradingGlobal,
                ...pauseLpGlobal
              } as MimirHalt
            })
          )
        ),
        RxOp.shareReplay(1)
      ),
    RD.initial
  )

  const getLastHeightThorchain = (lastblockItems: LastblockItems): number => {
    return FP.pipe(
      lastblockItems,
      A.findFirst(({ thorchain }) => thorchain > 0),
      O.map(({ thorchain }) => thorchain),
      O.getOrElse(() => 0)
    )
  }

  const getLastHeightMaya = (lastblockItems: LastblockItemsMaya): number => {
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
        O.getOrElse(() => DEFAULT_MIMIR_HALT)
      ),
    [mimirHaltRD]
  )

  return { mimirHaltRD, mimirHalt }
}
