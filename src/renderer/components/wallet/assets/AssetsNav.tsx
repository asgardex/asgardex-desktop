import { useMemo } from 'react'
import { Menu, MenuButton, MenuItems, MenuItem, Transition } from '@headlessui/react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useIntl } from 'react-intl'
import { Link, matchPath, useLocation } from 'react-router-dom'
import * as walletRoutes from '../../../routes/wallet'
import { Label } from '../../uielements/label'

enum MenuKey {
  ASSETS = 'assets',
  TRADEASSETS = 'tradeAssets',
  POOLSHARES = 'poolshares',
  TCY = 'tcy',
  RUNEPOOL = 'runepool',
  HISTORY = 'history',
  WALLETSETTINGS = 'walletsettings',
  UNKNOWN = 'unknown'
}

type MenuType = {
  key: MenuKey
  label: string
  path: string
}

export const AssetsNav = (): JSX.Element => {
  const intl = useIntl()
  const { pathname } = useLocation()

  const menuItems: MenuType[] = useMemo(
    () => [
      {
        key: MenuKey.ASSETS,
        label: intl.formatMessage({ id: 'common.assets' }),
        path: walletRoutes.assets.path()
      },
      {
        key: MenuKey.TRADEASSETS,
        label: intl.formatMessage({ id: 'common.tradeAssets' }),
        path: walletRoutes.tradeAssets.path()
      },
      {
        key: MenuKey.POOLSHARES,
        label: intl.formatMessage({ id: 'wallet.nav.poolshares' }),
        path: walletRoutes.poolShares.path()
      },
      {
        key: MenuKey.TCY,
        label: intl.formatMessage({ id: 'wallet.nav.tcy' }),
        path: walletRoutes.tcy.path()
      },
      {
        key: MenuKey.RUNEPOOL,
        label: intl.formatMessage({ id: 'wallet.nav.runepool' }),
        path: walletRoutes.runepool.path()
      },
      {
        key: MenuKey.HISTORY,
        label: intl.formatMessage({ id: 'common.history' }),
        path: walletRoutes.history.path()
      }
    ],
    [intl]
  )

  const assetsRoute = matchPath(walletRoutes.assets.path(), pathname)
  const tradeAssetsRoute = matchPath(walletRoutes.tradeAssets.path(), pathname)
  const poolSharesRoute = matchPath(walletRoutes.poolShares.path(), pathname)
  const tcyRoute = matchPath(walletRoutes.tcy.path(), pathname)
  const runepoolRoute = matchPath(walletRoutes.runepool.path(), pathname)
  const matchHistoryRoute = matchPath(walletRoutes.history.path(), pathname)

  const activeMenu: MenuKey = useMemo(() => {
    if (assetsRoute) return MenuKey.ASSETS
    if (tradeAssetsRoute) return MenuKey.TRADEASSETS
    if (poolSharesRoute) return MenuKey.POOLSHARES
    if (tcyRoute) return MenuKey.TCY
    if (runepoolRoute) return MenuKey.RUNEPOOL
    if (matchHistoryRoute) return MenuKey.HISTORY
    return MenuKey.UNKNOWN
  }, [assetsRoute, tradeAssetsRoute, poolSharesRoute, tcyRoute, runepoolRoute, matchHistoryRoute])

  const activeItem = menuItems.find((m) => m.key === activeMenu) ?? menuItems[0]

  return (
    <nav className="w-full">
      <ul className="hidden md:flex items-center justify-center bg-bg0 dark:bg-bg0d rounded-t-lg gap-2 border-b border-gray0 dark:border-gray0d px-2 mb-0">
        {menuItems.map(({ key, label, path }) => {
          const isActive = key === activeMenu

          return (
            <li key={key}>
              <Link
                to={path}
                className={clsx(
                  'flex items-center gap-2 px-3 py-4 text-sm font-bold rounded-t-md',
                  'font-main text-16 uppercase border-b-2',
                  isActive
                    ? 'text-turquoise border-turquoise'
                    : 'text-text0 border-transparent dark:text-text0d hover:text-turquoise'
                )}>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="md:hidden">
        <Menu as="div" className="relative inline-block w-full">
          <MenuButton
            className={clsx(
              'flex w-full items-center justify-between rounded-t-md border-b border-gray0 dark:border-gray0d p-3',
              'bg-bg0 dark:bg-bg0d'
            )}>
            <Label size="big" textTransform="uppercase">
              {activeItem?.label}
            </Label>
            <ChevronDownIcon className="h-4 w-4 text-text0 dark:text-text0d" />
          </MenuButton>

          <Transition
            enter="transition ease-out duration-100"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95">
            <MenuItems
              anchor="bottom start"
              className={clsx(
                'absolute z-10 mt-1 w-[--button-width] min-w-[12rem] rounded-md shadow-lg',
                'border border-gray0 dark:border-gray0d',
                'bg-bg0 dark:bg-bg0d focus:outline-none'
              )}>
              <div className="py-1">
                {menuItems.map(({ key, label, path }) => {
                  const isActive = key === activeMenu
                  return (
                    <MenuItem key={key}>
                      {({ focus }) => (
                        <Link
                          to={path}
                          className={clsx(
                            'block px-3 py-2 text-sm uppercase',
                            focus ? 'bg-turquoise/10 text-turquoise' : 'text-text0 dark:text-text0d',
                            isActive && 'font-bold !text-turquoise'
                          )}>
                          {label}
                        </Link>
                      )}
                    </MenuItem>
                  )
                })}
              </div>
            </MenuItems>
          </Transition>
        </Menu>
      </div>
    </nav>
  )
}
