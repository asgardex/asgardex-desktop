import * as A from 'antd'
import styled from 'styled-components'
import { palette } from 'styled-theme'

export const DropdownSelectorWrapper = styled.div<{ disabled: boolean }>`
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};

  & .anticon-caret-down {
    transition: transform 0.3s;
    transform: translateY(0px);
    & > svg {
      width: 100%;
      height: 100%;
    }
  }
  & .ant-select-selection {
    background-color: transparent;
  }
  &.ant-dropdown-open {
    & .anticon-caret-down {
      transform: rotateZ(180deg);
    }
  }
`

export const Menu = styled(A.Menu)`
  background-color: ${palette('background', 0)};

  > .ant-dropdown-menu-item {
    &:hover,
    &:focus,
    &:active {
      background: ${palette('background', 2)} !important;
    }

    &-selected {
      background: ${palette('background', 2)} !important;
    }
  }
`
