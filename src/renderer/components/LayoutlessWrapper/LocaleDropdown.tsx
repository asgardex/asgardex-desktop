import { useMemo } from 'react'

import clsx from 'clsx'
import { function as FP, array as A } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import { DEFAULT_LOCALE } from '../../../shared/i18n/const'
import { Locale } from '../../../shared/i18n/types'
import { useI18nContext } from '../../contexts/I18nContext'
import { LOCALES } from '../../i18n'
import { DownIcon } from '../icons'
import { Dropdown } from '../uielements/dropdown'

export const LocaleDropdown = () => {
  const { changeLocale, locale$ } = useI18nContext()
  const currentLocale = useObservableState(locale$, DEFAULT_LOCALE)

  const langMenu = useMemo(
    () =>
      FP.pipe(
        LOCALES,
        A.map((l: Locale) => (
          <div
            key={l}
            className={clsx(
              'flex items-center text-sm uppercase px-2 py-1',
              l === currentLocale ? 'text-turquoise' : 'text-text1 dark:text-text1d'
            )}
            onClick={() => changeLocale(l)}>
            {l}
          </div>
        ))
      ),
    [changeLocale, currentLocale]
  )

  return (
    <Dropdown
      anchor={{ to: 'bottom', gap: 4 }}
      trigger={
        <div className="flex cursor-pointer items-center justify-between rounded-lg border border-solid border-gray0 px-2 py-1 dark:border-gray0d gap-x-2">
          <h3 className="m-0 font-main text-[16px] uppercase leading-5 text-text1 dark:text-text1d">{currentLocale}</h3>
          <DownIcon />
        </div>
      }
      options={langMenu}
    />
  )
}
