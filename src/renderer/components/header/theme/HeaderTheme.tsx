import { useCallback, useMemo } from 'react'

import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { useTheme } from '../../../hooks/useTheme'
import { Label } from '../../uielements/label'
import * as Styled from './HeaderTheme.styles'

export type Props = {
  onPress?: FP.Lazy<void>
  isDesktopView: boolean
}

export const HeaderTheme = (props: Props): JSX.Element => {
  const { onPress = FP.constVoid, isDesktopView } = props

  const intl = useIntl()

  const { isLight: isLightTheme, toggle: toggleTheme } = useTheme()

  const clickSwitchThemeHandler = useCallback(() => {
    toggleTheme()
    onPress()
  }, [toggleTheme, onPress])

  const desktopView = useMemo(
    () => (isLightTheme ? <Styled.DayThemeIcon /> : <Styled.NightThemeIcon />),
    [isLightTheme]
  )

  const mobileView = useMemo(() => {
    const label = intl.formatMessage({ id: isLightTheme ? 'common.theme.light' : 'common.theme.dark' })

    return (
      <div className="flex items-center justify-between px-4 w-full">
        <Label size="large" textTransform="uppercase" weight="bold">
          {label}
        </Label>
        {isLightTheme ? <Styled.DayThemeIcon /> : <Styled.NightThemeIcon />}
      </div>
    )
  }, [intl, isLightTheme])

  return (
    <div className="w-full lg:w-auto" onClick={() => clickSwitchThemeHandler()}>
      {isDesktopView ? desktopView : mobileView}
    </div>
  )
}
