import styled from 'styled-components'
import { palette } from 'styled-theme'

import { Table as UITable } from '../../../uielements/table'

export const Table = styled(UITable)`
  .ant-table-thead > tr > th {
    font-size: 14px;
    font-family: 'MainFontRegular';
    border: none;
    color: ${palette('gray', 2)};
    // Disable hover effect (as long as we don't have sorting for txs tables)
    pointer-events: none;
  }

  .ant-table-tbody > tr > td {
    border: none;
  }
`
