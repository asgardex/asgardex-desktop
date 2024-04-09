/**

 April 2024 - Removing Binance Beacon Chain - I don't believe this is needed anymore.

*/

import React from 'react'

import { Button } from 'antd'

export const PlaygroundView: React.FC = (): JSX.Element => {
  return (
    <>
      <h1>Playground</h1>
      <h1>i18n</h1>
      <h2>Greetings from ASGARDEX</h2>
      <h1>Pools</h1>
      <h2>Raw data: {}</h2>
      <div>No pools available.</div>
      <h1>Ticker</h1>
      <h2>Playground</h2>
      <Button>Reload pools</Button>
      <h1>Memo</h1>
      <h2>Playground</h2>
    </>
  )
}

export default PlaygroundView

/*
 import React, { useMemo, useCallback, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { WS } from '@xchainjs/xchain-binance'
import { Asset, assetToString } from '@xchainjs/xchain-util'
import { Button } from 'antd'
import { useObservableState, useSubscription, useObservable } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { useMidgardContext } from '../../contexts/MidgardContext'
import { PoolsState } from '../../services/midgard/types'

export const PlaygroundView: React.FC = (): JSX.Element => {
  const intl = useIntl()

  const { subscribeTransfers, miniTickers$ } = useBitcoinContext()

  const [memo, setMemo] = useState('')

  const tickers = useObservableState(miniTickers$, [])

  // For debugging only - address will be provided by wallet
  const address = 'tbnb13egw96d95lldrhwu56dttrpn2fth6cs0axzaad'

  // 1. Create observable for incoming transfer messages of given address
  const transfers$ = useObservable<WS.Transfer>(() => subscribeTransfers(address))

  // 2. Define callback for handling incoming transfer messages
  const transferHandler = useCallback((transfer: WS.Transfer) => {
    // Do anything with transfer data
    // we just store memo here - just to demonstrate
    setMemo(transfer.M)
  }, [])

  // 3. Subscribe to incoming transfer events
  useSubscription(transfers$, transferHandler)

  const { service: midgardService } = useMidgardContext()
  const poolState = useObservableState(midgardService.pools.poolsState$, RD.initial)

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
        (s: PoolsState): JSX.Element => {
          const hasPools = s.poolAssets.length > 0
          return (
            <>
              {!hasPools && <h3>No pools available.</h3>}
              {hasPools && (
                <ul>
                  {s.poolAssets.map((pool: Asset, index: number) => (
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
    <>
      <h1>Playground</h1>
      <h1>i18n</h1>
      <h2>{intl.formatMessage({ id: 'common.greeting' }, { name: 'ASGARDEX' })}</h2>
      <h1>Pools</h1>
      <h2>Raw data: {JSON.stringify(poolState)}</h2>
      {renderPools}
      <h1>Ticker</h1>
      <h2>{tickers[0]?.s}</h2>
      <Button onClick={() => midgardService.pools.reloadPools()}>Reload pools</Button>
      <h1>Memo</h1>
      <h2>{memo}</h2>
    </>
  )
}


*/
