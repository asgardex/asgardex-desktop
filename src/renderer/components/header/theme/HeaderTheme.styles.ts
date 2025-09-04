import styled from 'styled-components'
import { palette } from 'styled-theme'

import DayThemeIconUI from '../../../assets/svg/icon-theme-day.svg?react'
import NightThemeIconUI from '../../../assets/svg/icon-theme-night.svg?react'

export const DayThemeIcon = styled(DayThemeIconUI)`
  cursor: pointer;
  font-size: '1.5em';
  & path {
    fill: ${palette('text', 2)};
  }
`

export const NightThemeIcon = styled(NightThemeIconUI)`
  cursor: pointer;
  font-size: '1.5em';
  & path {
    fill: ${palette('text', 0)};
  }
`
