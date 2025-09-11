import { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { CpuChipIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { clsx } from 'clsx'
import { function as FP, array as A, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { Locale } from '../../../shared/i18n/types'
import { useWalletContext } from '../../contexts/WalletContext'
import { LOCALES } from '../../i18n'
import * as walletRoutes from '../../routes/wallet'
import { AVAILABLE_NETWORKS } from '../../services/const'
import { isStandaloneLedgerMode, isKeystoreUnlocked } from '../../services/wallet/types'
import { useApp } from '../../store/app/hooks'
import { DownIcon } from '../icons'
import { BorderButton } from '../uielements/button'
import { SwitchButton } from '../uielements/button/SwitchButton'
import { Dropdown } from '../uielements/dropdown'
import { Label } from '../uielements/label'
import * as Styled from './AppSettings.styles'

type Props = {
  version: string
  locale: Locale
  changeLocale: (locale: Locale) => void
  network: Network
  changeNetwork: (network: Network) => void
  appUpdateState: RD.RemoteData<Error, O.Option<string>>
  checkForUpdates: FP.Lazy<void>
  goToReleasePage: (version: string) => void
}

type SectionProps = {
  title: string
  subtitle: string
  children?: React.ReactNode
  className?: string
}

const Section = ({ title, subtitle, className, children }: SectionProps) => (
  <div
    className={clsx(
      'flex w-full items-center justify-between py-6 px-4',
      'border-b border-solid border-gray0 last:border-none dark:border-gray0d',
      className
    )}>
    <div className="flex flex-col">
      <h2 className="mb-5px font-main text-[16px] uppercase text-text2 dark:text-text2d">{title}</h2>
      <span className="font-main text-gray1 dark:text-gray1d">{subtitle}</span>
    </div>
    <div className="flex flex-col">{children}</div>
  </div>
)

export const AppGeneralSettings = (props: Props) => {
  const {
    appUpdateState = RD.initial,
    changeNetwork = FP.constVoid,
    network,
    checkForUpdates,
    goToReleasePage = FP.constVoid,
    version,
    changeLocale,
    locale
  } = props

  const { isPrivate, changePrivateData } = useApp()
  const intl = useIntl()
  const navigate = useNavigate()
  const { appWalletService } = useWalletContext()

  // Get current wallet mode and keystore state
  const appWalletState = useObservableState(appWalletService.appWalletState$)
  const keystoreState = useObservableState(appWalletService.keystoreService.keystoreState$, O.none)
  const isInStandaloneLedgerMode = appWalletState && isStandaloneLedgerMode(appWalletState)

  // Check if keystore is currently unlocked
  const isUnlocked = FP.pipe(
    keystoreState,
    O.map(isKeystoreUnlocked),
    O.getOrElse(() => false)
  )

  const handleLedgerModeClick = useCallback(() => {
    if (isInStandaloneLedgerMode) {
      // Switch back to keystore mode
      appWalletService.switchToKeystoreMode()
    } else if (!isUnlocked) {
      // Only navigate to ledger chain selector if keystore is locked
      navigate(walletRoutes.ledgerChainSelect.path())
    }
  }, [isInStandaloneLedgerMode, isUnlocked, appWalletService, navigate])

  const handleChangeChainClick = useCallback(() => {
    // Reset to chain selection phase
    appWalletService.standaloneLedgerService.resetToChainSelection()
    // Navigate to ledger chain selector with a parameter to force chain selection
    navigate(walletRoutes.ledgerChainSelect.path() + '?changeChain=true')
  }, [appWalletService, navigate])

  const langMenu = useMemo(
    () =>
      FP.pipe(
        LOCALES,
        A.map((l: Locale) => (
          <div
            key={l}
            className={clsx(
              'dark:text-1 flex items-center min-w-[222px] px-10px py-2 font-main text-16 uppercase text-text1 dark:text-text1d',
              l === locale ? 'font-mainSemiBold' : 'font-main'
            )}
            onClick={() => changeLocale(l)}>
            {l}
          </div>
        ))
      ),
    [changeLocale, locale]
  )

  const renderLangMenu = useMemo(
    () => (
      <Dropdown
        trigger={
          <div className="flex min-w-[240px] cursor-pointer items-center justify-between rounded-lg border border-solid border-gray0 p-2 dark:border-gray0d">
            <h3 className="m-0 font-main text-[16px] uppercase leading-5 text-text1 dark:text-text1d">{locale}</h3>
            <DownIcon />
          </div>
        }
        options={langMenu}
      />
    ),
    [langMenu, locale]
  )

  const networkTextColor = useCallback((network: Network) => {
    switch (network) {
      case Network.Mainnet:
        return 'text-turquoise'
      case Network.Stagenet:
        return 'text-error1 dark:text-error1d'
      case Network.Testnet:
        return 'text-warning0 dark:text-warning0'
      default:
        return 'text-text2 dark:text-text2'
    }
  }, [])

  const networkMenu = useMemo(() => {
    return FP.pipe(
      AVAILABLE_NETWORKS,
      A.map((n: Network) => (
        <div
          key={n}
          className={clsx(
            'flex items-center min-w-[222px] px-10px py-2 text-16 uppercase',
            n === network ? 'font-mainSemiBold' : 'font-main',
            networkTextColor(n)
          )}
          onClick={() => changeNetwork(n)}>
          {n}
        </div>
      ))
    )
  }, [changeNetwork, network, networkTextColor])

  const renderNetworkMenu = useMemo(
    () => (
      <Dropdown
        trigger={
          <div className="flex min-w-[240px] cursor-pointer items-center justify-between rounded-lg border border-solid border-gray0 p-2 dark:border-gray0d">
            <h3 className={clsx('m-0 font-main text-[16px] uppercase leading-5', networkTextColor(network))}>
              {network}
            </h3>
            <DownIcon />
          </div>
        }
        options={networkMenu}
      />
    ),
    [networkMenu, networkTextColor, network]
  )

  const checkUpdatesProps = useMemo(() => {
    const commonProps = {
      onClick: checkForUpdates,
      children: <>{intl.formatMessage({ id: 'common.refresh' })}</>
    }

    return FP.pipe(
      appUpdateState,
      RD.fold(
        () => commonProps,
        () => ({
          ...commonProps,
          loading: true,
          disabled: true
        }),
        () => ({
          ...commonProps
        }),
        (oVersion) => ({
          ...commonProps,
          ...FP.pipe(
            oVersion,
            O.fold(
              () => ({
                onClick: checkForUpdates
              }),
              (version) => ({
                onClick: () => goToReleasePage(version),
                children: (
                  <>
                    {intl.formatMessage({ id: 'update.link' })} <Styled.ExternalLinkIcon />
                  </>
                )
              })
            )
          )
        })
      )
    )
  }, [appUpdateState, checkForUpdates, goToReleasePage, intl])

  const renderVersionUpdateResult = useMemo(
    () =>
      FP.pipe(
        appUpdateState,
        RD.fold(
          FP.constNull,
          FP.constNull,
          ({ message }) => (
            <Label color="error">{intl.formatMessage({ id: 'update.checkFailed' }, { error: message })}</Label>
          ),
          O.fold(
            () => (
              <Label color="dark" size="big" textTransform="uppercase">
                {intl.formatMessage({ id: 'update.noUpdate' })}
              </Label>
            ),
            (version) => (
              <Label color="dark" size="big" textTransform="uppercase">
                {intl.formatMessage({ id: 'update.description' }, { version })}
              </Label>
            )
          )
        )
      ),
    [appUpdateState, intl]
  )

  return (
    <div>
      {/* // TODO: locale for subtitle */}
      <Section
        title={intl.formatMessage({ id: 'common.network' })}
        subtitle={intl.formatMessage({ id: 'settings.network.subtitle' })}>
        {renderNetworkMenu}
      </Section>
      <Section
        title={intl.formatMessage({ id: 'settings.language.title' })}
        subtitle={intl.formatMessage({ id: 'settings.language.subtitle' })}>
        {renderLangMenu}
      </Section>
      <Section
        title={intl.formatMessage({ id: 'common.privateData' })}
        subtitle={intl.formatMessage({ id: 'settings.privateData.subtitle' })}>
        <SwitchButton active={isPrivate} onChange={changePrivateData} />
      </Section>
      <Section
        title={intl.formatMessage({ id: 'settings.ledgerMode.title' })}
        subtitle={intl.formatMessage({ id: 'settings.ledgerMode.subtitle' })}>
        <div className="flex flex-col gap-2 items-end">
          {isInStandaloneLedgerMode && (
            <BorderButton size="normal" onClick={handleChangeChainClick} className="flex items-center gap-2">
              <CpuChipIcon width={16} height={16} />
              {intl.formatMessage({ id: 'settings.chain.changeButton' })}
            </BorderButton>
          )}
          <BorderButton
            size="normal"
            onClick={handleLedgerModeClick}
            disabled={!isInStandaloneLedgerMode && isUnlocked}
            className={`flex items-center gap-2 ${
              !isInStandaloneLedgerMode && isUnlocked ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title={!isInStandaloneLedgerMode && isUnlocked ? 'Lock wallet to enter Ledger mode' : undefined}>
            <CpuChipIcon width={16} height={16} />
            {isInStandaloneLedgerMode ? 'Exit Ledger Mode' : 'Enter Ledger Mode'}
          </BorderButton>
          {!isInStandaloneLedgerMode && isUnlocked && (
            <span className="text-warning0 dark:text-warning0d text-xs mt-1">
              {intl.formatMessage({ id: 'settings.ledgerMode.lockWalletWarning' })}
            </span>
          )}
        </div>
      </Section>
      <Section
        title={intl.formatMessage({ id: 'settings.version.title' })}
        subtitle={intl.formatMessage({ id: 'settings.version.subtitle' })}>
        <div className="flex max-w-[240px] flex-col space-y-1">
          <div className="flex min-w-[240px] items-center justify-between">
            <Label color="dark" size="big" textTransform="uppercase">
              v{version}
            </Label>
            <BorderButton size="normal" className="" {...checkUpdatesProps} />
          </div>
          {renderVersionUpdateResult}
        </div>
      </Section>
    </div>
  )
}
