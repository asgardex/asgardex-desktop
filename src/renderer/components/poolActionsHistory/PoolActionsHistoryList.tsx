import { useCallback } from 'react'

import * as RD from '@devexperts/remote-data-ts'
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
import * as Styled from './PoolActionsHistoryList.styles'

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
    (action: Action, index: number, goToTx: OpenExplorerTxUrl) => {
      const date = H.renderDate(action.date)

      const titleExtra = (
        <div className="flex items-center">
          {date}
          {FP.pipe(
            action,
            H.getTxId,
            O.map((id) => (
              <Styled.GoToButton key="go" onClick={() => goToTx(id)}>
                <Styled.InfoArrow />
              </Styled.GoToButton>
            )),
            O.getOrElse(() => <></>)
          )}
        </div>
      )

      return (
        <div
          key={H.getRowKey(action, index)}
          className="flex flex-col p-2 border-t-0 first:border-t last:border-b-0 border-b border-solid border-gray0/40 dark:border-gray0d/40">
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
            {loading ? (
              <Spin className="min-h-40" />
            ) : (
              actions.map((action, index) => renderListItem(action, index, goToTx))
            )}
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
