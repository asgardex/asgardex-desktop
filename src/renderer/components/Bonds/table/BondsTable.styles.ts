import styled from 'styled-components'
import { palette } from 'styled-theme'

import { Table as UITable } from '../../uielements/table'

export const Table = styled(UITable)`
  .ant-table-thead > tr {
    background: ${palette('gray', 0)};
    & > th {
      font-size: 14px;
      border: none;
      padding-top: 6px;
      padding-bottom: 6px;
      height: auto;
      background: none !important;
      color: ${palette('gray', 2)};
      font-weight: 300;

      &:hover {
        background: none !important;
      }
    }
  }

  .ant-table-tbody > tr {
    &:hover {
      &:has(td + td) > td {
        // TODO: table hover styles
        background: ${palette('background', 1)} !important;
      }
    }

    & > td {
      border-bottom: 1px solid ${palette('gray', 0)};
      padding: 10px 0 10px 15px;
      height: auto;

      &:last-child {
        padding-right: 15px;
      }
    }
  }
`
