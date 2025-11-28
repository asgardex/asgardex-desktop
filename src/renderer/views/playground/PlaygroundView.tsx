import { useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Button } from '@headlessui/react'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { AnyAsset, assetToString } from '@xchainjs/xchain-util'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { ProtocolSwitch } from '../../components/uielements/protocolSwitch'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { PoolsState as PoolStateMaya } from '../../services/midgard/mayaMidgard/types'
import { PoolsState } from '../../services/midgard/midgardTypes'
import { useApp } from '../../store/app/hooks'

export const PlaygroundView = (): JSX.Element => {
  const intl = useIntl()
  const { protocol, setProtocol } = useApp()

  const { service: midgardService } = useMidgardContext()
  const { service: midgardMayaService } = useMidgardMayaContext()

  const poolState = useObservableState(
    protocol === THORChain ? midgardService.pools.poolsState$ : midgardMayaService.pools.poolsState$,
    RD.initial
  )

  const renderPools = useMemo(
    () =>
      RD.fold(
        // initial state
        () => <div />,
        // loading state
        () => <h3>Loading...</h3>,
        // error state
        (error: Error) => <h3>`Loading of pool data failed ${error?.message ?? ''}`</h3>,
        // success state
        (s: PoolsState | PoolStateMaya): JSX.Element => {
          const hasPools = s.poolAssets.length > 0
          return (
            <>
              {!hasPools && <h3>No pools available.</h3>}
              {hasPools && (
                <ul>
                  {s.poolAssets.map((pool: AnyAsset, index: number) => (
                    <li key={index}>{assetToString(pool)}</li>
                  ))}
                </ul>
              )}
            </>
          )
        }
      )(poolState),
    [poolState]
  )

  return (
    <div className="rounded-lg bg-bg0 p-4 dark:bg-bg0d">
      <h1>Playground</h1>
      <h1>i18n</h1>
      <h2>{intl.formatMessage({ id: 'common.greeting' }, { name: 'ASGARDEX' })}</h2>
      <h1>Pools</h1>
      <h2>Raw data: {JSON.stringify(poolState)}</h2>
      <div className="flex items-center justify-end">
        <ProtocolSwitch protocol={protocol} setProtocol={setProtocol} />
      </div>
      {renderPools}
      <div className="flex items-center justify-center">
        <Button
          className="rounded-lg bg-turquoise px-4 py-2 text-white"
          onClick={() => {
            midgardService.pools.reloadPools()
            midgardMayaService.pools.reloadPools()
          }}>
          Reload pools
        </Button>
      </div>
    </div>
  )
}
