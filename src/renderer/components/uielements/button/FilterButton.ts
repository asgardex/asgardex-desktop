import styled from 'styled-components'
import { palette } from 'styled-theme'

import { Button as ButtonUI } from './Button'
import type { ButtonProps } from './Button.types'

export const FilterButton = styled(ButtonUI)<ButtonProps & { active: 'true' | 'false' }>`
  margin-right: 10px;
  &:last-child {
    margin: 0;
  }

  &.ant-btn {
    padding: 0 12px;
    min-width: 0;
    border-radius: 16px;
    border: solid 1px ${palette('gray', 1)} !important;
    background: ${({ active }) => (active === 'true' ? palette('background', 0) : palette('gray', 0))} !important;
    color: ${({ active }) => (active === 'true' ? palette('text', 1) : palette('text', 2))};
    border: none;

    &.focused,
    &:hover,
    &:active,
    &:focus {
      border-color: ${palette('gray', 1)} !important;
      color: ${palette('text', 1)} !important;
    }
    &:hover {
      background: ${palette('background', 0)} !important;
    }
  }
`
