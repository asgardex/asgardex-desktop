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
import { LOCALE_LABELS, LOCALES } from '../../i18n'
import * as walletRoutes from '../../routes/wallet'
import { AVAILABLE_NETWORKS } from '../../services/const'
import { isStandaloneLedgerMode } from '../../services/wallet/types'
import { useApp } from '../../store/app/hooks'
import { BorderButton } from '../uielements/button'
import { SwitchButton } from '../uielements/button/SwitchButton'
import { ExternalLinkIcon } from '../uielements/common'
import { Label } from '../uielements/label'
import { SettingsSection } from './SettingsSection'
import { SettingsSelect } from './SettingsSelect'

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

const formatNetwork = (network: Network): string => network.charAt(0).toUpperCase() + network.slice(1)

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

  // Get current wallet mode and unified lock state
  const appWalletState = useObservableState(appWalletService.appWalletState$)
  const isWalletLocked = useObservableState(appWalletService.isLocked$, true)
  const isInStandaloneLedgerMode = appWalletState && isStandaloneLedgerMode(appWalletState)
  const isUnlocked = !isWalletLocked

  const handleLedgerModeClick = useCallback(() => {
    if (isInStandaloneLedgerMode) {
      // Restore previous wallet (Vultisig or Keystore)
      appWalletService.restoreLastOpenedWallet()
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
              'flex min-w-[222px] items-center px-10px py-2 font-main text-16 text-text1 dark:text-text1d',
              l === locale ? 'font-main-semi-bold' : 'font-main'
            )}
            onClick={() => changeLocale(l)}>
            {LOCALE_LABELS[l]}
          </div>
        ))
      ),
    [changeLocale, locale]
  )

  const renderLangMenu = useMemo(
    () => <SettingsSelect value={LOCALE_LABELS[locale]} options={langMenu} />,
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
            'flex min-w-[222px] items-center px-10px py-2 text-16',
            n === network ? 'font-main-semi-bold' : 'font-main',
            networkTextColor(n)
          )}
          onClick={() => changeNetwork(n)}>
          {formatNetwork(n)}
        </div>
      ))
    )
  }, [changeNetwork, network, networkTextColor])

  const renderNetworkMenu = useMemo(
    () => (
      <SettingsSelect value={formatNetwork(network)} valueClassName={networkTextColor(network)} options={networkMenu} />
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
                    {intl.formatMessage({ id: 'update.link' })} <ExternalLinkIcon className="ml-2 text-turquoise" />
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
            () => <Label color="dark">{intl.formatMessage({ id: 'update.noUpdate' })}</Label>,
            (version) => <Label color="dark">{intl.formatMessage({ id: 'update.description' }, { version })}</Label>
          )
        )
      ),
    [appUpdateState, intl]
  )

  return (
    <div className="flex flex-col gap-3">
      <SettingsSection
        title={intl.formatMessage({ id: 'common.network' })}
        subtitle={intl.formatMessage({ id: 'settings.network.subtitle' })}
        action={renderNetworkMenu}
      />
      <SettingsSection
        title={intl.formatMessage({ id: 'settings.language.title' })}
        subtitle={intl.formatMessage({ id: 'settings.language.subtitle' })}
        action={renderLangMenu}
      />
      <SettingsSection
        title={intl.formatMessage({ id: 'common.privateData' })}
        subtitle={intl.formatMessage({ id: 'settings.privateData.subtitle' })}
        action={<SwitchButton active={isPrivate} onChange={changePrivateData} />}
      />
      <SettingsSection
        title={intl.formatMessage({ id: 'settings.ledgerMode.title' })}
        subtitle={intl.formatMessage({ id: 'settings.ledgerMode.subtitle' })}
        action={
          <div className="flex flex-col items-end gap-2">
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
                !isInStandaloneLedgerMode && isUnlocked ? 'cursor-not-allowed opacity-50' : ''
              }`}
              title={
                !isInStandaloneLedgerMode && isUnlocked
                  ? intl.formatMessage({ id: 'settings.ledgerMode.lockToEnter' })
                  : undefined
              }>
              <CpuChipIcon width={16} height={16} />
              {isInStandaloneLedgerMode
                ? intl.formatMessage({ id: 'settings.ledgerMode.exit' })
                : intl.formatMessage({ id: 'settings.ledgerMode.enter' })}
            </BorderButton>
            {!isInStandaloneLedgerMode && isUnlocked && (
              <span className="mt-1 text-xs text-warning0 dark:text-warning0d">
                {intl.formatMessage({ id: 'settings.ledgerMode.lockWalletWarning' })}
              </span>
            )}
          </div>
        }
      />
      <SettingsSection
        title={intl.formatMessage({ id: 'settings.version.title' })}
        subtitle={intl.formatMessage({ id: 'settings.version.subtitle' })}
        action={
          <div className="flex max-w-[240px] flex-col space-y-1">
            <div className="flex min-w-[240px] items-center justify-between">
              <Label color="dark" size="big">
                v{version}
              </Label>
              <BorderButton size="normal" className="" {...checkUpdatesProps} />
            </div>
            {renderVersionUpdateResult}
          </div>
        }
      />
    </div>
  )
}
