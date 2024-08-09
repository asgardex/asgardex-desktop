import { useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { THORChain } from '@xchainjs/xchain-thorchain'
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
  Mimir,
  MimirHaltTradingGlobal,
  MimirHaltLpGlobal,
  LastblockItems
} from '../services/thorchain/types'
import { useDex } from './useDex'

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
 * Hook to get halt status defined by `Mimir`
 *
 * Note: Same rule as we have for services - Use this hook in top level *views only (but in child components)
 */
export const useMimirHalt = (): { mimirHaltRD: MimirHaltRD; mimirHalt: MimirHalt } => {
  const { mimir$, thorchainLastblockState$ } = useThorchainContext()
  const { mimir$: mayaMimir$, mayachainLastblockState$ } = useMayachainContext()

  const { dex } = useDex()
  const [enabledChains, setEnabledChains] = useState<EnabledChain[]>([])

  useEffect(() => {
    const subscription = userChains$.subscribe(setEnabledChains)
    return () => subscription.unsubscribe()
  }, [])

  const lastDexBlockState = dex.chain === THORChain ? thorchainLastblockState$ : mayachainLastblockState$
  const dexMimir = dex.chain === THORChain ? mimir$ : mayaMimir$
  const createMimirGroup = (keys: string[], mimir: Mimir, lastHeight?: number) => {
    return keys.reduce((acc, key) => {
      acc[key] = getMimirStatus(mimir[key], lastHeight)
      return acc
    }, {} as Record<string, boolean>)
  }

  const [mimirHaltRD] = useObservableState<MimirHaltRD>(
    () =>
      FP.pipe(
        Rx.combineLatest([dexMimir, lastDexBlockState]),
        RxOp.map(([mimirRD, chainLastblockRD]) =>
          FP.pipe(
            sequenceTRD(mimirRD, chainLastblockRD),
            RD.map(([mimir, lastblockItems]) => {
              const lastHeight =
                dex.chain === THORChain
                  ? getLastHeightThorchain(lastblockItems as LastblockItems)
                  : getLastHeightMaya(lastblockItems as LastblockItemsMaya)
              const mapChainToKey = (prefix: string, chain: string) => `${prefix}${chain}Chain`

              const haltChainKeys = enabledChains.map((chain) => mapChainToKey('halt', chain))
              const haltTradingKeys = enabledChains.map((chain) => mapChainToKey('halt', chain) + 'Trading')
              const pauseLPKeys = enabledChains.map((chain) => mapChainToKey('pauseLp', chain))

              const haltChain = createMimirGroup(haltChainKeys, mimir, lastHeight)
              const haltTrading = createMimirGroup(haltTradingKeys, mimir, lastHeight)
              const pauseLP = createMimirGroup(pauseLPKeys, mimir, lastHeight)

              // Include global values separately
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

  const getLastHeightThorchain = (lastblockItems: LastblockItems) => {
    const lastHeight = FP.pipe(
      lastblockItems,
      A.findFirst(({ thorchain }) => thorchain > 0),
      O.map(({ thorchain }) => thorchain),
      O.toUndefined
    )
    return lastHeight
  }
  const getLastHeightMaya = (lastblockItems: LastblockItemsMaya) => {
    const lastHeight = FP.pipe(
      lastblockItems,
      A.findFirst(({ mayachain }) => mayachain > 0),
      O.map(({ mayachain }) => mayachain),
      O.toUndefined
    )
    return lastHeight
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
