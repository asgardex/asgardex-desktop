import React, { useEffect, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { function as FP, option as O } from 'fp-ts'

import { useBreakpoint } from '../../hooks/useBreakpoint'
import { OpenExplorerTxUrl } from '../../services/clients'
import { ActionsPage, ActionsPageRD } from '../../services/midgard/thorMidgard/types'
import { PoolActionsHistoryList } from './PoolActionsHistoryList'
import { PoolActionsHistoryTable, Props as PoolActionsHistoryTableProps } from './PoolActionsHistoryTable'

type Props = {
  network: Network
  headerContent?: React.ReactNode
  currentPage: number
  historyPageRD: ActionsPageRD
  prevHistoryPage?: O.Option<ActionsPage>
  openExplorerTxUrl: OpenExplorerTxUrl
  changePaginationHandler: (page: number) => void
  reloadHistory: FP.Lazy<void>
  className?: string
}

export const PoolActionsHistory = (props: Props) => {
  const {
    network,
    headerContent: HeaderContent,
    historyPageRD,
    currentPage,
    prevHistoryPage,
    changePaginationHandler,
    openExplorerTxUrl,
    reloadHistory
  } = props
  const isDesktopView = useBreakpoint()?.lg ?? false
  // store previous data of Txs to render these while reloading
  const prevHistoryPageRef = useRef<O.Option<ActionsPage>>(O.none)

  useEffect(() => {
    FP.pipe(
      historyPageRD,
      RD.map((data) => {
        prevHistoryPageRef.current = O.some(data)
        return true
      })
    )
  }, [historyPageRD])

  const tableProps: PoolActionsHistoryTableProps = {
    currentPage,
    historyPageRD,
    prevHistoryPage,
    openExplorerTxUrl,
    changePaginationHandler,
    network,
    reloadHistory
  }

  return (
    <>
      {HeaderContent && (
        <div className="flex flex-col items-center p-5 bg-bg1 dark:bg-bg1d md:flex-row">{HeaderContent}</div>
      )}
      {isDesktopView ? (
        <PoolActionsHistoryTable prevHistoryPage={prevHistoryPageRef.current} {...tableProps} />
      ) : (
        <PoolActionsHistoryList prevHistoryPage={prevHistoryPageRef.current} {...tableProps} />
      )}
    </>
  )
}
