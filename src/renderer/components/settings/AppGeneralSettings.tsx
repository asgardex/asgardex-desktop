import React, { useCallback, useMemo } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Dropdown } from 'antd'
import { MenuProps } from 'antd/lib/menu'
import { ItemType } from 'antd/lib/menu/hooks/useItems'
import { clsx } from 'clsx'
import * as FP from 'fp-ts/function'
import * as A from 'fp-ts/lib/Array'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import { Dex } from '../../../shared/api/types'
import { Locale } from '../../../shared/i18n/types'
import { LOCALES } from '../../i18n'
import { AVAILABLE_DEXS, AVAILABLE_NETWORKS } from '../../services/const'
import { DownIcon } from '../icons'
import { Menu } from '../shared/menu'
import { BorderButton } from '../uielements/button'
import * as Styled from './AppSettings.styles'

export type Props = {
  version: string
  locale: Locale
  changeLocale: (locale: Locale) => void
  network: Network
  dex: Dex
  changeNetwork: (network: Network) => void
  changeDex: (dex: Dex) => void
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

const Section: React.FC<SectionProps> = ({ title, subtitle, className, children }) => (
  <div
    className={clsx(
      'flex w-full items-center justify-between py-6 px-4',
      'border-b border-solid border-gray0 border-opacity-5 last:border-none dark:border-gray0d',
      className
    )}>
    <div className="flex flex-col">
      <h2 className="mb-5px font-main text-[16px] uppercase text-text2 dark:text-text2d">{title}</h2>
      <span className="font-main text-gray1 dark:text-gray1d">{subtitle}</span>
    </div>
    <div className="flex flex-col">{children}</div>
  </div>
)

export const AppGeneralSettings: React.FC<Props> = (props): JSX.Element => {
  const {
    appUpdateState = RD.initial,
    changeNetwork = FP.constVoid,
    changeDex = FP.constVoid,
    network,
    dex,
    checkForUpdates,
    goToReleasePage = FP.constVoid,
    version,
    changeLocale,
    locale
  } = props

  const intl = useIntl()

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
                className={`dark:text-1 flex items-center px-10px py-[8px] font-main text-16 uppercase text-text1 dark:text-text1d ${
                  l === locale ? 'font-mainSemiBold' : 'font-main'
                }`}>
                {l}
              </div>
            ),
            key: l
          }))
        )}
      />
    ),
    [changeLang, locale]
  )

  const renderLangMenu = useMemo(
    () => (
      <Dropdown overlay={langMenu} trigger={['click']} placement="bottom">
        <div className="flex min-w-[240px] cursor-pointer items-center justify-between rounded-lg border border-solid border-gray0 p-2 dark:border-gray0d">
          <h3 className={`m-0 font-main text-[16px] uppercase leading-5 text-text1 dark:text-text1d`}>{locale}</h3>
          <DownIcon />
        </div>
      </Dropdown>
    ),
    [langMenu, locale]
  )

  const changeNetworkHandler: MenuProps['onClick'] = useCallback(
    ({ key }: { key: string }) => {
      changeNetwork(key as Network)
    },
    [changeNetwork]
  )
  const changeDexHandler: MenuProps['onClick'] = useCallback(
    ({ key }: { key: string }) => {
      const newDex = AVAILABLE_DEXS.find((dex) => dex.chain === key)
      if (newDex) {
        changeDex(newDex)
      }
    },
    [changeDex]
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
  const dexTextColor = useCallback((dex: Dex) => {
    switch (dex.chain) {
      case THORChain:
        return 'text-turquoise'
      case MAYAChain:
        return 'text-cyanblue'
      default:
        return 'text-text2 dark:text-text2'
    }
  }, [])

  const networkMenu = useMemo(() => {
    return (
      <Menu
        onClick={changeNetworkHandler}
        items={FP.pipe(
          AVAILABLE_NETWORKS,
          A.map<Network, ItemType>((n: Network) => ({
            label: (
              <div
                className={`flex items-center px-10px py-[8px] ${networkTextColor(n)} text-16 uppercase ${
                  n === network ? 'font-mainSemiBold' : 'font-main'
                }`}>
                {n}
              </div>
            ),
            key: n
          }))
        )}
      />
    )
  }, [changeNetworkHandler, network, networkTextColor])

  const dexMenu = useMemo(() => {
    return (
      <Menu
        onClick={changeDexHandler}
        items={FP.pipe(
          AVAILABLE_DEXS,
          A.map<Dex, ItemType>((n: Dex) => ({
            label: (
              <div
                className={`flex items-center px-10px py-[8px] ${dexTextColor(n)} text-16 uppercase ${
                  n.chain === dex.chain ? 'font-mainSemiBold' : 'font-main'
                }`}>
                {n.chain}
              </div>
            ),
            key: n.chain
          }))
        )}
      />
    )
  }, [changeDexHandler, dex, dexTextColor])

  const renderNetworkMenu = useMemo(
    () => (
      <Dropdown overlay={networkMenu} trigger={['click']} placement="bottom">
        <div className="flex min-w-[240px] cursor-pointer items-center justify-between rounded-lg border border-solid border-gray0 p-2 dark:border-gray0d">
          <h3 className={clsx('m-0 font-main text-[16px] uppercase leading-5', networkTextColor(network))}>
            {network}
          </h3>
          <DownIcon />
        </div>
      </Dropdown>
    ),
    [networkMenu, networkTextColor, network]
  )
  const renderDexMenu = useMemo(
    () => (
      <Dropdown overlay={dexMenu} trigger={['click']} placement="bottom">
        <div className="flex min-w-[240px] cursor-pointer items-center justify-between rounded-lg border border-solid border-gray0 p-2 dark:border-gray0d">
          <h3 className={clsx('m-0 font-main text-[16px] uppercase leading-5', dexTextColor(dex))}>{dex.chain}</h3>
          <DownIcon />
        </div>
      </Dropdown>
    ),
    [dexMenu, dexTextColor, dex]
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
            <Styled.ErrorLabel>
              {intl.formatMessage({ id: 'update.checkFailed' }, { error: message })}
            </Styled.ErrorLabel>
          ),
          O.fold(
            () => <Styled.Label>{intl.formatMessage({ id: 'update.noUpdate' })}</Styled.Label>,
            (version) => <Styled.Label>{intl.formatMessage({ id: 'update.description' }, { version })}</Styled.Label>
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
        subtitle="Network to connect to. Mainnet is Recommended">
        {renderNetworkMenu}
      </Section>
      <Section title={intl.formatMessage({ id: 'common.dex' })} subtitle="Decentralised  exchange to connect to">
        {renderDexMenu}
      </Section>
      <Section title={intl.formatMessage({ id: 'setting.language' })} subtitle="Preferred language">
        {renderLangMenu}
      </Section>
      <Section title={intl.formatMessage({ id: 'setting.version' })} subtitle="Asgardex Software Version">
        <div className="flex max-w-[240px] flex-col space-y-1">
          <div className="flex min-w-[240px] items-center justify-between">
            <Styled.Label>v{version}</Styled.Label>
            <BorderButton size="normal" className="" {...checkUpdatesProps} />
          </div>
          {renderVersionUpdateResult}
        </div>
      </Section>
    </div>
  )
}
