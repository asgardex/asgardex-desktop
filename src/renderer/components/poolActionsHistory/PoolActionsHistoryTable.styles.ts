import styled from 'styled-components'
import { palette } from 'styled-theme'

import { media } from '../../helpers/styleHelper'
import { Table as UITable } from '../uielements/table'
import { TxType as TxTypeUI } from '../uielements/txType'

export const Table = styled(UITable)`
  .ant-table {
    &-thead > tr {
      & > th {
        font-size: 14px;
        font-family: 'MainFontRegular';
        color: ${palette('text', 0)};
        font-weight: 600;
        &,
        &:hover {
          background: ${palette('background', 0)} !important;
        }
      }
    }

    &-tbody > tr {
      & > td {
        height: auto;
        padding-top: 8px;
        // Every TxDetail's pill needs additional margin-bottom: 5px
        // for the case when they are placed by 2+ rows to have margins between
        // each others. Here we subtract 5px from targeted 8px to center all items
        padding-bottom: 3px;
      }
    }
  }
`

export const TxType = styled(TxTypeUI)`
  & .label-wrapper {
    display: none;
  }

  ${media.lg`
    & .label-wrapper {
      display: initial;
    }
  `}
`
