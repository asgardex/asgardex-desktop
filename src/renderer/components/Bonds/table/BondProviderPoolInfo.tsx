import React, { useEffect, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import BigNumber from 'bignumber.js'
import * as FP from 'fp-ts/function'
import { useIntl } from 'react-intl'

import { useMayachainContext } from '../../../contexts/MayachainContext'
import { LiquidityProviderForPool, Providers as MayaProviders } from '../../../services/mayachain/types'
import { LiquidityProviderForPoolRD } from '../../../services/mayachain/types'

type Props = {
  provider: MayaProviders
  nodeAddress: string
}

export const BondProviderPoolInfo: React.FC<Props> = ({ provider, nodeAddress }) => {
  const intl = useIntl()
  const { getLiquidityProvider } = useMayachainContext()
  const [lpData, setLpData] = useState<LiquidityProviderForPoolRD>(RD.initial)

  // Fetch LP data for each pool
  useEffect(() => {
    const subscriptions: Array<() => void> = []

    Object.entries(provider.pools).forEach(([_, assetWithLpUnits]) => {
      const lp$ = getLiquidityProvider(assetWithLpUnits.asset, provider.bondAddress)

      const subscription = lp$.subscribe((rd) => {
        setLpData(rd)
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
    return FP.pipe(
      lpData,
      RD.fold(
        () => <div>{intl.formatMessage({ id: 'common.loading' })}</div>, // Initial
        () => <div>{intl.formatMessage({ id: 'common.loading' })}</div>, // Pending
        (error) => <div>{`Error: ${error.message}`}</div>, // Failure
        (lp: LiquidityProviderForPool) => (
          <div>
            {Object.entries(provider.pools).map(([pool, assetWithLpUnits]) => {
              const matchingNode = lp.bondedNodes.find((node) => node.node_address === nodeAddress)
              const bondedUnits = matchingNode ? matchingNode.units : '0'
              const percentage = calculatePercentage(assetWithLpUnits.units, Number(bondedUnits))

              return (
                <div key={pool} className="flex items-center justify-between">
                  <span>{pool}</span>
                  <span>{percentage}%</span>
                </div>
              )
            })}
          </div>
        )
      )
    )
  }

  return <div>{renderPoolInfo()}</div>
}
