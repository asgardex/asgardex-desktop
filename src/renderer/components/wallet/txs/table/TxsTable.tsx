import { useMemo, useCallback, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { ArrowsRightLeftIcon } from '@heroicons/react/24/solid'
import { ColumnDef } from '@tanstack/react-table'
import { Network, Tx, TxsPage } from '@xchainjs/xchain-client'
import { Address, baseToAsset, Chain, formatAssetAmount } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useIntl, FormattedTime } from 'react-intl'

import { TxsPageRD } from '../../../../services/clients'
import { MAX_ITEMS_PER_PAGE } from '../../../../services/const'
import { RESERVE_MODULE_ADDRESS } from '../../../../services/thorchain/const'
import { ApiError } from '../../../../services/wallet/types'
import { FixmeType } from '../../../../types/asgardex'
import { CustomFormattedDate } from '../../../poolActionsHistory/PoolActionsHistory.helper'
import { ErrorView } from '../../../shared/error'
import { Table } from '../../../table'
import { AddressEllipsis } from '../../../uielements/addressEllipsis'
import { ReloadButton } from '../../../uielements/button'
import { Label } from '../../../uielements/label'
import { Pagination } from '../../../uielements/pagination'

type Props = {
  txsPageRD: TxsPageRD
  clickTxLinkHandler: (txHash: string) => void
  reloadHandler: FP.Lazy<void>
  changePaginationHandler: (page: number) => void
  network: Network
  chain: Chain
  walletAddress: Address
}

export const TxsTable = (props: Props): JSX.Element => {
  const { txsPageRD, clickTxLinkHandler, changePaginationHandler, network, chain, walletAddress, reloadHandler } = props
  const intl = useIntl()

  // store previous data of Txs to render these while reloading
  const previousTxs = useRef<O.Option<TxsPage>>(O.none)

  const renderTextWithBreak = useCallback(
    (text: string, key: string) => (
      <Label key={key} color="dark" textTransform="lowercase">
        {text}
        <br key={`${key}-br`} />
      </Label>
    ),
    []
  )

  const renderAddressWithBreak = useCallback(
    (address: Address, key: string) =>
      walletAddress === address ? (
        <Label key={key} color="dark" textTransform="uppercase">
          {intl.formatMessage({ id: 'common.address.self' })}
        </Label>
      ) : (
        <Label key={key} color="dark" textTransform="lowercase">
          <AddressEllipsis address={address} chain={chain} network={network} />
        </Label>
      ),
    [chain, network, walletAddress, intl]
  )

  const renderTypeColumn = useCallback(({ type }: Tx) => {
    switch (type) {
      case 'transfer':
        return <ArrowsRightLeftIcon className="w-5 h-5 text-text1 dark:text-text1d" />
      default:
        return <></>
    }
  }, [])

  const renderFromColumn = useCallback(
    ({ from }: Tx) =>
      from.map(({ from }, index) => {
        const key = `${from}-${index}`
        return renderAddressWithBreak(from, key)
      }),
    [renderAddressWithBreak]
  )

  const renderToColumn = useCallback(
    ({ to }: Tx) =>
      to.map(({ to }, index) => {
        const key = `${to}-${index}`
        // tag address as FEE in case of sending a tx to reserve module
        if (to === RESERVE_MODULE_ADDRESS)
          return (
            <div key={key} className="uppercase">
              {intl.formatMessage({ id: 'common.fee' })}
            </div>
          )

        return renderAddressWithBreak(to, key)
      }),
    [intl, renderAddressWithBreak]
  )

  const renderDateColumn = useCallback(
    ({ date }: Tx) => (
      <div className="flex flex-col">
        <Label color="dark" textTransform="lowercase">
          <CustomFormattedDate date={date} />
        </Label>
        <Label color="dark" textTransform="lowercase">
          <FormattedTime hour="2-digit" minute="2-digit" second="2-digit" hour12={false} value={date} />
        </Label>
      </div>
    ),
    []
  )

  const renderAmountColumn = useCallback(
    ({ to }: Tx) =>
      to.map(({ amount, to }, index) => {
        const key = `${to}-${index}`
        const text = formatAssetAmount({ amount: baseToAsset(amount), trimZeros: true })
        return renderTextWithBreak(text, key)
      }),
    [renderTextWithBreak]
  )

  const renderLinkColumn = useCallback(
    ({ hash }: Tx) => (
      <div className="flex items-center justify-center">
        <ArrowTopRightOnSquareIcon
          className="text-turquoise cursor-pointer w-5 h-5"
          onClick={() => clickTxLinkHandler(hash)}
        />
      </div>
    ),
    [clickTxLinkHandler]
  )

  const columns: ColumnDef<Tx, FixmeType>[] = useMemo(
    () => [
      {
        accessorKey: 'txType',
        header: '',
        cell: ({ row }) => <div className="flex items-center justify-center">{renderTypeColumn(row.original)}</div>,
        enableSorting: false,
        size: 60
      },
      {
        accessorKey: 'fromAddr',
        header: intl.formatMessage({ id: 'common.from' }),
        cell: ({ row }) => renderFromColumn(row.original),
        enableSorting: false,
        size: 80
      },
      {
        accessorKey: 'toAddr',
        header: intl.formatMessage({ id: 'common.to' }),
        cell: ({ row }) => renderToColumn(row.original),
        enableSorting: false
      },
      {
        accessorKey: 'value',
        header: intl.formatMessage({ id: 'common.amount' }),
        cell: ({ row }) => renderAmountColumn(row.original),
        enableSorting: false
      },
      {
        accessorKey: 'timeStamp',
        header: intl.formatMessage({ id: 'common.date' }),
        cell: ({ row }) => renderDateColumn(row.original),
        enableSorting: false,
        size: 100
      },
      {
        accessorKey: 'txHash',
        header: '',
        cell: ({ row }) => renderLinkColumn(row.original),
        enableSorting: false,
        size: 60
      }
    ],
    [intl, renderAmountColumn, renderDateColumn, renderFromColumn, renderLinkColumn, renderToColumn, renderTypeColumn]
  )

  const removeDuplicateTxs = (txsPage: TxsPage): TxsPage => {
    const seen = new Map<string, boolean>()
    const filteredTxs = txsPage.txs.filter((tx) => {
      if (!seen.has(tx.hash)) {
        seen.set(tx.hash, true)
        return true
      }
      return false
    })
    return {
      ...txsPage,
      txs: filteredTxs,
      total: filteredTxs.length // Update the total count if necessary
    }
  }

  const renderTable = useCallback(
    ({ total, txs }: TxsPage, loading = false) => {
      return (
        <>
          <Table loading={loading} columns={columns} data={txs} />
          {total > 0 && (
            <Pagination
              defaultCurrent={1}
              total={total}
              defaultPageSize={MAX_ITEMS_PER_PAGE}
              showSizeChanger={false}
              onChange={changePaginationHandler}
            />
          )}
        </>
      )
    },
    [columns, changePaginationHandler]
  )

  const emptyTableData = useMemo((): TxsPage => ({ total: 0, txs: [] as Tx[] }), [])

  const renderContent = useMemo(
    () => (
      <>
        {RD.fold(
          () => renderTable(emptyTableData, true),
          () => {
            const data = FP.pipe(
              previousTxs.current,
              O.getOrElse(() => emptyTableData)
            )
            return renderTable(data, true)
          },
          (e: ApiError) => {
            const extra = (
              <ReloadButton size="normal" onClick={reloadHandler} label={intl.formatMessage({ id: 'common.retry' })} />
            )
            return <ErrorView title={e.msg} extra={extra} />
          },
          (data: TxsPage): JSX.Element => {
            previousTxs.current = O.some(data)
            const uniqueData = removeDuplicateTxs(data)
            return renderTable(uniqueData)
          }
        )(txsPageRD)}
      </>
    ),
    [txsPageRD, renderTable, emptyTableData, reloadHandler, intl]
  )

  return renderContent
}
