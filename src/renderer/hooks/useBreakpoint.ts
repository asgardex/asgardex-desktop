import { useEffect, useState } from 'react'

const breakpointMap = {
  xs: '(max-width: 575px)',
  sm: '(min-width: 576px)',
  md: '(min-width: 768px)',
  lg: '(min-width: 992px)',
  xl: '(min-width: 1200px)',
  xxl: '(min-width: 1600px)'
}

type Breakpoint = keyof typeof breakpointMap

export const useBreakpoint = () => {
  const [screens, setScreens] = useState<Record<Breakpoint, boolean>>({
    xs: false,
    sm: false,
    md: false,
    lg: false,
    xl: false,
    xxl: false
  })

  useEffect(() => {
    const mediaQueryLists: Partial<Record<Breakpoint, MediaQueryList>> = {}
    const keys = Object.keys(breakpointMap) as Breakpoint[]

    const handleChange = () => {
      const updated: Record<Breakpoint, boolean> = { ...screens }
      keys.forEach((key) => {
        const mql = mediaQueryLists[key]
        updated[key] = !!mql?.matches
      })
      setScreens(updated)
    }

    keys.forEach((key) => {
      const query = breakpointMap[key]
      const mql = window.matchMedia(query)
      mediaQueryLists[key] = mql
      mql.addEventListener('change', handleChange)
    })

    handleChange()

    return () => {
      keys.forEach((key) => {
        mediaQueryLists[key]?.removeEventListener('change', handleChange)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return screens
}
