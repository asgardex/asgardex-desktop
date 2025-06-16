import { Layout, Drawer } from 'antd'
import styled from 'styled-components'
import { palette, size } from 'styled-theme'

export const HeaderContainer = styled(Layout.Header)`
  height: ${size('headerHeight', '70px')};
  width: 100%;

  /* Make sure following id's are defined in svg */
  #menu_icon,
  #close_icon,
  #theme_switch_icon {
    & > * {
      fill: ${palette('text', 1)};
    }
  }

  /* Make sure following id's are defined in svg */
  #theme_switch_icon,
  #lock_icon,
  #unlock_icon,
  #settings_icon {
    cursor: pointer;
  }

  .ant-tabs-nav {
    &::before {
      /* hide border */
      border-bottom: 0;
    }
  }

  .ant-tabs-bar {
    border-bottom: 0;
  }

  .ant-tabs-tab {
    padding: 0 20px;
  }

  .ant-tabs-tab-active {
  }

  .ant-tabs-ink-bar {
    height: 5px;
    background: ${palette('gradient', 0)};
  }

  padding: 0px;
`

export const HeaderDrawer = styled(Drawer)`
  .ant-drawer-body {
    margin: 4px 4px 0px 4px;
    padding: 0;
    border-radius: 5px;
    background-color: ${palette('background', 0)};
  }

  .ant-drawer-content {
    background-color: transparent;
  }
`
