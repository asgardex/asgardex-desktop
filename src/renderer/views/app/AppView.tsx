import React, { useEffect, useMemo, useRef, useState } from 'react'

import { SyncOutlined } from '@ant-design/icons'
import * as RD from '@devexperts/remote-data-ts'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'
import { Grid } from 'antd'
import * as FP from 'fp-ts/function'
import * as A from 'fp-ts/lib/Array'
import * as O from 'fp-ts/Option'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'

import { DEFAULT_LOCALE } from '../../../shared/i18n/const'
import { chainToString, DEFAULT_ENABLED_CHAINS } from '../../../shared/utils/chain'
import { envOrDefault } from '../../../shared/utils/env'
import { Header } from '../../components/header'
import { Sidebar } from '../../components/sidebar'
import { BorderButton } from '../../components/uielements/button'
import { useI18nContext } from '../../contexts/I18nContext'
import { useMidgardContext } from '../../contexts/MidgardContext'
import { useMidgardMayaContext } from '../../contexts/MidgardMayaContext'
import { unionChains } from '../../helpers/fp/array'
import { rdAltOnPending } from '../../helpers/fpHelpers'
import { useDex } from '../../hooks/useDex'
import { useKeystoreWallets } from '../../hooks/useKeystoreWallets'
import { useLedgerAddresses } from '../../hooks/useLedgerAddresses'
import { useMimirHalt } from '../../hooks/useMimirHalt'
import { useTheme } from '../../hooks/useTheme'
import { DEFAULT_MIMIR_HALT } from '../../services/thorchain/const'
import { MimirHalt } from '../../services/thorchain/types'
import { View } from '../View'
import { ViewRoutes } from '../ViewRoutes'
import { AppUpdateView } from './AppUpdateView'
import * as Styled from './AppView.styles'

type HaltedChainsState = {
  chain: Chain
  haltedChain: boolean
  haltedTrading: boolean
  pausedLP: boolean
}
export const AppView: React.FC = (): JSX.Element => {
  const intl = useIntl()

  const { dex } = useDex()

  const { locale$ } = useI18nContext()
  const currentLocale = useObservableState(locale$, DEFAULT_LOCALE)

  const { isLight } = useTheme()

  const isDesktopView = Grid.useBreakpoint()?.lg ?? false

  // locale
  useEffect(() => {
    // Needed to update Electron native menu according to the selected locale
    window.apiLang.update(currentLocale)
  }, [currentLocale])

  // Add/remove `dark` selector depending on selected theme (needed for tailwind)
  useEffect(() => {
    if (isLight) {
      document.documentElement.classList.remove('dark')
    } else {
      document.documentElement.classList.add('dark')
    }
  }, [isLight])

  const {
    service: {
      apiEndpoint$,
      reloadApiEndpoint,
      pools: { haltedChains$ }
    }
  } = useMidgardContext()
  const {
    service: {
      apiEndpoint$: apiEndpointMaya$,
      reloadApiEndpoint: reloadApiEndpointMaya,
      pools: { haltedChains$: haltedChainsMaya$ }
    }
  } = useMidgardMayaContext()
  const reloadDexEndpoint = dex.chain === THORChain ? reloadApiEndpoint : reloadApiEndpointMaya
  const apiEndpoint = useObservableState(dex.chain === THORChain ? apiEndpoint$ : apiEndpointMaya$, RD.initial)

  const haltedChainsRD = useObservableState(dex.chain === THORChain ? haltedChains$ : haltedChainsMaya$, RD.initial)

  const prevHaltedChains = useRef<Chain[]>([])
  const prevMimirHalt = useRef<MimirHalt>(DEFAULT_MIMIR_HALT)

  const { walletsPersistentRD, reload: reloadPersistentWallets } = useKeystoreWallets()
  const { ledgerAddressesPersistentRD, reloadPersistentLedgerAddresses } = useLedgerAddresses()

  const { mimirHaltRD } = useMimirHalt()

  const renderHaltedChainsWarning = useMemo(
    () =>
      FP.pipe(
        RD.combine(haltedChainsRD, mimirHaltRD),
        RD.map(([inboundHaltedChains, mimirHalt]) => {
          prevHaltedChains.current = inboundHaltedChains
          prevMimirHalt.current = mimirHalt
          return { inboundHaltedChains, mimirHalt }
        }),
        rdAltOnPending<Error, { inboundHaltedChains: Chain[]; mimirHalt: MimirHalt }>(() =>
          RD.success({
            inboundHaltedChains: prevHaltedChains.current,
            mimirHalt: prevMimirHalt.current
          })
        ),
        RD.toOption,
        O.map(({ inboundHaltedChains, mimirHalt }) => {
          let msg = ''
          msg = mimirHalt.haltTrading ? intl.formatMessage({ id: 'halt.trading' }) : msg
          msg = mimirHalt.haltTHORChain ? intl.formatMessage({ id: 'halt.thorchain' }) : msg

          if (!mimirHalt.haltTHORChain && !mimirHalt.haltTrading) {
            const haltedChainsState: HaltedChainsState[] = Object.keys(DEFAULT_ENABLED_CHAINS).map((chain) => {
              return {
                chain,
                haltedChain: mimirHalt[`halt${chain}Chain`],
                haltedTrading: mimirHalt[`halt${chain}Trading`],
                pausedLP: mimirHalt[`pauseLp${chain}`]
              }
            })
            const haltedChains = FP.pipe(
              haltedChainsState,
              A.filter(({ haltedChain }) => haltedChain),
              A.map(({ chain }) => chain),
              // merge chains of `inbound_addresses` and `mimir` endpoints
              // by removing duplicates
              unionChains(inboundHaltedChains)
            )
            const dexChain = chainToString(dex.chain)
            msg =
              haltedChains.length === 1
                ? `${msg} ${intl.formatMessage({ id: 'halt.chain' }, { chain: haltedChains[0], dex: dexChain })}
                ${intl.formatMessage({ id: 'halt.chain.synth' }, { chain: haltedChains[0] })}`
                : haltedChains.length > 1
                ? `${msg} ${intl.formatMessage({ id: 'halt.chains' }, { chains: haltedChains.join(', ') })}`
                : `${msg}`

            const haltedTradingChains = haltedChainsState
              .filter(({ haltedTrading }) => haltedTrading)
              .map(({ chain }) => chain)
            msg =
              haltedTradingChains.length > 0
                ? `${msg} ${intl.formatMessage(
                    { id: 'halt.chain.trading' },
                    { chains: haltedTradingChains.join(', ') }
                  )}`
                : `${msg}`

            const pausedLPs = haltedChainsState.filter(({ pausedLP }) => pausedLP).map(({ chain }) => chain)
            msg =
              pausedLPs.length > 0
                ? `${msg} ${intl.formatMessage({ id: 'halt.chain.pause' }, { chains: pausedLPs.join(', ') })}`
                : mimirHalt.pauseLp
                ? `${msg} ${intl.formatMessage({ id: 'halt.chain.pauseall' })}`
                : `${msg}`
          }

          return msg ? <Styled.Alert key={'halted warning'} type="warning" message={msg} /> : <></>
        }),
        O.getOrElse(() => <></>)
      ),
    [dex, haltedChainsRD, intl, mimirHaltRD]
  )

  const renderMidgardError = useMemo(() => {
    const empty = () => <></>
    return FP.pipe(
      apiEndpoint,
      RD.fold(
        empty,
        empty,
        (e) => (
          <Styled.Alert
            type="error"
            message={intl.formatMessage({ id: 'midgard.error.endpoint.title' })}
            description={e?.message ?? e.toString()}
            action={
              <BorderButton onClick={reloadDexEndpoint} color="error" size="medium">
                <SyncOutlined className="mr-10px" />
                {intl.formatMessage({ id: 'common.reload' })}
              </BorderButton>
            }
          />
        ),
        empty
      )
    )
  }, [apiEndpoint, intl, reloadDexEndpoint])

  const renderImportKeystoreWalletsError = useMemo(() => {
    const empty = () => <></>
    return FP.pipe(
      walletsPersistentRD,
      RD.fold(
        empty,
        empty,
        (e) => (
          <Styled.Alert
            type="warning"
            message={intl.formatMessage({ id: 'wallet.imports.error.keystore.import' })}
            description={e?.message ?? e.toString()}
            action={
              <BorderButton color="warning" size="medium" onClick={reloadPersistentWallets}>
                {intl.formatMessage({ id: 'common.retry' })}
              </BorderButton>
            }
          />
        ),
        empty
      )
    )
  }, [walletsPersistentRD, reloadPersistentWallets, intl])

  const renderImportLedgerAddressesError = useMemo(() => {
    const empty = () => <></>
    return FP.pipe(
      ledgerAddressesPersistentRD,
      RD.fold(
        empty,
        empty,
        (e) => (
          <Styled.Alert
            type="warning"
            message={intl.formatMessage({ id: 'wallet.imports.error.ledger.import' })}
            description={e?.message ?? e.toString()}
            action={
              <BorderButton color="warning" size="medium" onClick={reloadPersistentLedgerAddresses}>
                {intl.formatMessage({ id: 'common.retry' })}
              </BorderButton>
            }
          />
        ),
        empty
      )
    )
  }, [ledgerAddressesPersistentRD, reloadPersistentLedgerAddresses, intl])

  const getPublicIP = async () => {
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip
  }

  const [publicIP, setPublicIP] = useState('')

  useEffect(() => {
    getPublicIP()
      .then((ip) => setPublicIP(ip))
      .catch((err) => console.error(err))
  }, [])

  return (
    <Styled.AppWrapper>
      <div className="flex h-full flex-col">
        <AppUpdateView />
        <Styled.AppLayout>
          {isDesktopView && <Sidebar commitHash={envOrDefault($COMMIT_HASH, '')} isDev={$IS_DEV} publicIP={publicIP} />}
          <View>
            <Header />
            {renderMidgardError}
            {renderImportKeystoreWalletsError}
            {renderImportLedgerAddressesError}
            {renderHaltedChainsWarning}
            <ViewRoutes />
          </View>
        </Styled.AppLayout>
      </div>
    </Styled.AppWrapper>
  )
}
