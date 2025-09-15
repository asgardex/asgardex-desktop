import styled from 'styled-components'
import { palette } from 'styled-theme'

import { Button as ButtonUI, ButtonProps } from '../uielements/button'

const filterButtonBorderRadius = 15

export const FilterButton = styled(ButtonUI)<ButtonProps & { active: 'true' | 'false' }>`
  margin-right: 10px;
  &:last-child {
    margin: 0;
  }

  padding: 0 12px;
  min-width: 0;
  border-radius: ${filterButtonBorderRadius}px;
  border: solid 1px ${palette('gray', 1)} !important;
  background: ${({ active }) => (active === 'true' ? palette('primary', 2) : palette('background', 0))} !important;
  color: ${({ active }) => (active === 'true' ? '#fff' : palette('text', 2))};
  border: none;

  &.focused,
  &:active,
  &:focus {
    border-color: ${({ active }) => (active === 'true' ? palette('primary', 2) : palette('gray', 1))} !important;
    color: ${({ active }) => (active === 'true' ? '#fff' : palette('text', 1))};
  }
  &:hover {
    background: ${({ active }) => (active === 'true' ? palette('primary', 2) : palette('background', 0))} !important;
    border-color: ${({ active }) => (active === 'true' ? palette('primary', 2) : palette('gray', 1))} !important;
    color: ${({ active }) => (active === 'true' ? '#fff' : palette('primary', 2))};
  }
`
