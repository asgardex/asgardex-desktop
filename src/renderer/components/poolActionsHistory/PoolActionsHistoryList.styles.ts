import { ArrowUpIcon } from '@heroicons/react/24/outline'
import styled from 'styled-components'
import { palette } from 'styled-theme'

import { Button as UIButton } from '../uielements/button'

export const InfoArrow = styled(ArrowUpIcon)`
  transform: rotateZ(45deg);
  stroke: ${palette('primary', 2)}; /* Heroicons use stroke for outline */
  width: 16px; /* Match Ant Design's default size */
  height: 16px;
`

export const GoToButton = styled(UIButton).attrs({ typevalue: 'transparent' })`
  display: inline-block;
  min-width: 0;
  padding: 0;
`
