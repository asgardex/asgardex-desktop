import { ThemeType } from '@asgardex/asgardex-theme'
import { Observable } from 'rxjs'

import { initialContext } from './ThemeContext'

const { themeType$, toggleTheme } = initialContext

const firstThemeType = (obs$: Observable<ThemeType>): Promise<ThemeType> =>
  new Promise((resolve) => {
    obs$.subscribe((val) => resolve(val))
  })

describe('ThemeContext', () => {
  describe('ThemeContextValue', () => {
    beforeEach(() => {})
    describe('themeType$', () => {
      it('returns light theme as default', async () => {
        const type = await firstThemeType(themeType$)
        expect(type).toBe(ThemeType.LIGHT)
      })
    })
    describe('toggleTheme$', () => {
      it('toggles light to dark theme', async () => {
        const result: ThemeType[] = []
        const expected: ThemeType[] = [ThemeType.LIGHT, ThemeType.DARK]

        const values = await new Promise<ThemeType[]>((resolve) => {
          themeType$.subscribe((type) => {
            result.push(type)
            if (result.length >= 2) {
              resolve(result)
            }
          })
          toggleTheme()
        })

        expect(values).toStrictEqual(expected)
      })
    })
  })
})
