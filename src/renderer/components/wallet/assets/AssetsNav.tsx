import React, { useMemo } from 'react'

import { ItemType } from 'antd/lib/menu/hooks/useItems'
import { array as A, function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'
import { Link, matchPath, useLocation } from 'react-router-dom'

import * as walletRoutes from '../../../routes/wallet'
import * as Styled from './AssetsNav.styles'

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

export const AssetsNav: React.FC = (): JSX.Element => {
  const intl = useIntl()

  const { pathname } = useLocation()

  const menuItems = useMemo(
    () =>
      [
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
      ] as MenuType[],
    [intl]
  )

  const assetsRoute = matchPath(walletRoutes.assets.path(), pathname)
  const tradeAssetsRoute = matchPath(walletRoutes.tradeAssets.path(), pathname)
  const poolSharesRoute = matchPath(walletRoutes.poolShares.path(), pathname)
  const tcyRoute = matchPath(walletRoutes.tcy.path(), pathname)
  const runepoolRoute = matchPath(walletRoutes.runepool.path(), pathname)
  const matchHistoryRoute = matchPath(walletRoutes.history.path(), pathname)

  const activeMenu: MenuKey = useMemo(() => {
    if (assetsRoute) {
      return MenuKey.ASSETS
    } else if (tradeAssetsRoute) {
      return MenuKey.TRADEASSETS
    } else if (poolSharesRoute) {
      return MenuKey.POOLSHARES
    } else if (tcyRoute) {
      return MenuKey.TCY
    } else if (runepoolRoute) {
      return MenuKey.RUNEPOOL
    } else if (matchHistoryRoute) {
      return MenuKey.HISTORY
    } else {
      return MenuKey.UNKNOWN
    }
  }, [assetsRoute, tradeAssetsRoute, poolSharesRoute, tcyRoute, runepoolRoute, matchHistoryRoute])

  return (
    <>
      <Styled.MenuDropdownGlobalStyles />
      <Styled.Menu
        mode="horizontal"
        selectedKeys={[activeMenu]}
        triggerSubMenuAction={'click'}
        items={FP.pipe(
          menuItems,
          A.map<MenuType, ItemType>(({ key, label, path }) => ({
            label: <Link to={path}>{label}</Link>,
            key
          }))
        )}
      />
    </>
  )
}
