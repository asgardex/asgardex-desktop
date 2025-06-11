/* eslint-disable @typescript-eslint/no-explicit-any */
import { TableProps } from 'antd/lib/table'
import clsx from 'clsx'

import { TableWrapper } from './Table.styles'

type Props = {
  className?: string
}

export const Table = (props: Props & TableProps<any>): JSX.Element => {
  const { className = '', ...otherProps } = props

  return <TableWrapper className={clsx('table-wrapper', className)} pagination={false} {...otherProps} />
}
