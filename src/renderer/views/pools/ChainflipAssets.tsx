import { useCallback, useMemo, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { AnyAsset, assetToString } from '@xchainjs/xchain-util'
import { array as A, function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { AssetBTC } from '../../../shared/utils/asset'
import { AssetUSDC, DEFAULT_WALLET_TYPE } from '../../const'
import { useAppContext } from '../../contexts/AppContext'
import { useChainflipContext } from '../../contexts/ChainflipContext'
import { eqAsset } from '../../helpers/fp/eq'
import { usePoolFilter } from '../../hooks/usePoolFilter'
import { usePoolWatchlist } from '../../hooks/usePoolWatchlist'
import * as poolsRoutes from '../../routes/pools'
import { ChainflipAssetRowData } from '../../services/chainflip/poolData.types'
import { DEFAULT_NETWORK } from '../../services/const'
import { DEFAULT_POOL_FILTERS } from '../../services/midgard/midgardTypes'
import { ChainflipPoolsTable, ChainflipPoolsTableRow } from './ChainflipPoolsTable'
import { filterTableData } from './Pools.utils'
import * as Shared from './PoolsOverview.shared'
import { PoolsToolbar } from './PoolsToolbar'

export const ChainflipAssets = (): JSX.Element => {
  const navigate = useNavigate()
  const intl = useIntl()
  const { network$ } = useAppContext()
  const network = useObservableState<Network>(network$, DEFAULT_NETWORK)
  const { chainflipAssetRows$, reloadChainflipAssetRows } = useChainflipContext()
  const rowsRD = useObservableState(chainflipAssetRows$, RD.pending)

  const { setFilter: setPoolFilter, filter: poolFilter } = usePoolFilter('active')
  const { add: addPoolToWatchlist, remove: removePoolFromWatchlist, list: poolWatchList } = usePoolWatchlist()

  const handleSwap = useCallback(
    (row: ChainflipAssetRowData) => {
      // Default target: USDC for non-USDC sources, BTC for USDC source
      const isUsdc = row.asset.ticker === 'USDC'
      const target = isUsdc ? AssetBTC : AssetUSDC
      navigate(
        poolsRoutes.swap.path({
          source: assetToString(row.asset),
          target: assetToString(target),
          sourceWalletType: DEFAULT_WALLET_TYPE,
          targetWalletType: DEFAULT_WALLET_TYPE
        })
      )
    },
    [navigate]
  )

  const handleDetail = useCallback(
    (asset: AnyAsset) => navigate(poolsRoutes.detail.path({ asset: assetToString(asset) })),
    [navigate]
  )

  // Keep the last loaded rows on screen while a refresh is running (the stream is pending again on reload)
  const previousRows = useRef<O.Option<ChainflipAssetRowData[]>>(O.none)
  const oRows: O.Option<ChainflipAssetRowData[]> = useMemo(() => {
    if (RD.isSuccess(rowsRD)) previousRows.current = O.some(rowsRD.value)
    return previousRows.current
  }, [rowsRD])

  const rows: ChainflipPoolsTableRow[] = useMemo(
    () =>
      FP.pipe(
        oRows,
        O.getOrElse((): ChainflipAssetRowData[] => []),
        A.map((row) => ({
          ...row,
          watched: FP.pipe(
            poolWatchList,
            A.findFirst((asset) => eqAsset.equals(asset, row.asset)),
            O.isSome
          )
        }))
      ),
    [oRows, poolWatchList]
  )

  const filteredRows = useMemo(() => filterTableData(poolFilter)(rows), [poolFilter, rows])

  if (RD.isFailure(rowsRD)) {
    return Shared.renderTableError(intl.formatMessage({ id: 'common.refresh' }), reloadChainflipAssetRows)(rowsRD.error)
  }

  const pending = !RD.isSuccess(rowsRD)
  // Initial load: skeleton rows. Reload with rows on screen: spinning refresh button.
  const loading = pending && O.isNone(oRows)
  const refreshing = pending && O.isSome(oRows)

  return (
    <div className="flex w-full flex-col gap-3">
      <PoolsToolbar
        poolFilters={DEFAULT_POOL_FILTERS}
        activeFilter={poolFilter}
        setFilter={setPoolFilter}
        refreshing={refreshing}
        onRefresh={reloadChainflipAssetRows}
      />
      <ChainflipPoolsTable
        rows={filteredRows}
        network={network}
        loading={loading}
        // "No Chainflip assets" only if Chainflip returned none, otherwise "no result" for the filter / search
        emptyMessage={rows.length === 0 ? intl.formatMessage({ id: 'pools.chainflip.empty' }) : undefined}
        onSwap={handleSwap}
        onDetail={handleDetail}
        onWatch={addPoolToWatchlist}
        onUnwatch={removePoolFromWatchlist}
      />
    </div>
  )
}
