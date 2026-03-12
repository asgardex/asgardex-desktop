import React, { memo, useMemo, useCallback, useRef } from 'react'

import { AssetBTC } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { AssetRuneNative } from '@xchainjs/xchain-thorchain'
import { assetToString } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { option as O } from 'fp-ts'
import { useIntl } from 'react-intl'
import { useMatch, useNavigate } from 'react-router-dom'

import { ExternalUrl } from '../../../shared/const'
import BondsIcon from '../../assets/svg/icon-bonds.svg?react'
import BranchIcon from '../../assets/svg/icon-branch.svg?react'
import BugIcon from '../../assets/svg/icon-bug.svg?react'
import SettingsIcon from '../../assets/svg/icon-cog.svg?react'
import DiscordIcon from '../../assets/svg/icon-discord.svg?react'
import FileIcon from '../../assets/svg/icon-file.svg?react'
import GithubIcon from '../../assets/svg/icon-github.svg?react'
import GlobeIcon from '../../assets/svg/icon-globe.svg?react'
import HistoryIcon from '../../assets/svg/icon-history.svg?react'
import PoolIcon from '../../assets/svg/icon-pools.svg?react'
import PortfolioIcon from '../../assets/svg/icon-portfolio.svg?react'
import SwapIcon from '../../assets/svg/icon-swap.svg?react'
import TwitterIcon from '../../assets/svg/icon-twitter.svg?react'
import WalletIcon from '../../assets/svg/icon-wallet.svg?react'
import AsgardexLogo from '../../assets/svg/logo-asgardex.svg?react'
import { useChainflipContext } from '../../contexts/ChainflipContext'
import { useMayachainContext } from '../../contexts/MayachainContext'
import { useThorchainContext } from '../../contexts/ThorchainContext'
import { useWalletContext } from '../../contexts/WalletContext'
import * as appRoutes from '../../routes/app'
import * as bondsRoutes from '../../routes/bonds'
import * as historyRoutes from '../../routes/history'
import * as playgroundRoutes from '../../routes/playground'
import * as poolsRoutes from '../../routes/pools'
import * as portfolioRoutes from '../../routes/portfolio'
import * as walletRoutes from '../../routes/wallet'
import { Label } from '../uielements/label'
import { Tooltip } from '../uielements/tooltip'
import { TransactionSlideshow } from '../uielements/transactionProgress/TransactionSlideshow'

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
    <div
      className={clsx(
        'ml-3 inline cursor-pointer text-text1 first:ml-0 dark:text-text1d [&>svg]:text-text1 [&>svg]:dark:text-text1d',
        className
      )}
      onClick={clickHandler}>
      {children}
    </div>
  )
}

enum TabKey {
  WALLET = 'WALLET',
  SWAP = 'SWAP',
  BONDS = 'BONDS',
  PORTFOLIO = 'PORTFOLIO',
  POOLS = 'POOLS',
  HISTORY = 'History',
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
}

export const SidebarComponent = memo(function SidebarComponent(props: Props): JSX.Element {
  const { network, commitHash, isDev } = props

  const intl = useIntl()
  const { transactionTrackingService } = useThorchainContext()
  const { transactionTrackingService: mayaTransactionTrackingService } = useMayachainContext()
  const { transactionTrackingService: chainflipTransactionTrackingService } = useChainflipContext()
  const { appWalletService } = useWalletContext()

  const navigate = useNavigate()

  const matchBondsRoute = useMatch({ path: bondsRoutes.base.path(), end: false })
  const matchHistoryRoute = useMatch({ path: historyRoutes.base.path(), end: false })
  const matchPoolsRoute = useMatch({ path: poolsRoutes.base.path(), end: false })
  const matchPortfolioRoute = useMatch({ path: portfolioRoutes.base.path(), end: false })
  const matchWalletRoute = useMatch({ path: walletRoutes.base.path(), end: false })
  const matchSettingsRoute = useMatch({ path: appRoutes.settings.path(), end: false })
  const matchSwapRoute = useMatch({ path: poolsRoutes.swapBase.template, end: false })

  const activeKey: TabKey = useMemo(() => {
    if (matchBondsRoute) return TabKey.BONDS
    if (matchSwapRoute) return TabKey.SWAP
    if (matchPoolsRoute) return TabKey.POOLS
    if (matchPortfolioRoute) return TabKey.PORTFOLIO
    if (matchWalletRoute) return TabKey.WALLET
    if (matchHistoryRoute) return TabKey.HISTORY
    if (matchSettingsRoute) return TabKey.SETTINGS

    return TabKey.UNKNOWN
  }, [
    matchBondsRoute,
    matchSwapRoute,
    matchPoolsRoute,
    matchPortfolioRoute,
    matchWalletRoute,
    matchHistoryRoute,
    matchSettingsRoute
  ])

  const networkBgCn = useMemo(() => {
    if (network === Network.Mainnet) return 'bg-turquoise'
    else if (network === Network.Stagenet) return 'bg-error0 dark:bg-error0d'
    else if (network === Network.Testnet) return 'bg-warning0 dark:bg-warning0d'
    return 'bg-text2 dark:bg-text2d'
  }, [network])

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
          sourceWalletType: appWalletService.getCurrentWalletType(),
          targetWalletType: appWalletService.getCurrentWalletType()
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
        key: TabKey.HISTORY,
        label: intl.formatMessage({ id: 'common.transaction' }),
        path: historyRoutes.base.path(),
        icon: HistoryIcon
      },
      {
        key: TabKey.SETTINGS,
        label: intl.formatMessage({ id: 'common.settings' }),
        path: appRoutes.settings.path(),
        icon: SettingsIcon
      }
    ],
    [intl, appWalletService]
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
                'flex cursor-pointer rounded-lg',
                'font-main-bold text-18 uppercase',
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
      <div className="mt-4 flex flex-col items-center justify-center">
        <AsgardexLogo className="[&>*]:fill-text1 [&>*]:dark:fill-text1d" />
        <Label
          className={clsx('-mt-3 !w-auto rounded-full px-2', networkBgCn)}
          color="white"
          size="small"
          textTransform="uppercase">
          {network}
        </Label>
      </div>
    ),
    [network, networkBgCn]
  )

  const clickIconHandler = useCallback((url: string) => {
    window.apiUrl.openExternal(url)
  }, [])

  const gotoPlayground = useCallback(() => navigate(playgroundRoutes.base.path()), [navigate])

  return (
    <div className="h-full w-60 border-r border-none border-gray0 !bg-bg0 py-5 dark:border-gray0d dark:!bg-bg0d">
      <div className="flex h-full flex-col justify-between" ref={setHeaderRef}>
        <div className="flex flex-1 flex-col">
          {renderLogo}
          {renderMainNav}
          <TransactionSlideshow
            thorchainTransactionTrackingService={transactionTrackingService}
            mayachainTransactionTrackingService={mayaTransactionTrackingService}
            chainflipTransactionTrackingService={chainflipTransactionTrackingService}
            className="mx-4 mt-6"
          />
          <div className="flex-1" />
        </div>
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-center justify-center">
            <FooterIcon url={ExternalUrl.ASGARDEX} onClick={clickIconHandler}>
              <Tooltip title={intl.formatMessage({ id: 'sidebar.tooltip.website' })}>
                <GlobeIcon className="h-5 w-5" />
              </Tooltip>
            </FooterIcon>
            <FooterIcon url={ExternalUrl.GITHUB_REPO} onClick={clickIconHandler}>
              <Tooltip title={intl.formatMessage({ id: 'sidebar.tooltip.github' })}>
                <GithubIcon className="h-5 w-5" />
              </Tooltip>
            </FooterIcon>
            <FooterIcon url={ExternalUrl.DISCORD} onClick={clickIconHandler}>
              <Tooltip title={intl.formatMessage({ id: 'sidebar.tooltip.discord' })}>
                <DiscordIcon className="h-5 w-5" />
              </Tooltip>
            </FooterIcon>
            <FooterIcon url={ExternalUrl.TWITTER} onClick={clickIconHandler}>
              <Tooltip title={intl.formatMessage({ id: 'sidebar.tooltip.twitter' })}>
                <TwitterIcon className="h-5 w-5" />
              </Tooltip>
            </FooterIcon>
            <FooterIcon url={ExternalUrl.LICENSE} onClick={clickIconHandler}>
              <Tooltip title={intl.formatMessage({ id: 'sidebar.tooltip.license' })}>
                <FileIcon className="h-5 w-5" />
              </Tooltip>
            </FooterIcon>
            {/* hidden in production build */}
            {isDev && commitHash && (
              <FooterIcon url={`${ExternalUrl.GITHUB_REPO}/commit/${commitHash}`} onClick={clickIconHandler}>
                <Tooltip title={intl.formatMessage({ id: 'sidebar.tooltip.commitHash' })}>
                  <BranchIcon className="h-5 w-5" />
                </Tooltip>
              </FooterIcon>
            )}
            {/* hidden in production build */}
            {isDev && (
              <div
                className="ml-3 inline cursor-pointer text-text1 dark:text-text1d [&>svg]:text-text1 [&>svg]:dark:text-text1d"
                onClick={gotoPlayground}>
                <Tooltip title={intl.formatMessage({ id: 'sidebar.tooltip.playground' })}>
                  <BugIcon className="h-5 w-5" />
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
