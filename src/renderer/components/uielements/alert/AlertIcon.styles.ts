import { ExclamationCircleIcon } from '@heroicons/react/24/outline'
import styled from 'styled-components'
import { palette } from 'styled-theme'

export type Color = 'primary' | 'warning' | 'error' | 'grey'

export const AlertIcon = styled(ExclamationCircleIcon)<{ color: Color }>`
  stroke: ${({ color }) => palette(color, 0)};
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 3px;
  width: 16px;
  height: 16px;
`
