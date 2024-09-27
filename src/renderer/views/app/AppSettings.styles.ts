import styled from 'styled-components'
import { palette } from 'styled-theme'

import { Tabs as TabsUI } from '../../components/tabs/Tabs'

export const Tabs = styled(TabsUI)`
  padding-top: 0;
  .ant-tabs {
    &-nav {
      margin: 0;

      &:before {
        border-bottom: 1px solid ${palette('gray', 0)};
      }

      &-list {
        padding: 10px 0;
      }

      &-wrap {
        justify-content: start !important;
      }
    }

    &-tabpane {
      > div {
        padding: 0px;
      }
    }
  }
`
