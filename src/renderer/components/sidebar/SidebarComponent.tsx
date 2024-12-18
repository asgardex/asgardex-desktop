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
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'
import { useMatch, useNavigate } from 'react-router-dom'

import { ExternalUrl } from '../../../shared/const'
import { ReactComponent as DiscordIcon } from '../../assets/svg/discord.svg'
import { ReactComponent as SettingsIcon } from '../../assets/svg/icon-cog.svg'
import { ReactComponent as PoolIcon } from '../../assets/svg/icon-pools.svg'
import { ReactComponent as PortfolioIcon } from '../../assets/svg/icon-portfolio.svg'
import { ReactComponent as SwapIcon } from '../../assets/svg/icon-swap.svg'
import { ReactComponent as WalletIcon } from '../../assets/svg/icon-wallet.svg'
import { ReactComponent as ThorChainIcon } from '../../assets/svg/logo-thorchain.svg'
import { DEFAULT_WALLET_TYPE } from '../../const'
import * as appRoutes from '../../routes/app'
import * as playgroundRoutes from '../../routes/playground'
import * as poolsRoutes from '../../routes/pools'
import * as portfolioRoutes from '../../routes/portfolio'
import * as walletRoutes from '../../routes/wallet'
import { mayaIconT } from '../icons'
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

  const matchPoolsRoute = useMatch({ path: poolsRoutes.base.path(), end: false })
  const matchPortfolioRoute = useMatch({ path: portfolioRoutes.base.path(), end: false })
  const matchWalletRoute = useMatch({ path: walletRoutes.base.path(), end: false })
  const matchSettingsRoute = useMatch({ path: appRoutes.settings.path(), end: false })
  const matchSwapRoute = useMatch({ path: poolsRoutes.swapBase.template, end: false })

  const activeKey: TabKey = useMemo(() => {
    if (matchSwapRoute) {
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
  }, [matchPoolsRoute, matchPortfolioRoute, matchWalletRoute, matchSettingsRoute, matchSwapRoute])

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
      <div className="mt-8">
        {items.map(({ label, key, path, icon: Icon }) => {
          const selected = activeKey === key
          return (
            <div
              key={key}
              className={clsx(
                'flex h-full cursor-pointer',
                'font-mainBold text-18 uppercase',
                'transition duration-300 ease-in-out',
                'border-x-[3px] border-solid border-transparent',
                'hover:border-l-turquoise hover:text-turquoise focus-visible:outline-none',
                selected ? 'border-l-turquoise text-turquoise' : 'border-l-transparent text-text2 dark:text-text2d'
              )}
              onClick={() => navigate(path)}>
              <div className="flex flex-row items-center py-3 pl-8">
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
    <>
      <Styled.HeaderContainer>
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
              <div className="h-8 items-center px-20px text-[14px] text-gray2 dark:text-gray2d">
                Public IP: {publicIP}
              </div>
            )}
            <div>
              <FooterIcon url={ExternalUrl.ASGARDEX} onClick={clickIconHandler}>
                <GlobalOutlined />
              </FooterIcon>
              <FooterIcon url={ExternalUrl.GITHUB_REPO} onClick={clickIconHandler}>
                <GithubOutlined />
              </FooterIcon>
              <FooterIcon url={ExternalUrl.DISCORD} onClick={clickIconHandler}>
                <Icon component={DiscordIcon} />
              </FooterIcon>
              <FooterIcon url={ExternalUrl.TWITTER} onClick={clickIconHandler}>
                <TwitterOutlined />
              </FooterIcon>
              <FooterIcon url={ExternalUrl.LICENSE} onClick={clickIconHandler}>
                <FileTextOutlined />
              </FooterIcon>
              {/* hidden in production build */}
              {isDev && commitHash && (
                <FooterIcon url={`${ExternalUrl.GITHUB_REPO}/commit/${commitHash}`} onClick={clickIconHandler}>
                  <BranchesOutlined />
                </FooterIcon>
              )}
              {/* hidden in production build */}
              {isDev && (
                <Styled.IconWrapper onClick={gotoPlayground}>
                  <BugOutlined />
                </Styled.IconWrapper>
              )}
            </div>
          </div>
        </div>
      </Styled.HeaderContainer>
    </>
  )
}
