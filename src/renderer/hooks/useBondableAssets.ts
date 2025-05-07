import { useState, useEffect } from 'react'

import { isSuccess } from '@devexperts/remote-data-ts'
import { assetToString } from '@xchainjs/xchain-util'

import { useMayachainContext } from '../contexts/MayachainContext'
import { MayanodePool, MayanodePoolsLD } from '../services/mayachain/types' // Ensure MayanodePool is imported

export const useBondableAssets = (): string[] => {
  const { getMayanodePools } = useMayachainContext()
  const [bondableAssets, setBondableAssets] = useState<string[]>([])

  useEffect(() => {
    const pools$: MayanodePoolsLD = getMayanodePools()

    const subscription = pools$.subscribe({
      next: (poolsData) => {
        if (isSuccess(poolsData)) {
          const pools: MayanodePool[] = poolsData.value
          // Filter pools that are bondable and map to their asset strings
          const bondableAssetStrings = pools.filter((pool) => pool.bondable).map((pool) => assetToString(pool.asset))

          setBondableAssets(bondableAssetStrings)
        }
      },
      error: (err: Error) => {
        console.error('Error fetching pools:', err)
        setBondableAssets([]) // Reset to empty array on error
      }
    })

    return () => subscription.unsubscribe()
  }, [getMayanodePools]) // No asset dependency anymore

  return bondableAssets
}
