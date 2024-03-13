import React, { useEffect, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Asset, assetToString } from '@xchainjs/xchain-util'
import * as O from 'fp-ts/lib/Option'

import { PoolActionsHistory } from '../../components/poolActionsHistory'
import { PoolActionsHistoryFilter } from '../../components/poolActionsHistory/PoolActionsHistoryFilter'
import { Filter } from '../../components/poolActionsHistory/types'
import { useDex } from '../../hooks/useDex'
import { useNetwork } from '../../hooks/useNetwork'
import { useOpenExplorerTxUrl } from '../../hooks/useOpenExplorerTxUrl'
import { PoolHistoryActions } from './PoolHistoryView.types'

type Props = {
  poolAsset: Asset
  historyActions: PoolHistoryActions
  className?: string
}

const HISTORY_FILTERS: Filter[] = ['ALL', 'DEPOSIT', 'SWAP', 'WITHDRAW', 'DONATE', 'REFUND']

export const PoolHistoryView: React.FC<Props> = ({ className, poolAsset, historyActions }) => {
  const { loadHistory, reloadHistory, requestParams, historyPage, prevHistoryPage, setFilter, setPage } = historyActions

  const stringAsset = useMemo(() => assetToString(poolAsset), [poolAsset])

  const { network } = useNetwork()

  const { dex } = useDex()

  useEffect(() => {
    loadHistory({ asset: stringAsset })
  }, [loadHistory, stringAsset])

  const currentFilter = requestParams.type || 'ALL'

  const { openExplorerTxUrl } = useOpenExplorerTxUrl(O.some(dex === 'THOR' ? THORChain : MAYAChain))

  const headerContent = useMemo(
    () => (
      <PoolActionsHistoryFilter
        availableFilters={HISTORY_FILTERS}
        currentFilter={currentFilter}
        onFilterChanged={setFilter}
        disabled={!RD.isSuccess(historyPage)}
      />
    ),
    [currentFilter, historyPage, setFilter]
  )

  return (
    <PoolActionsHistory
      className={className}
      network={network}
      headerContent={headerContent}
      currentPage={requestParams.page + 1}
      historyPageRD={historyPage}
      prevHistoryPage={prevHistoryPage}
      openExplorerTxUrl={openExplorerTxUrl}
      changePaginationHandler={setPage}
      reloadHistory={reloadHistory}
    />
  )
}
