import React, { createContext, useContext } from 'react'

import t, { ThemeType, Theme } from '@asgardex/asgardex-theme'
import { useObservableState } from 'observable-hooks'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import * as SC from 'styled-components'

import 'antd/dist/antd.dark.css'
import 'antd/dist/antd.min.css'
import { observableState } from '../helpers/stateHelper'

const THEME_TYPE = 'asgdx-theme'

export const themes: typeof t = {
  ...t,
  dark: {
    ...t.dark,
    // extend background colors - needed for bg of table rows
    palette: {
      ...t.dark.palette,
      primary: [...t.dark.palette.primary, '#0068F7'],
      background: [
        '#111315', // 0: header, footer bg
        '#111315', // 1: main bg
        '#303942', // 2: hover
        '#000', // 3: content bg
        '#303942', // 4: popover bg
        '#252c33'
      ]
    }
  },
  light: {
    ...t.light,
    // extend background colors - needed for bg of table rows
    palette: {
      ...t.light.palette,
      primary: [...t.dark.palette.primary, '#0068F7'],
      gray: [
        '#daddee', // 50 off-white
        '#89939d', // 100 light grey
        '#616b75' // 200
      ],
      background: [
        '#fff', // 0: header, footer bg
        '#fff', // 1: main bg
        '#F3F4F4', // 2: hover
        '#F3F4F4', // 3: content bg
        '#fff', // 4: popover bg
        '#ededed'
      ]
    }
  }
}

const initialTheme = (): ThemeType => (localStorage.getItem(THEME_TYPE) as ThemeType) || ThemeType.LIGHT

const { get: themeType, get$: themeType$, set: setThemeType } = observableState<ThemeType>(initialTheme())

const toggleTheme = () => {
  const nextTheme = themeType() === ThemeType.DARK ? ThemeType.LIGHT : ThemeType.DARK
  localStorage.setItem(THEME_TYPE, nextTheme)
  setThemeType(nextTheme)
}

const theme$: Observable<Theme> = themeType$.pipe(
  map((type) => {
    if (type === ThemeType.LIGHT) return themes.light
    else return themes.dark
  })
)

type ThemeContextValue = {
  theme$: Observable<Theme>
  themeType$: Observable<ThemeType>
  toggleTheme: () => void
}

export const initialContext: ThemeContextValue = {
  theme$,
  themeType$,
  toggleTheme
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

type Props = {
  theme?: Theme // needed for storybook only
  children: React.ReactNode
}

export const ThemeProvider: React.FC<Props> = ({ children, theme }): JSX.Element => {
  const themeFromObservable = useObservableState(theme$)
  const selectedTheme = theme || themeFromObservable
  return (
    <ThemeContext.Provider value={initialContext}>
      <SC.ThemeProvider theme={{ ...selectedTheme }}>{children}</SC.ThemeProvider>
    </ThemeContext.Provider>
  )
}

export const useThemeContext = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('Context must be used within a ThemeProvider.')
  }
  return context
}
