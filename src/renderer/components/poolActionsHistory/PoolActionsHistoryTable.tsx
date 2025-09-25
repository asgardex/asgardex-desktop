import { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { ColumnDef } from '@tanstack/react-table'
import { Network } from '@xchainjs/xchain-client'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { useBreakpoint } from '../../hooks/useBreakpoint'
import { OpenExplorerTxUrl } from '../../services/clients'
import { ActionsPage, Action, ActionsPageRD } from '../../services/midgard/thorMidgard/types'
import { ApiError } from '../../services/wallet/types'
import { FixmeType } from '../../types/asgardex'
import { ErrorView } from '../shared/error'
import { Table } from '../table'
import { Button } from '../uielements/button'
import { Label } from '../uielements/label'
import { Pagination } from '../uielements/pagination'
import { TxDetail } from '../uielements/txDetail'
import { DEFAULT_PAGE_SIZE } from './PoolActionsHistory.const'
import * as H from './PoolActionsHistory.helper'
import * as Styled from './PoolActionsHistoryTable.styles'

export type Props = {
  network: Network
  currentPage: number
  historyPageRD: ActionsPageRD
  prevHistoryPage?: O.Option<ActionsPage>
  openExplorerTxUrl: OpenExplorerTxUrl
  changePaginationHandler: (page: number) => void
  reloadHistory: FP.Lazy<void>
  className?: string
}

export const PoolActionsHistoryTable = ({
  network,
  openExplorerTxUrl,
  changePaginationHandler,
  historyPageRD,
  prevHistoryPage = O.none,
  reloadHistory,
  currentPage
}: Props) => {
  const intl = useIntl()

  const isDesktopView = useBreakpoint()?.lg ?? false

  const columns: ColumnDef<Action, FixmeType>[] = useMemo(
    () => [
      {
        accessorKey: 'txType',
        header: '',
        cell: ({ row }) => <Styled.TxType type={row.original.type} showTypeIcon={isDesktopView} />,
        size: 20
      },
      {
        accessorKey: 'txDetail',
        header: '',
        cell: ({ row: { original: action } }) => (
          <TxDetail
            incomes={H.getValues(action.in)}
            outgos={H.getValues(action.out)}
            fees={action.fees}
            slip={action.slip}
            network={network}
            isDesktopView={isDesktopView}
          />
        )
      },
      {
        accessorKey: 'timeStamp',
        header: '',
        cell: ({ row }) =>
          FP.pipe(
            row.original,
            H.getTxId,
            O.map((txID) => (
              <div key={txID} className="flex items-center justify-center">
                <Label>{H.renderDate(row.original.date)}</Label>
                <ArrowTopRightOnSquareIcon
                  className="text-turquoise cursor-pointer w-4 h-4 min-w-4"
                  onClick={() => openExplorerTxUrl(txID)}
                />
              </div>
            )),
            O.getOrElse(() => <></>)
          ),
        size: 50
      }
    ],
    [isDesktopView, network, openExplorerTxUrl]
  )

  const renderTable = useCallback(
    ({ total, actions }: ActionsPage, loading = false) => {
      return (
        <>
          <Table columns={columns} data={actions} loading={loading} hideVerticalBorder hideHeader />
          {total > 0 && (
            <Pagination
              current={currentPage}
              total={total}
              defaultPageSize={DEFAULT_PAGE_SIZE}
              onChange={changePaginationHandler}
            />
          )}
        </>
      )
    },
    [columns, changePaginationHandler, currentPage]
  )

  return useMemo(
    () => (
      <>
        {FP.pipe(
          historyPageRD,
          RD.fold(
            () => renderTable(H.emptyData, true),
            () => {
              const data = FP.pipe(
                prevHistoryPage,
                O.getOrElse(() => H.emptyData)
              )
              return renderTable(data, true)
            },
            ({ msg }: ApiError) => (
              <ErrorView
                title={intl.formatMessage({ id: 'common.error' })}
                subTitle={msg}
                extra={<Button onClick={reloadHistory}>{intl.formatMessage({ id: 'common.retry' })}</Button>}
              />
            ),
            renderTable
          )
        )}
      </>
    ),
    [renderTable, historyPageRD, prevHistoryPage, intl, reloadHistory]
  )
}
