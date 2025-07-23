import { Fragment, useState } from 'react'
import { SignalIcon } from '@heroicons/react/24/outline'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid'
import {
  ColumnDef,
  ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  OnChangeFn,
  SortingState,
  useReactTable
} from '@tanstack/react-table'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { FixmeType } from '../../types/asgardex'
import { Label } from '../uielements/label'

type TableProps<T extends object> = {
  loading?: boolean
  hideHeader?: boolean
  hideVerticalBorder?: boolean
  expandable?: boolean
  expanded?: ExpandedState
  setExpanded?: OnChangeFn<ExpandedState>
  getRowId?: (row: T, index: number) => string
  renderSubRow?: (row: T) => React.ReactNode
  data: T[]
  columns: ColumnDef<T, FixmeType>[]
  onClickRow?: (row: T) => void
}

export const Table = <T extends object>({
  data,
  columns,
  expandable = false,
  expanded,
  setExpanded,
  getRowId,
  renderSubRow,
  loading = false,
  hideHeader = false,
  hideVerticalBorder = false,

  onClickRow
}: TableProps<T>) => {
  const [sorting, setSorting] = useState<SortingState>([])
  const intl = useIntl()

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    ...(expandable
      ? {
          state: {
            expanded,
            sorting
          },
          onExpandedChange: setExpanded,
          getRowId,
          getExpandedRowModel: getExpandedRowModel()
        }
      : {
          state: {
            sorting
          }
        })
  })

  return (
    <table className="w-full table-fixed">
      {!hideHeader && (
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="h-16 bg-bg1 dark:bg-bg1d border border-solid border-gray0/40 dark:border-gray0d/40"
                  style={header.getSize() ? { width: header.getSize(), maxWidth: header.getSize() } : undefined}
                  onClick={header.column.getToggleSortingHandler()}>
                  {header.isPlaceholder ? null : (
                    <div
                      className={clsx(
                        'flex items-center justify-center cursor-pointer px-2 space-x-2',
                        header.column.columnDef.meta
                      )}>
                      {header.column.columnDef.header && (
                        <Label color="gray" textTransform="uppercase">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </Label>
                      )}
                      {header.column.getCanSort() && (
                        <div className="flex flex-col">
                          <ChevronUpIcon
                            className={clsx(
                              'w-3 h-3',
                              header.column.getIsSorted() === 'asc' ? 'text-turquoise' : 'text-gray1 dark:text-gray1d'
                            )}
                          />
                          <ChevronDownIcon
                            className={clsx(
                              'w-3 h-3',
                              header.column.getIsSorted() === 'desc' ? 'text-turquoise' : 'text-gray1 dark:text-gray1d'
                            )}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
      )}
      <tbody>
        {loading && (
          <tr>
            <td
              className="border border-solid border-gray0/40 dark:border-gray0d/40"
              colSpan={table.getAllLeafColumns().length}>
              <div className="bg-bg1 dark:bg-bg1d min-h-28 w-full flex items-center justify-center space-x-2">
                <SignalIcon className="w-6 h-6 animate-spin text-turquoise" />
                <Label className="!w-auto" textTransform="uppercase">
                  {intl.formatMessage({ id: 'common.loading' })}
                </Label>
              </div>
            </td>
          </tr>
        )}
        {!loading &&
          table.getRowModel().rows.map((row) => (
            <Fragment key={row.id}>
              <tr
                className="cursor-pointer hover:bg-[#ededed] dark:hover:bg-[#252c33]"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onClickRow) onClickRow(row.original)
                }}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className={clsx(
                      hideVerticalBorder ? 'border-x-0 border-y' : 'border',
                      'px-2 bg-bg1 dark:bg-bg1d h-16 border border-solid border-gray0/40 dark:border-gray0d/40 text-center uppercase'
                    )}
                    style={cell.column.getSize() ? { width: cell.column.getSize() } : undefined}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
              {row.getIsExpanded() && renderSubRow && (
                <tr>
                  <td className="border border-solid border-gray0/40 dark:border-gray0d/40" colSpan={columns.length}>
                    {renderSubRow(row.original)}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
      </tbody>
    </table>
  )
}
