import React, { useEffect, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { assetToString } from '@xchainjs/xchain-util'
import BigNumber from 'bignumber.js'
import * as FP from 'fp-ts/function'
import { useIntl } from 'react-intl'

import { useMayachainContext } from '../../../contexts/MayachainContext'
import { getChainAsset } from '../../../helpers/chainHelper'
import { LiquidityProviderForPool, Providers as MayaProviders } from '../../../services/mayachain/types'
import { LiquidityProviderForPoolRD } from '../../../services/mayachain/types'
import { AssetIcon } from '../../uielements/assets/assetIcon'

type Props = {
  provider: MayaProviders
  nodeAddress: string
  network: Network
}

export const BondProviderPoolInfo: React.FC<Props> = ({ provider, nodeAddress, network }) => {
  const intl = useIntl()
  const { getLiquidityProvider } = useMayachainContext()
  const [lpDataMap, setLpDataMap] = useState<Record<string, LiquidityProviderForPoolRD>>({})

  // Fetch LP data for each pool
  useEffect(() => {
    const subscriptions: Array<() => void> = []

    Object.entries(provider.pools).forEach(([_, assetWithLpUnits]) => {
      console.log(provider.bondAddress)
      const lp$ = getLiquidityProvider(assetWithLpUnits.asset, provider.bondAddress)

      const subscription = lp$.subscribe((rd) => {
        setLpDataMap((prev) => ({
          ...prev,
          [assetToString(assetWithLpUnits.asset)]: rd // Store LP data keyed by pool name
        }))
      })
      subscriptions.push(() => subscription.unsubscribe())
    })

    return () => subscriptions.forEach((unsubscribe) => unsubscribe())
  }, [provider.bondAddress, provider.pools, getLiquidityProvider])

  const calculatePercentage = (assetUnits: number, bondedUnits: number): string => {
    const assetUnitsBN = new BigNumber(assetUnits)
    const bondedUnitsBN = new BigNumber(bondedUnits)
    if (assetUnitsBN.isZero()) return '0'
    return bondedUnitsBN.dividedBy(assetUnitsBN).multipliedBy(100).toFixed(2) // Percentage with 2 decimals
  }

  const renderPoolInfo = () => {
    return (
      <div>
        {Object.entries(provider.pools).map(([_, assetWithLpUnits]) => {
          const assetPool = assetToString(assetWithLpUnits.asset)
          const lpData = lpDataMap[assetPool] || RD.initial // Default to initial if no data yet
          console.log(lpData)

          return FP.pipe(
            lpData,
            RD.fold(
              () => <div>{intl.formatMessage({ id: 'common.loading' })}</div>, // Initial
              () => <div>{intl.formatMessage({ id: 'common.loading' })}</div>, // Pending
              (error) => <div>{`Error: ${error.message}`}</div>, // Failure
              (lp: LiquidityProviderForPool) => {
                const matchingNode = lp.bondedNodes.find((node) => node.node_address === nodeAddress)
                const bondedUnits = matchingNode ? matchingNode.units : 0
                const percentage = calculatePercentage(assetWithLpUnits.units, Number(bondedUnits))

                return (
                  <div key={assetPool} className="flex items-center justify-between">
                    <div>
                      <AssetIcon asset={getChainAsset(assetWithLpUnits.asset.chain)} size="small" network={network} />
                    </div>
                    <span>{percentage}%</span>
                  </div>
                )
              }
            )
          )
        })}
      </div>
    )
  }

  return <div>{renderPoolInfo()}</div>
}
