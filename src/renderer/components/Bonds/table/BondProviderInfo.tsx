import { useEffect, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { TvIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { Address, BaseAmount, assetToString, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import clsx from 'clsx'

import { useIntl } from 'react-intl'
import RemoveIcon from '../../../assets/svg/icon-remove.svg?react'
import { getLiquidityProvider } from '../../../services/mayachain'
import { Providers as MayaProviders, LiquidityProviderForPoolRD } from '../../../services/mayachain/types'
import { PoolDetailsRD } from '../../../services/midgard/mayaMidgard/types'
import { PricePool } from '../../../services/midgard/midgardTypes'
import { Label } from '../../uielements/label'
import { Tooltip } from '../../uielements/tooltip'
import * as H from './helpers'

type Props = {
  provider: MayaProviders
  nodeAddress: string
  network: Network
  isMonitoring: boolean
  isMyAddress: boolean
  addWatchlist: (nodeOrBond: Address, network: Network) => void
  removeWatchlist: (bondProviders: Address, network: Network) => void
  renderSubActions: (record: {
    bondAddress: string
    bondAmount?: BaseAmount
    status: string
    signMembership: string[]
    nodeAddress: string
  }) => JSX.Element
  recordStatus: string
  recordSignMembership: string[]
  recordBond?: BaseAmount // Adjust type based on your data
  poolDetails: PoolDetailsRD
  pricePoolData: PricePool
}

export const BondProviderInfo = ({
  provider,
  nodeAddress,
  network,
  isMonitoring,
  isMyAddress,
  addWatchlist,
  removeWatchlist,
  renderSubActions,
  recordStatus,
  recordSignMembership,
  recordBond,
  poolDetails,
  pricePoolData
}: Props) => {
  const [lpDataMap, setLpDataMap] = useState<Record<string, LiquidityProviderForPoolRD>>({})
  const intl = useIntl()
  // Fetch LP data for this provider’s pools
  useEffect(() => {
    const subscriptions: Array<() => void> = []

    Object.entries(provider.pools).forEach(([_, assetWithLpUnits]) => {
      const assetPool = assetToString(assetWithLpUnits.asset)
      const lp$ = getLiquidityProvider(assetWithLpUnits.asset, provider.bondAddress)
      const subscription = lp$.subscribe((rd) => {
        setLpDataMap((prev) => ({ ...prev, [assetPool]: rd }))
      })
      subscriptions.push(() => subscription.unsubscribe())
    })

    return () => subscriptions.forEach((unsubscribe) => unsubscribe())
  }, [provider.bondAddress, provider.pools])

  return (
    <div
      className={clsx(
        'flex flex-col rounded-lg border border-solid border-gray0 p-4 dark:border-gray0d',
        { 'bg-gray0 dark:bg-gray0d': !isMonitoring && !isMyAddress },
        { 'bg-transparent': isMonitoring && !isMyAddress },
        { 'bg-turquoise/10': isMyAddress }
      )}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          {Object.entries(provider.pools).map(([pool, assetWithLpUnits]) => {
            const assetPool = assetToString(assetWithLpUnits.asset)
            const lpData = lpDataMap[assetPool] || RD.initial
            const bondedAmount = H.calculateBondedAmount({
              lpData,
              assetWithLpUnits,
              nodeAddress,
              poolDetails,
              pricePool: pricePoolData
            })

            return (
              <Label key={pool} size="big" textTransform="uppercase">
                {formatAssetAmountCurrency({
                  asset: assetWithLpUnits.asset,
                  amount: baseToAsset(bondedAmount.bondedAmount),
                  trimZeros: true,
                  decimal: 2
                })}
                ~
                {formatAssetAmountCurrency({
                  asset: pricePoolData.asset,
                  amount: baseToAsset(bondedAmount.bondedAmountValue),
                  trimZeros: true,
                  decimal: 2
                })}
              </Label>
            )
          })}
          {Object.entries(provider.pools).length === 0 && (
            <Label size="big" textTransform="uppercase">
              No Pools
            </Label>
          )}
        </div>
        {isMonitoring ? (
          <Tooltip title={intl.formatMessage({ id: 'bonds.tooltip.removeFromWatchlist' })}>
            <RemoveIcon
              className="h-4 w-4 cursor-pointer"
              onClick={() => removeWatchlist(provider.bondAddress, network)}
            />
          </Tooltip>
        ) : (
          <Tooltip title={intl.formatMessage({ id: 'bonds.tooltip.addToWatchlist' })}>
            <TvIcon
              className="cursor-pointer text-turquoise"
              width={16}
              height={16}
              onClick={() => addWatchlist(provider.bondAddress, network)}
            />
          </Tooltip>
        )}
      </div>
      {renderSubActions({
        bondAddress: provider.bondAddress,
        bondAmount: recordBond,
        status: recordStatus,
        signMembership: recordSignMembership,
        nodeAddress
      })}
    </div>
  )
}
