import React, { useMemo, useCallback, useRef } from 'react'

import Icon, {
  BranchesOutlined,
  BugOutlined,
  FileTextOutlined,
  GithubOutlined,
  GlobalOutlined,
  TwitterOutlined
} from '@ant-design/icons'
import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { assetToString } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { option as O } from 'fp-ts'
import { useIntl } from 'react-intl'
import { useMatch, useNavigate } from 'react-router-dom'

import { ExternalUrl } from '../../../shared/const'
import DiscordIcon from '../../assets/svg/discord.svg?react'
import BondsIcon from '../../assets/svg/icon-bonds.svg?react'
import SettingsIcon from '../../assets/svg/icon-cog.svg?react'
import PoolIcon from '../../assets/svg/icon-pools.svg?react'
import PortfolioIcon from '../../assets/svg/icon-portfolio.svg?react'
import SwapIcon from '../../assets/svg/icon-swap.svg?react'
import WalletIcon from '../../assets/svg/icon-wallet.svg?react'
import ThorChainIcon from '../../assets/svg/logo-thorchain.svg?react'
import { DEFAULT_WALLET_TYPE } from '../../const'
import * as appRoutes from '../../routes/app'
import * as bondsRoutes from '../../routes/bonds'
import * as playgroundRoutes from '../../routes/playground'
import * as poolsRoutes from '../../routes/pools'
import * as portfolioRoutes from '../../routes/portfolio'
import * as walletRoutes from '../../routes/wallet'
import { mayaIconT } from '../icons'
import { Tooltip } from '../uielements/common/Common.styles'
import * as Styled from './SidebarComponent.styles'

type IconProps = {
  className?: string
  url: string
  children: React.ReactNode
  onClick: (url: string) => void
}

const FooterIcon = (props: IconProps): JSX.Element => {
  const { className = '', children, url, onClick } = props

  const clickHandler = useCallback(() => {
    onClick(url)
  }, [url, onClick])

  return (
    <Styled.IconWrapper className={className} onClick={clickHandler}>
      {children}
    </Styled.IconWrapper>
  )
}

enum TabKey {
  WALLET = 'WALLET',
  SWAP = 'SWAP',
  BONDS = 'BONDS',
  PORTFOLIO = 'PORTFOLIO',
  POOLS = 'POOLS',
  SETTINGS = 'SETTINGS',
  UNKNOWN = 'UNKNOWN'
}

type Tab = {
  key: TabKey
  label: string
  path: string
  icon: typeof SwapIcon // all icon types are as same as `SwapIcon`
}

export type Props = {
  network: Network
  commitHash?: string
  isDev: boolean
  publicIP: string
}

export const SidebarComponent = (props: Props): JSX.Element => {
  const { network, commitHash, isDev, publicIP } = props

  const intl = useIntl()

  const navigate = useNavigate()

  const matchBondsRoute = useMatch({ path: bondsRoutes.base.path(), end: false })
  const matchPoolsRoute = useMatch({ path: poolsRoutes.base.path(), end: false })
  const matchPortfolioRoute = useMatch({ path: portfolioRoutes.base.path(), end: false })
  const matchWalletRoute = useMatch({ path: walletRoutes.base.path(), end: false })
  const matchSettingsRoute = useMatch({ path: appRoutes.settings.path(), end: false })
  const matchSwapRoute = useMatch({ path: poolsRoutes.swapBase.template, end: false })

  const activeKey: TabKey = useMemo(() => {
    if (matchBondsRoute) {
      return TabKey.BONDS
    } else if (matchSwapRoute) {
      return TabKey.SWAP
    } else if (matchPoolsRoute) {
      return TabKey.POOLS
    } else if (matchPortfolioRoute) {
      return TabKey.PORTFOLIO
    } else if (matchWalletRoute) {
      return TabKey.WALLET
    } else if (matchSettingsRoute) {
      return TabKey.SETTINGS
    } else {
      return TabKey.UNKNOWN
    }
  }, [matchBondsRoute, matchPoolsRoute, matchPortfolioRoute, matchWalletRoute, matchSettingsRoute, matchSwapRoute])

  const items: Tab[] = useMemo(
    () => [
      {
        key: TabKey.WALLET,
        label: intl.formatMessage({ id: 'common.wallet' }),
        path: walletRoutes.base.path(),
        icon: WalletIcon
      },
      {
        key: TabKey.SWAP,
        label: intl.formatMessage({ id: 'common.swap' }),
        path: poolsRoutes.swap.path({
          source: assetToString(AssetBTC),
          target: assetToString(AssetRuneNative),
          sourceWalletType: DEFAULT_WALLET_TYPE,
          targetWalletType: DEFAULT_WALLET_TYPE
        }),
        icon: SwapIcon
      },
      {
        key: TabKey.BONDS,
        label: intl.formatMessage({ id: 'wallet.nav.bonds' }),
        path: bondsRoutes.base.path(),
        icon: BondsIcon
      },
      {
        key: TabKey.PORTFOLIO,
        label: intl.formatMessage({ id: 'wallet.nav.portfolio' }),
        path: portfolioRoutes.base.path(),
        icon: PortfolioIcon
      },
      {
        key: TabKey.POOLS,
        label: intl.formatMessage({ id: 'common.pools' }),
        path: poolsRoutes.base.path(),
        icon: PoolIcon
      },
      {
        key: TabKey.SETTINGS,
        label: intl.formatMessage({ id: 'common.settings' }),
        path: appRoutes.settings.path(),
        icon: SettingsIcon
      }
    ],
    [intl]
  )

  const renderMainNav = useMemo(
    () => (
      <div className="mx-4 mt-8 space-y-1">
        {items.map(({ label, key, path, icon: Icon }) => {
          const selected = activeKey === key
          return (
            <div
              key={key}
              className={clsx(
                'flex h-full cursor-pointer rounded-lg',
                'font-mainBold text-18 uppercase',
                'transition duration-100 ease-in-out',
                'focus-visible:outline-none',
                selected
                  ? 'bg-turquoise text-white hover:text-white'
                  : 'text-text2 hover:bg-turquoise/20 hover:text-turquoise dark:text-text2d'
              )}
              onClick={() => navigate(path)}>
              <div className="flex flex-row items-center py-3 pl-4">
                <Icon className="w-8 pr-5px" />
                <span>{label}</span>
              </div>
            </div>
          )
        })}
      </div>
    ),
    [activeKey, items, navigate]
  )

  const headerRef = useRef<O.Option<HTMLElement>>(O.none)
  const setHeaderRef = useCallback((ref: HTMLElement | null) => {
    headerRef.current = O.fromNullable(ref)
  }, [])

  const renderLogo = useMemo(
    () => (
      <Styled.LogoWrapper>
        <Styled.AsgardexLogo />
        <Styled.NetworkLabel network={network}>{network}</Styled.NetworkLabel>
      </Styled.LogoWrapper>
    ),
    [network]
  )

  const clickIconHandler = useCallback((url: string) => {
    window.apiUrl.openExternal(url)
  }, [])

  const gotoPlayground = useCallback(() => navigate(playgroundRoutes.base.path()), [navigate])

  return (
    <Styled.HeaderContainer className="border-r border-none border-gray0 !bg-bg0 dark:border-gray0d dark:!bg-bg0d">
      <div className="flex h-full flex-col justify-between" ref={setHeaderRef}>
        <div>
          <Styled.LogoWrapper>{renderLogo}</Styled.LogoWrapper>
          {renderMainNav}
        </div>
        <div className="flex flex-col items-center justify-center">
          <FooterIcon url={ExternalUrl.DOCSTHOR} onClick={clickIconHandler}>
            <div className="flex h-12 flex-row items-center">
              <ThorChainIcon />
            </div>
          </FooterIcon>
          <FooterIcon className="!ml-0" url={ExternalUrl.DOCSMAYA} onClick={clickIconHandler}>
            <div className="flex h-12 flex-row items-center">
              <div className="mr-2">
                <Styled.Icon src={mayaIconT} />
              </div>
              <div>
                <Styled.TextLabel>MAYACHAIN</Styled.TextLabel>
              </div>
            </div>
          </FooterIcon>
          {publicIP && (
            <div className="h-8 items-center px-20px text-[14px] text-text2 dark:text-text2d">
              Public IP: {publicIP}
            </div>
          )}
          <div>
            <FooterIcon url={ExternalUrl.ASGARDEX} onClick={clickIconHandler}>
              <Tooltip title="Asgardex Website">
                <GlobalOutlined />
              </Tooltip>
            </FooterIcon>
            <FooterIcon url={ExternalUrl.GITHUB_REPO} onClick={clickIconHandler}>
              <Tooltip title="Asgardex GitHub">
                <GithubOutlined />
              </Tooltip>
            </FooterIcon>
            <FooterIcon url={ExternalUrl.DISCORD} onClick={clickIconHandler}>
              <Tooltip title="Asgardex Discord">
                <Icon component={DiscordIcon} />
              </Tooltip>
            </FooterIcon>
            <FooterIcon url={ExternalUrl.TWITTER} onClick={clickIconHandler}>
              <Tooltip title="Asgardex X">
                <TwitterOutlined />
              </Tooltip>
            </FooterIcon>
            <FooterIcon url={ExternalUrl.LICENSE} onClick={clickIconHandler}>
              <Tooltip title="MIT License">
                <FileTextOutlined />
              </Tooltip>
            </FooterIcon>
            {/* hidden in production build */}
            {isDev && commitHash && (
              <FooterIcon url={`${ExternalUrl.GITHUB_REPO}/commit/${commitHash}`} onClick={clickIconHandler}>
                <Tooltip title="Commit Hash">
                  <BranchesOutlined />
                </Tooltip>
              </FooterIcon>
            )}
            {/* hidden in production build */}
            {isDev && (
              <Styled.IconWrapper onClick={gotoPlayground}>
                <Tooltip title="Playground">
                  <BugOutlined />
                </Tooltip>
              </Styled.IconWrapper>
            )}
          </div>
        </div>
      </div>
    </Styled.HeaderContainer>
  )
}
