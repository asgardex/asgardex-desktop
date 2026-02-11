import { useCallback } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowUpIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { OpenExplorerTxUrl } from '../../services/clients'
import { Action, ActionsPage, ActionsPageRD } from '../../services/midgard/thorMidgard/types'
import { ErrorView } from '../shared/error'
import { Button } from '../uielements/button'
import { Pagination } from '../uielements/pagination'
import { Spin } from '../uielements/spin'
import { TxDetail } from '../uielements/txDetail'
import { TxType } from '../uielements/txType'
import { DEFAULT_PAGE_SIZE } from './PoolActionsHistory.const'
import * as H from './PoolActionsHistory.helper'

type Props = {
  network: Network
  currentPage: number
  historyPageRD: ActionsPageRD
  prevHistoryPage?: O.Option<ActionsPage>
  openExplorerTxUrl: OpenExplorerTxUrl
  changePaginationHandler: (page: number) => void
  reloadHistory: FP.Lazy<void>
  className?: string
}

export const PoolActionsHistoryList = ({
  network,
  changePaginationHandler,
  historyPageRD,
  prevHistoryPage = O.none,
  openExplorerTxUrl: goToTx,
  currentPage,
  reloadHistory,
  className
}: Props) => {
  const intl = useIntl()

  const renderListItem = useCallback(
    (action: Action, goToTx: OpenExplorerTxUrl) => {
      const date = H.renderDate(action.date)

      const titleExtra = (
        <div className="flex items-center">
          {date}
          {FP.pipe(
            action,
            H.getTxId,
            O.map((id) => (
              <button
                key={id}
                onClick={() => goToTx(id)}
                className="inline-block min-w-0 cursor-pointer border-0 bg-transparent p-0 hover:opacity-70">
                <ArrowUpIcon className="h-4 w-4 rotate-45 stroke-turquoise" />
              </button>
            )),
            O.getOrElse(() => <></>)
          )}
        </div>
      )

      return (
        <div
          key={H.getRowKey(action)}
          className="flex flex-col border-t-0 border-b border-solid border-gray0/40 p-2 first:border-t last:border-b-0 dark:border-gray0d/40">
          <div className="flex items-center justify-between">
            <TxType className="mr-2" type={action.type} showTypeIcon />
            {titleExtra}
          </div>
          <TxDetail incomes={H.getValues(action.in)} outgos={H.getValues(action.out)} network={network} isDesktopView />
        </div>
      )
    },
    [network]
  )

  const renderList = useCallback(
    ({ total, actions }: ActionsPage, loading = false) => {
      return (
        <>
          <div className="bg-bg1 dark:bg-bg1d">
            {loading ? <Spin className="min-h-40" /> : actions.map((action) => renderListItem(action, goToTx))}
          </div>

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
    [currentPage, changePaginationHandler, renderListItem, goToTx]
  )

  return (
    <div className={className}>
      {FP.pipe(
        historyPageRD,
        RD.fold(
          () => renderList(H.emptyData, true),
          () => {
            const data = FP.pipe(
              prevHistoryPage,
              O.getOrElse(() => H.emptyData)
            )
            return renderList(data, true)
          },
          ({ msg }) => (
            <ErrorView
              title={intl.formatMessage({ id: 'common.error' })}
              subTitle={msg}
              extra={<Button onClick={reloadHistory}>{intl.formatMessage({ id: 'common.retry' })}</Button>}
            />
          ),
          renderList
        )
      )}
    </div>
  )
}
