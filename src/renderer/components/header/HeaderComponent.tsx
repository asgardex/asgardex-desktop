import { useMemo, useState, useCallback, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import clsx from 'clsx'
import { function as FP, array as A, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'
import { useMatch, Link, useNavigate, useLocation } from 'react-router-dom'

import CloseIcon from '../../assets/svg/icon-close.svg?react'
import MenuIcon from '../../assets/svg/icon-menu.svg?react'
import SwapIcon from '../../assets/svg/icon-swap.svg?react'
import WalletIcon from '../../assets/svg/icon-wallet.svg?react'
import AsgardexLogo from '../../assets/svg/logo-asgardex.svg?react'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import * as appRoutes from '../../routes/app'
import * as poolsRoutes from '../../routes/pools'
import * as walletRoutes from '../../routes/wallet'
import {
  MidgardStatusRD,
  MidgardUrlRD,
  PricePool,
  PricePools,
  PriceRD,
  SelectedPricePoolAsset,
  MidgardStatusRD as MidgardStatusMayaRD,
  MidgardUrlRD as MidgardMayaUrlRD
} from '../../services/midgard/midgardTypes'
import { MimirRD } from '../../services/thorchain/types'
import { ChangeKeystoreWalletHandler, KeystoreState, KeystoreWalletsUI } from '../../services/wallet/types'
import { isLocked } from '../../services/wallet/util'
import { PricePoolAsset, PricePoolAssets } from '../../views/pools/Pools.types'
import { Drawer } from '../uielements/drawer'
import { Label } from '../uielements/label'
import { HeaderLock } from './lock/'
import { HeaderLockMobile } from './lock/HeaderLockMobile'
import { HeaderNetStatus } from './netstatus'
import { HeaderPriceSelector } from './price'
import { HeaderSettings } from './settings'
import { HeaderStats } from './stats/HeaderStats'
import { HeaderTheme } from './theme'

enum TabKey {
  POOLS = 'POOLS',
  WALLET = 'WALLET',
  UNKNOWN = 'UNKNOWN'
}

type Tab = {
  key: TabKey
  label: string
  path: string
  icon: typeof SwapIcon // all icon types are as same as `SwapIcon`
}

export type Props = {
  keystore: KeystoreState
  wallets: KeystoreWalletsUI
  network: Network
  lockHandler: FP.Lazy<void>
  changeWalletHandler$: ChangeKeystoreWalletHandler
  setSelectedPricePool: (asset: PricePoolAsset) => void
  pricePools: O.Option<PricePools>
  runePrice: PriceRD
  reloadRunePrice: FP.Lazy<void>
  tcyPrice: RD.RemoteData<Error, string>
  reloadTcyPrice: FP.Lazy<void>
  mayaPrice: PriceRD
  reloadMayaPrice: FP.Lazy<void>
  volume24PriceRune: PriceRD
  volume24PriceMaya: PriceRD
  reloadVolume24PriceRune: FP.Lazy<void>
  reloadVolume24PriceMaya: FP.Lazy<void>
  selectedPricePoolAsset: SelectedPricePoolAsset
  midgardStatus: MidgardStatusRD
  midgardMayaStatus: MidgardStatusMayaRD
  mimir: MimirRD
  midgardUrl: MidgardUrlRD
  midgardMayaUrl: MidgardMayaUrlRD
  thorchainNodeUrl: string
  thorchainRpcUrl: string
  mayachainNodeUrl: string
  mayachainRpcUrl: string
}

export const HeaderComponent = (props: Props): JSX.Element => {
  const {
    keystore,
    wallets,
    pricePools: oPricePools,
    runePrice: runePriceRD,
    tcyPrice: tcyPriceRD,
    mayaPrice: mayaPriceRD,
    midgardStatus: midgardStatusRD,
    midgardMayaStatus: midgardMayaStatusRD,
    mimir: mimirRD,
    reloadRunePrice,
    reloadTcyPrice,
    reloadMayaPrice,
    volume24PriceRune: volume24PriceRD,
    volume24PriceMaya: volume24PriceMayaRD,
    reloadVolume24PriceRune,
    reloadVolume24PriceMaya,
    selectedPricePoolAsset: oSelectedPricePoolAsset,
    lockHandler,
    changeWalletHandler$,
    setSelectedPricePool,
    midgardUrl: midgardUrlRD,
    midgardMayaUrl: midgardMayaUrlRD,
    thorchainNodeUrl,
    thorchainRpcUrl,
    mayachainNodeUrl,
    mayachainRpcUrl
  } = props

  const intl = useIntl()

  const navigate = useNavigate()
  const location = useLocation()

  // store previous data to render it while reloading new data
  const prevPricePoolAssets = useRef<PricePoolAssets>()

  const pricePoolAssets = useMemo(() => {
    return FP.pipe(
      oPricePools,
      O.map(A.map((pool: PricePool) => pool.asset)),
      O.map((assets) => {
        prevPricePoolAssets.current = assets
        return assets
      }),
      O.getOrElse(() => prevPricePoolAssets?.current ?? [])
    )
  }, [oPricePools])

  const hasPricePools = useMemo(() => pricePoolAssets.length > 0, [pricePoolAssets])

  const [menuVisible, setMenuVisible] = useState(false)

  const isDesktopView = useBreakpoint()?.lg ?? false

  const toggleMenu = useCallback(() => {
    setMenuVisible(!menuVisible)
  }, [menuVisible])

  const closeMenu = useCallback(() => {
    if (!isDesktopView) {
      setMenuVisible(false)
    }
  }, [isDesktopView])

  const matchPoolsRoute = useMatch({ path: poolsRoutes.base.path(), end: false })
  const matchWalletRoute = useMatch({ path: walletRoutes.base.path(), end: false })

  const activeKey: TabKey = useMemo(() => {
    if (matchPoolsRoute) {
      return TabKey.POOLS
    } else if (matchWalletRoute) {
      return TabKey.WALLET
    } else {
      return TabKey.UNKNOWN
    }
  }, [matchPoolsRoute, matchWalletRoute])

  const items: Tab[] = useMemo(
    () => [
      {
        key: TabKey.POOLS,
        label: intl.formatMessage({ id: 'common.pools' }),
        path: poolsRoutes.base.path(),
        icon: SwapIcon
      },
      {
        key: TabKey.WALLET,
        label: intl.formatMessage({ id: 'common.wallet' }),
        path: walletRoutes.base.path(),
        icon: WalletIcon
      }
    ],
    [intl]
  )

  const links = useMemo(
    () =>
      items.map(({ label, key, path, icon: Icon }, index) => (
        <Link key={key} to={path} onClick={closeMenu}>
          <div
            className={clsx(
              'flex items-center h-[60px] border-b border-solid border-bg2 dark:border-bg2d',
              activeKey === key ? 'text-turquoise' : 'text-text1 dark:text-text1d',
              { 'border-t': index === 0 }
            )}>
            <Icon className="ml-6 mr-3" />
            <Label color="dark" size="large" textTransform="uppercase" weight="bold">
              {label}
            </Label>
          </div>
        </Link>
      )),
    [closeMenu, items, activeKey]
  )

  const clickSettingsHandler = useCallback(() => {
    closeMenu()
    navigate(appRoutes.settings.path())
  }, [closeMenu, navigate])

  const clickLockHandler = useCallback(() => {
    // lock if needed ...
    if (!isLocked(keystore)) {
      lockHandler()
    } else {
      // ... or go to wallet page to unlock
      navigate(walletRoutes.base.path(location.pathname))
    }
    closeMenu()
  }, [keystore, closeMenu, lockHandler, navigate, location.pathname])

  const currencyChangeHandler = useCallback(
    (asset: PricePoolAsset) => {
      setSelectedPricePool(asset)
    },
    [setSelectedPricePool]
  )

  const renderHeaderCurrency = useMemo(
    () => (
      <HeaderPriceSelector
        disabled={!hasPricePools}
        isDesktopView={isDesktopView}
        selectedAsset={oSelectedPricePoolAsset}
        assets={pricePoolAssets}
        changeHandler={currencyChangeHandler}
      />
    ),
    [hasPricePools, isDesktopView, oSelectedPricePoolAsset, pricePoolAssets, currencyChangeHandler]
  )

  const renderHeaderSettings = useMemo(
    () => <HeaderSettings isDesktopView={isDesktopView} onPress={clickSettingsHandler} />,
    [isDesktopView, clickSettingsHandler]
  )

  const renderHeaderNetStatus = useMemo(
    () => (
      <HeaderNetStatus
        isDesktopView={isDesktopView}
        midgardStatus={midgardStatusRD}
        midgardMayaStatus={midgardMayaStatusRD}
        mimirStatus={mimirRD}
        midgardUrl={midgardUrlRD}
        midgardMayaUrl={midgardMayaUrlRD}
        thorchainNodeUrl={thorchainNodeUrl}
        thorchainRpcUrl={thorchainRpcUrl}
        mayachainNodeUrl={mayachainNodeUrl}
        mayachainRpcUrl={mayachainRpcUrl}
      />
    ),
    [
      isDesktopView,
      midgardStatusRD,
      midgardMayaStatusRD,
      mimirRD,
      midgardUrlRD,
      midgardMayaUrlRD,
      thorchainNodeUrl,
      thorchainRpcUrl,
      mayachainNodeUrl,
      mayachainRpcUrl
    ]
  )

  const headerRef = useRef<O.Option<HTMLElement>>(O.none)
  const setHeaderRef = useCallback((ref: HTMLElement | null) => {
    headerRef.current = O.fromNullable(ref)
  }, [])

  return (
    <div className="!bg-bg3 dark:!bg-bg3d">
      <div className="flex items-center justify-between h-[70px]" ref={setHeaderRef}>
        <HeaderStats
          runePrice={runePriceRD}
          tcyPrice={tcyPriceRD}
          mayaPrice={mayaPriceRD}
          reloadRunePrice={reloadRunePrice}
          reloadTcyPrice={reloadTcyPrice}
          reloadMayaPrice={reloadMayaPrice}
          volume24PriceRune={volume24PriceRD}
          volume24PriceMaya={volume24PriceMayaRD}
          reloadVolume24PriceRune={reloadVolume24PriceRune}
          reloadVolume24PriceMaya={reloadVolume24PriceMaya}
        />
        {isDesktopView ? (
          <div className="flex items-center space-x-2">
            {renderHeaderNetStatus}
            <HeaderTheme isDesktopView={isDesktopView} />
            {renderHeaderCurrency}
            <HeaderLock
              keystoreState={keystore}
              wallets={wallets}
              lockHandler={clickLockHandler}
              changeWalletHandler$={changeWalletHandler$}
            />
            {renderHeaderSettings}
          </div>
        ) : (
          <div className="flex items-center h-[70px] cursor-pointer" onClick={toggleMenu}>
            {menuVisible ? (
              <CloseIcon className="[&>*]:fill-text0 [&>*]:dark:fill-text0d text-[24px] mr-5" />
            ) : (
              <MenuIcon className="[&>*]:fill-text0 [&>*]:dark:fill-text0d text-[24px] mr-5" />
            )}
          </div>
        )}
      </div>
      {!isDesktopView && (
        <Drawer
          title={<AsgardexLogo className="text-text2 dark:text-text2d [&>*]:fill-current" />}
          isOpen={menuVisible}
          onClose={() => setMenuVisible(false)}>
          {links}
          <div className="flex items-center h-[60px] border-b border-solid border-bg2 dark:border-bg2d">
            {renderHeaderCurrency}
          </div>
          <div className="flex items-center h-[60px] border-b border-solid border-bg2 dark:border-bg2d">
            <HeaderTheme isDesktopView={isDesktopView} />
          </div>
          <div className="flex items-center h-[60px] border-b border-solid border-bg2 dark:border-bg2d">
            <HeaderLockMobile keystoreState={keystore} onPress={clickLockHandler} />
          </div>
          <div className="flex items-center h-[60px] border-b border-solid border-bg2 dark:border-bg2d">
            {renderHeaderSettings}
          </div>
          {renderHeaderNetStatus}
        </Drawer>
      )}
    </div>
  )
}
