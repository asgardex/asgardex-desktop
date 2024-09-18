import React, { useMemo, useState, useCallback, useRef } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Row, Col, Grid } from 'antd'
import * as FP from 'fp-ts/function'
import * as A from 'fp-ts/lib/Array'
import * as O from 'fp-ts/lib/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useMatch, Link, useNavigate, useLocation } from 'react-router-dom'
import { palette, size } from 'styled-theme'

import { Dex, mayaDetails, thorDetails } from '../../../shared/api/types'
import { ReactComponent as CloseIcon } from '../../assets/svg/icon-close.svg'
import { ReactComponent as MenuIcon } from '../../assets/svg/icon-menu.svg'
import { ReactComponent as SwapIcon } from '../../assets/svg/icon-swap.svg'
import { ReactComponent as WalletIcon } from '../../assets/svg/icon-wallet.svg'
import { useThemeContext } from '../../contexts/ThemeContext'
import * as appRoutes from '../../routes/app'
import * as poolsRoutes from '../../routes/pools'
import * as walletRoutes from '../../routes/wallet'
import { MidgardStatusRD, MidgardUrlRD, PriceRD, SelectedPricePoolAsset } from '../../services/midgard/types'
import { MidgardStatusRD as MidgardStatusMayaRD, MidgardUrlRD as MidgardMayaUrlRD } from '../../services/midgard/types'
import { MimirRD } from '../../services/thorchain/types'
import { ChangeKeystoreWalletHandler, KeystoreState, KeystoreWalletsUI } from '../../services/wallet/types'
import { isLocked } from '../../services/wallet/util'
import { PricePoolAsset, PricePoolAssets, PricePools } from '../../views/pools/Pools.types'
import * as Styled from './HeaderComponent.styles'
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
  dex: Dex
  changeDex: (dex: Dex) => void
  lockHandler: FP.Lazy<void>
  changeWalletHandler$: ChangeKeystoreWalletHandler
  setSelectedPricePool: (asset: PricePoolAsset) => void
  pricePools: O.Option<PricePools>
  runePrice: PriceRD
  reloadRunePrice: FP.Lazy<void>
  mayaPrice: PriceRD
  reloadMayaPrice: FP.Lazy<void>
  volume24Price: PriceRD
  reloadVolume24Price: FP.Lazy<void>
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

export const HeaderComponent: React.FC<Props> = (props): JSX.Element => {
  const {
    keystore,
    wallets,
    dex,
    changeDex = FP.constVoid,
    pricePools: oPricePools,
    runePrice: runePriceRD,
    mayaPrice: mayaPriceRD,
    midgardStatus: midgardStatusRD,
    midgardMayaStatus: midgardMayaStatusRD,
    mimir: mimirRD,
    reloadRunePrice,
    reloadMayaPrice,
    volume24Price: volume24PriceRD,
    reloadVolume24Price,
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

  const { theme$ } = useThemeContext()
  const theme = useObservableState(theme$)

  // store previous data to render it while reloading new data
  const prevPricePoolAssets = useRef<PricePoolAssets>()

  const pricePoolAssets = useMemo(() => {
    return FP.pipe(
      oPricePools,
      O.map(A.map((pool) => pool.asset)),
      O.map((assets) => {
        prevPricePoolAssets.current = assets
        return assets
      }),
      O.getOrElse(() => prevPricePoolAssets?.current ?? [])
    )
  }, [oPricePools])

  const hasPricePools = useMemo(() => pricePoolAssets.length > 0, [pricePoolAssets])

  const [menuVisible, setMenuVisible] = useState(false)

  const isDesktopView = Grid.useBreakpoint()?.lg ?? false

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

  const headerHeight = useMemo(() => size('headerHeight', '70px')({ theme }), [theme])

  const links = useMemo(
    () =>
      items.map(({ label, key, path, icon: Icon }) => (
        <Link key={key} to={path} onClick={closeMenu}>
          <Styled.HeaderDrawerItem selected={activeKey === key}>
            <Icon style={{ marginLeft: '12px', marginRight: '12px' }} />
            {label}
          </Styled.HeaderDrawerItem>
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

  const iconStyle = { fontSize: '1.5em', marginRight: '20px' }
  const color = useMemo(() => palette('text', 0)({ theme }), [theme])

  const headerRef = useRef<O.Option<HTMLElement>>(O.none)
  const setHeaderRef = useCallback((ref: HTMLElement | null) => {
    headerRef.current = O.fromNullable(ref)
  }, [])

  /**
   * To display HeaderDrawer component right(!) after the Header one
   * we need to check Header's bottom-edge position. In case there is something
   * above the Header component at the layout (e.g. AppUpdate component) relying
   * just on the Header's height is not enough.
   */
  const getHeaderBottomPosition = useCallback(
    () =>
      FP.pipe(
        headerRef.current,
        O.map((header) => header.getBoundingClientRect().bottom),
        // `headerHeight ` is styled-components based property and can contain "px" at the string value
        // and parsingInt will get ONLY meaningful integer value
        O.getOrElse(() => parseInt(headerHeight, 10))
      ),
    [headerHeight]
  )

  const dexPrice = useMemo(() => {
    // Use 'dex' to determine which DEX prices to use
    if (dex.chain === THORChain) {
      return {
        price: runePriceRD,
        reloadPrice: reloadRunePrice
      }
    } else {
      return {
        price: mayaPriceRD,
        reloadPrice: reloadMayaPrice
      }
    }
  }, [dex, runePriceRD, reloadRunePrice, mayaPriceRD, reloadMayaPrice])
  const changeDexHandler = useCallback(() => {
    changeDex(dex.chain === THORChain ? mayaDetails : thorDetails)
  }, [changeDex, dex])
  return (
    <>
      <Styled.HeaderContainer>
        <Row justify="space-between" align="middle" style={{ height: headerHeight }} ref={setHeaderRef}>
          {isDesktopView && (
            <>
              <Col>
                <Row align="middle" style={{ height: headerHeight }}>
                  <HeaderStats
                    dex={dex}
                    changeDexHandler={changeDexHandler}
                    runePrice={dexPrice.price}
                    reloadRunePrice={dexPrice.reloadPrice}
                    volume24Price={volume24PriceRD}
                    reloadVolume24Price={reloadVolume24Price}
                  />
                </Row>
              </Col>
              <Col>
                <Row align="middle">
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
                </Row>
              </Col>
            </>
          )}
          {!isDesktopView && (
            <>
              <Row align="middle">
                <HeaderStats
                  dex={dex}
                  changeDexHandler={changeDexHandler}
                  runePrice={runePriceRD}
                  reloadRunePrice={reloadRunePrice}
                  volume24Price={volume24PriceRD}
                  reloadVolume24Price={reloadVolume24Price}
                />
              </Row>
              <Col>
                <Row align="middle" style={{ height: headerHeight, cursor: 'pointer' }} onClick={toggleMenu}>
                  {menuVisible ? (
                    <CloseIcon style={{ color, ...iconStyle }} />
                  ) : (
                    <MenuIcon style={{ color, ...iconStyle }} />
                  )}
                </Row>
              </Col>
            </>
          )}
        </Row>
        {!isDesktopView && (
          <Styled.HeaderDrawer
            style={{
              marginTop: getHeaderBottomPosition(),
              backgroundColor: 'transparent',
              maxHeight: `calc(100% - ${getHeaderBottomPosition()}px)`,
              overflow: 'auto'
            }}
            drawerStyle={{ backgroundColor: 'transparent' }}
            maskStyle={{ backgroundColor: 'transparent' }}
            placement="top"
            closable={false}
            height="auto"
            visible={menuVisible}
            key="top">
            {links}
            <Styled.HeaderDrawerItem>{renderHeaderCurrency}</Styled.HeaderDrawerItem>
            <Styled.HeaderDrawerItem>
              <HeaderTheme isDesktopView={isDesktopView} />
            </Styled.HeaderDrawerItem>
            <Styled.HeaderDrawerItem>
              <HeaderLockMobile keystoreState={keystore} onPress={clickLockHandler} />
            </Styled.HeaderDrawerItem>
            <Styled.HeaderDrawerItem>{renderHeaderSettings}</Styled.HeaderDrawerItem>
            {renderHeaderNetStatus}
          </Styled.HeaderDrawer>
        )}
      </Styled.HeaderContainer>
    </>
  )
}
