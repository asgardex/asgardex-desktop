import { useCallback, useMemo } from 'react'

import { Dropdown } from 'antd'
import { MenuProps } from 'antd/lib/menu'
import { ItemType } from 'antd/lib/menu/hooks/useItems'
import clsx from 'clsx'
import { function as FP, array as A } from 'fp-ts'
import { useObservableState } from 'observable-hooks'

import { DEFAULT_LOCALE } from '../../../shared/i18n/const'
import { Locale } from '../../../shared/i18n/types'
import { useI18nContext } from '../../contexts/I18nContext'
import { LOCALES } from '../../i18n'
import { DownIcon } from '../icons'
import { Menu } from '../shared/menu'

export const LocaleDropdown = () => {
  const { changeLocale, locale$ } = useI18nContext()
  const currentLocale = useObservableState(locale$, DEFAULT_LOCALE)

  const changeLang: MenuProps['onClick'] = useCallback(
    ({ key }: { key: string }) => {
      changeLocale(key as Locale)
    },
    [changeLocale]
  )

  const langMenu = useMemo(
    () => (
      <Menu
        onClick={changeLang}
        items={FP.pipe(
          LOCALES,
          A.map<Locale, ItemType>((l: Locale) => ({
            label: (
              <div
                className={clsx(
                  'flex items-center p-2 text-sm uppercase rounded-xl',
                  l === currentLocale ? 'text-turquoise' : 'text-text1 dark:text-text1d'
                )}>
                {l}
              </div>
            ),
            key: l
          }))
        )}
      />
    ),
    [changeLang, currentLocale]
  )

  return (
    <Dropdown overlay={langMenu} trigger={['click']} placement="bottom">
      <div className="flex cursor-pointer items-center justify-between rounded-lg border border-solid border-gray0 px-2 py-1 dark:border-gray0d gap-x-2">
        <h3 className="m-0 font-main text-[16px] uppercase leading-5 text-text1 dark:text-text1d">{currentLocale}</h3>
        <DownIcon />
      </div>
    </Dropdown>
  )
}
