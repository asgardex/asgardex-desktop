import { Layout } from 'antd'
import styled from 'styled-components'

import { media } from '../helpers/styleHelper'

export const ViewWrapper = styled(Layout.Content)`
  display: flex;
  width: 100%;
  flex-direction: column;
  overflow: auto;
  padding: 20px 10px;

  ${media.md`
    padding: 20px;
  `}

  ${media.lg`
    width: calc(100vw - 240px);
    padding: 30px 50px;
  `}
`
