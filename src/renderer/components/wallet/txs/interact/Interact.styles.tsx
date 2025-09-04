import styled, { createGlobalStyle } from 'styled-components'
import { palette } from 'styled-theme'

import { media } from '../../../../helpers/styleHelper'
import { Menu as MenuUI } from '../../../shared/menu'
import { Button as UIButton } from '../../../uielements/button'
import { WalletTypeLabel as WalletTypeLabelUI } from '../../../uielements/common/Common.styles'
import { Fees as UIFees } from '../../../uielements/fees'
import { Label as UILabel } from '../../../uielements/label'

export const Container = styled('div')`
  min-height: 100%;
  width: 100%;
  max-width: 630px;
  display: flex;
  flex-direction: column;
  padding: 10px;

  ${media.sm`
    padding: 35px 50px 150px;
  `}
`

export const WalletTypeLabel = styled(WalletTypeLabelUI)`
  margin-left: 10px;
`

export const FormWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
`

export const TabButtonsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  margin-bottom: 40px;
`

export const SubmitButton = styled(UIButton).attrs({
  color: 'primary',
  round: 'true',
  sizevalue: 'xnormal'
})`
  width: auto;

  ${media.sm`
    width: auto;
  `}
`

export const InputContainer = styled('div')`
  width: 100%;
  ${media.sm`
    max-width: 630px;
  `}
`

export const InputLabel = styled(UILabel)`
  padding: 0;
  font-size: 14px;
  text-transform: uppercase;
  color: ${palette('gray', 2)};
`

export const Fees = styled(UIFees)`
  padding-bottom: 20px;
`

const commonItemStyles = `
  .ant-menu-item {
    font-family: 'MainFontSemiBold';
    font-size: 16px;
    color: ${palette('text', 0)};
  }

  .ant-menu-item a {
    color: ${palette('text', 0)};
    text-transform: uppercase;
  }
`

/**
 * Used as global styles as Ant renders extra-content as dropdown in a React.Portal
 * and we can not style it with Menu
 */
export const MenuDropdownGlobalStyles = createGlobalStyle`
  .ant-menu-submenu.ant-menu-submenu-popup {
    .ant-menu.ant-menu-sub  {
      background: ${palette('background', 0)};
      padding: 4px;

      ${commonItemStyles}

      .ant-menu-item {
        color: ${palette('text', 0)};
        border-radius: 8px;
      }

      .ant-menu-item div.interact-menu {
        color: ${palette('text', 0)};
      }

      .ant-menu-item:hover {
        background-color: ${palette('primary', 2)}33;
        border-radius: 8px;

        div {
          color: ${palette('primary', 2)};
        }
      }

      .ant-menu-item-active,
      .ant-menu-item-selected {
        background-color: ${palette('primary', 2)};
        border-radius: 8px;
      }

      .ant-menu-item-selected div.interact-menu {
        color: #fff;
      }
    }
}
`

export const Menu = styled(MenuUI)`
  display: flex;
  align-items: center;
  border: none;

  &.ant-menu-horizontal .ant-menu-item:not(:first-child) {
    margin-left: 4px;
  }

  &.ant-menu-horizontal .ant-menu-item,
  &.ant-menu-horizontal > .ant-menu-item::after {
    transition: none;
  }

  &.ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-item-selected {
    background: ${palette('primary', 2)};
    border-radius: 8px;
  }

  &.ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-item:hover {
    background: ${palette('primary', 2)}33;
    border-radius: 8px;

    div {
      color: ${palette('primary', 2)};
    }
  }

  &.ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-item:hover::after,
  &.ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-item-active::after,
  &.ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-item-open::after,
  &.ant-menu-horizontal:not(.ant-menu-dark) > .ant-menu-item-selected::after {
    border-bottom: none;
  }

  ${commonItemStyles}

  .ant-menu-item {
    color: ${palette('text', 0)};
  }

  .ant-menu-item div.interact-menu {
    color: ${palette('text', 0)};
  }

  .ant-menu-item div.interact-menu:hover {
    color: ${palette('primary', 2)};
  }

  .ant-menu-item-selected div.interact-menu {
    color: #fff;
  }

  .ant-menu-submenu {
    border-color: ${palette('primary', 2)} !important;

    .ant-menu-submenu-title {
      color: ${palette('text', 0)};

      &:hover {
        color: ${palette('primary', 2)};
      }
    }
  }
`
