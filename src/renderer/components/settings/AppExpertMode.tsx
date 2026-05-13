import React, { useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { GasMultiplier } from '../../../shared/api/types'
import { PROVIDER_REGISTRY } from '../../../shared/providers'
import { ProviderId, ProviderSectionKey } from '../../../shared/providers/types'
import { LiveData } from '../../helpers/rx/liveData'
import { GAS_MULTIPLIER_OPTIONS } from '../../hooks/useEvmGasMultiplier'
import { RpcHealthStatus } from '../../hooks/useEvmRpcUrl'
import { CheckMayanodeNodeUrlHandler, CheckMayanodeRpcUrlHandler } from '../../services/mayachain/types'
import {
  CheckMidgardUrlHandler,
  MidgardUrlRD,
  CheckMidgardUrlHandler as CheckMidgardMayaUrlHandler,
  MidgardUrlRD as MidgardMayaUrlRD
} from '../../services/midgard/midgardTypes'
import { CheckThornodeNodeUrlHandler, CheckThornodeRpcUrlHandler } from '../../services/thorchain/types'
import { TextButton } from '../uielements/button'
import { SwitchButton } from '../uielements/button/SwitchButton'
import { RadioGroup } from '../uielements/radioGroup'
import EditableUrl from './EditableUrl'
import { ProviderSelector } from './ProviderSelector'

export type CheckEvmRpcUrlHandler = (url: string) => LiveData<Error, string>

type EvmRpcConfig = {
  url: string
  onChange: (url: string) => void
  checkUrl$: CheckEvmRpcUrlHandler
  healthStatus: RpcHealthStatus
}

type Props = {
  midgardUrl: MidgardUrlRD
  midgardMayaUrl: MidgardMayaUrlRD
  thornodeRpcUrl: string
  mayanodeRpcUrl: string
  thornodeNodeUrl: string
  mayanodeNodeUrl: string
  onChangeMidgardUrl: (url: string) => void
  onChangeMidgardMayaUrl: (url: string) => void
  checkMidgardUrl$: CheckMidgardUrlHandler
  checkMidgardMayaUrl$: CheckMidgardMayaUrlHandler
  checkThornodeNodeUrl$: CheckThornodeNodeUrlHandler
  checkMayanodeNodeUrl$: CheckMayanodeNodeUrlHandler
  onChangeThornodeNodeUrl: (url: string) => void
  onChangeMayanodeNodeUrl: (url: string) => void
  checkThornodeRpcUrl$: CheckThornodeRpcUrlHandler
  checkMayanodeRpcUrl$: CheckMayanodeRpcUrlHandler
  onChangeThornodeRpcUrl: (url: string) => void
  onChangeMayanodeRpcUrl: (url: string) => void
  // EVM RPC configs
  ethRpc?: EvmRpcConfig
  bscRpc?: EvmRpcConfig
  arbRpc?: EvmRpcConfig
  avaxRpc?: EvmRpcConfig
  baseRpc?: EvmRpcConfig
  // EVM Gas multiplier
  gasMultiplier: GasMultiplier
  onChangeGasMultiplier: (multiplier: GasMultiplier) => void
  // Provider (derived from current URLs)
  thorchainProvider: ProviderId
  mayachainProvider: ProviderId
  onChangeProvider: (section: ProviderSectionKey, providerId: ProviderId) => void
}

type SubSectionProps = {
  title: string
  children?: React.ReactNode
  className?: string
  warning?: boolean
  warningTooltip?: string
}

/** Read-only URL display — no edit/test, just the URL text */
const ReadOnlyUrl = ({ url }: { url: string }) => (
  <div className="flex items-center">
    <span className="font-main text-[14px] text-gray2 dark:text-gray2d">{url}</span>
  </div>
)

const expertModeDefault: Record<string, boolean> = {
  evm: false
}

const SubSection = ({ title, className, children, warning, warningTooltip }: SubSectionProps) => (
  <div
    className={clsx(
      'flex w-full items-center justify-between px-4',
      'border-solid border-gray0 last:mb-3 last:border-none dark:border-gray0d',
      className
    )}>
    <div className="flex items-center gap-2">
      <h2 className="mb-5px font-main text-[14px] text-gray1 uppercase dark:text-gray1d">{title}</h2>
      {warning && <ExclamationTriangleIcon className="h-5 w-5 text-warning0" title={warningTooltip} />}
    </div>
    <div className="flex flex-col">{children}</div>
  </div>
)

const Section = ({
  title,
  toggleHandler,
  children
}: {
  title: string
  toggleHandler?: React.ReactNode
  children?: React.ReactNode
}) => (
  <div className="flex flex-col border-t border-solid border-gray0 first:border-none dark:border-gray0d">
    <div className="flex items-center justify-between">
      <h2 className="mb-5px px-4 py-3 font-main text-[18px] text-text2 uppercase dark:text-text2d">{title}</h2>
      {toggleHandler}
    </div>
    {children}
  </div>
)

export const AppExpertMode = (props: Props): JSX.Element => {
  const {
    midgardUrl: midgardUrlRD,
    midgardMayaUrl: midgardMayaUrlRD,
    onChangeMidgardUrl,
    onChangeMidgardMayaUrl,
    checkMidgardUrl$,
    checkMidgardMayaUrl$,
    onChangeThornodeNodeUrl,
    onChangeMayanodeNodeUrl,
    checkThornodeNodeUrl$,
    checkMayanodeNodeUrl$,
    checkThornodeRpcUrl$,
    checkMayanodeRpcUrl$,
    onChangeThornodeRpcUrl,
    onChangeMayanodeRpcUrl,
    thornodeRpcUrl,
    thornodeNodeUrl,
    mayanodeNodeUrl,
    mayanodeRpcUrl,
    ethRpc,
    bscRpc,
    arbRpc,
    avaxRpc,
    baseRpc,
    gasMultiplier,
    onChangeGasMultiplier,
    thorchainProvider,
    mayachainProvider,
    onChangeProvider
  } = props

  const intl = useIntl()

  const midgardUrl = useMemo(() => {
    const empty = () => ''
    return FP.pipe(midgardUrlRD, RD.fold(empty, empty, empty, FP.identity))
  }, [midgardUrlRD])

  const midgardMayaUrl = useMemo(() => {
    const empty = () => ''
    return FP.pipe(midgardMayaUrlRD, RD.fold(empty, empty, empty, FP.identity))
  }, [midgardMayaUrlRD])

  const ADVANCED_ACTIVE_STORAGE_KEY = 'openPanelKeys'

  const [advancedActive, setAdvancedActive] = useState<Record<string, boolean>>(() => {
    try {
      const cachedValue = localStorage.getItem(ADVANCED_ACTIVE_STORAGE_KEY)
      return cachedValue ? JSON.parse(cachedValue) : expertModeDefault
    } catch {
      return expertModeDefault
    }
  })

  useEffect(() => {
    localStorage.setItem(ADVANCED_ACTIVE_STORAGE_KEY, JSON.stringify(advancedActive))
  }, [advancedActive])

  return (
    <div className="flex flex-col">
      <Section title={intl.formatMessage({ id: 'settings.expert.thorchain.title' })}>
        <div className="flex flex-col">
          <ProviderSelector
            config={PROVIDER_REGISTRY.thorchain}
            selectedProviderId={thorchainProvider}
            onSelectProvider={(id) => onChangeProvider('thorchain', id)}
          />
          {thorchainProvider === 'custom' ? (
            <>
              <SubSection title={intl.formatMessage({ id: 'settings.expert.midgard.title' })}>
                <EditableUrl
                  className="w-full xl:w-3/4"
                  url={midgardUrl}
                  onChange={onChangeMidgardUrl}
                  loading={RD.isPending(midgardUrlRD)}
                  checkUrl$={checkMidgardUrl$}
                  successMsg={intl.formatMessage({ id: 'midgard.url.valid' })}
                />
              </SubSection>
              <SubSection title={intl.formatMessage({ id: 'settings.expert.thornodeApi.title' })}>
                <EditableUrl
                  className="w-full xl:w-3/4"
                  url={thornodeNodeUrl}
                  onChange={onChangeThornodeNodeUrl}
                  checkUrl$={checkThornodeNodeUrl$}
                  successMsg={intl.formatMessage({ id: 'settings.thornode.node.valid' })}
                />
              </SubSection>
              <SubSection title={intl.formatMessage({ id: 'settings.expert.thornodeRpc.title' })}>
                <EditableUrl
                  className="w-full xl:w-3/4"
                  url={thornodeRpcUrl}
                  onChange={onChangeThornodeRpcUrl}
                  checkUrl$={checkThornodeRpcUrl$}
                  successMsg={intl.formatMessage({ id: 'settings.thornode.rpc.valid' })}
                />
              </SubSection>
            </>
          ) : (
            <>
              <SubSection title={intl.formatMessage({ id: 'settings.expert.midgard.title' })}>
                <ReadOnlyUrl url={midgardUrl} />
              </SubSection>
              <SubSection title={intl.formatMessage({ id: 'settings.expert.thornodeApi.title' })}>
                <ReadOnlyUrl url={thornodeNodeUrl} />
              </SubSection>
              <SubSection title={intl.formatMessage({ id: 'settings.expert.thornodeRpc.title' })}>
                <ReadOnlyUrl url={thornodeRpcUrl} />
              </SubSection>
            </>
          )}
        </div>
      </Section>
      <Section title={intl.formatMessage({ id: 'settings.expert.mayachain.title' })}>
        <div className="flex flex-col">
          <ProviderSelector
            config={PROVIDER_REGISTRY.mayachain}
            selectedProviderId={mayachainProvider}
            onSelectProvider={(id) => onChangeProvider('mayachain', id)}
          />
          {mayachainProvider === 'custom' ? (
            <>
              <SubSection title={intl.formatMessage({ id: 'settings.expert.midgardMaya.title' })}>
                <EditableUrl
                  className="w-full"
                  url={midgardMayaUrl}
                  onChange={onChangeMidgardMayaUrl}
                  loading={RD.isPending(midgardMayaUrlRD)}
                  checkUrl$={checkMidgardMayaUrl$}
                  successMsg={intl.formatMessage({ id: 'midgard.url.valid' })}
                />
              </SubSection>
              <SubSection title={intl.formatMessage({ id: 'settings.expert.mayanodeApi.title' })}>
                <EditableUrl
                  className="w-full xl:w-3/4"
                  url={mayanodeNodeUrl}
                  onChange={onChangeMayanodeNodeUrl}
                  checkUrl$={checkMayanodeNodeUrl$}
                  successMsg={intl.formatMessage({ id: 'settings.mayanode.node.valid' })}
                />
              </SubSection>
              <SubSection title={intl.formatMessage({ id: 'settings.expert.mayanodeRpc.title' })}>
                <EditableUrl
                  className="w-full xl:w-3/4"
                  url={mayanodeRpcUrl}
                  onChange={onChangeMayanodeRpcUrl}
                  checkUrl$={checkMayanodeRpcUrl$}
                  successMsg={intl.formatMessage({ id: 'settings.mayanode.rpc.valid' })}
                />
              </SubSection>
            </>
          ) : (
            <>
              <SubSection title={intl.formatMessage({ id: 'settings.expert.midgardMaya.title' })}>
                <ReadOnlyUrl url={midgardMayaUrl} />
              </SubSection>
              <SubSection title={intl.formatMessage({ id: 'settings.expert.mayanodeApi.title' })}>
                <ReadOnlyUrl url={mayanodeNodeUrl} />
              </SubSection>
              <SubSection title={intl.formatMessage({ id: 'settings.expert.mayanodeRpc.title' })}>
                <ReadOnlyUrl url={mayanodeRpcUrl} />
              </SubSection>
            </>
          )}
        </div>
      </Section>
      <Section
        title={intl.formatMessage({ id: 'settings.expert.evm.title' })}
        toggleHandler={
          <div className="flex items-center justify-end px-4 py-6">
            <TextButton
              className={clsx(
                'mb-0 !py-0 !pr-10px !pl-0 font-main !text-14 text-text0 uppercase dark:text-text0d',
                advancedActive ? 'opacity-100' : 'opacity-60'
              )}
              onClick={() => setAdvancedActive((prev) => ({ ...prev, evm: !prev.evm }))}>
              {intl.formatMessage({ id: 'common.advanced' })}
            </TextButton>
            <SwitchButton
              active={advancedActive.evm}
              onChange={(active) => setAdvancedActive({ ...advancedActive, evm: active })}
            />
          </div>
        }>
        <div
          className={clsx('flex-col transition-all duration-300 ease-in-out', advancedActive.evm ? 'flex' : 'hidden')}>
          {ethRpc && (
            <SubSection
              title={intl.formatMessage({ id: 'settings.expert.evm.eth.title' })}
              warning={ethRpc.healthStatus === 'unhealthy'}
              warningTooltip={intl.formatMessage({ id: 'settings.evm.rpc.unhealthy' })}>
              <EditableUrl
                className="w-full xl:w-3/4"
                url={ethRpc.url}
                onChange={ethRpc.onChange}
                checkUrl$={ethRpc.checkUrl$}
                successMsg={intl.formatMessage({ id: 'settings.evm.rpc.valid' })}
              />
            </SubSection>
          )}
          {bscRpc && (
            <SubSection
              title={intl.formatMessage({ id: 'settings.expert.evm.bsc.title' })}
              warning={bscRpc.healthStatus === 'unhealthy'}
              warningTooltip={intl.formatMessage({ id: 'settings.evm.rpc.unhealthy' })}>
              <EditableUrl
                className="w-full xl:w-3/4"
                url={bscRpc.url}
                onChange={bscRpc.onChange}
                checkUrl$={bscRpc.checkUrl$}
                successMsg={intl.formatMessage({ id: 'settings.evm.rpc.valid' })}
              />
            </SubSection>
          )}
          {arbRpc && (
            <SubSection
              title={intl.formatMessage({ id: 'settings.expert.evm.arb.title' })}
              warning={arbRpc.healthStatus === 'unhealthy'}
              warningTooltip={intl.formatMessage({ id: 'settings.evm.rpc.unhealthy' })}>
              <EditableUrl
                className="w-full xl:w-3/4"
                url={arbRpc.url}
                onChange={arbRpc.onChange}
                checkUrl$={arbRpc.checkUrl$}
                successMsg={intl.formatMessage({ id: 'settings.evm.rpc.valid' })}
              />
            </SubSection>
          )}
          {avaxRpc && (
            <SubSection
              title={intl.formatMessage({ id: 'settings.expert.evm.avax.title' })}
              warning={avaxRpc.healthStatus === 'unhealthy'}
              warningTooltip={intl.formatMessage({ id: 'settings.evm.rpc.unhealthy' })}>
              <EditableUrl
                className="w-full xl:w-3/4"
                url={avaxRpc.url}
                onChange={avaxRpc.onChange}
                checkUrl$={avaxRpc.checkUrl$}
                successMsg={intl.formatMessage({ id: 'settings.evm.rpc.valid' })}
              />
            </SubSection>
          )}
          {baseRpc && (
            <SubSection
              title={intl.formatMessage({ id: 'settings.expert.evm.base.title' })}
              warning={baseRpc.healthStatus === 'unhealthy'}
              warningTooltip={intl.formatMessage({ id: 'settings.evm.rpc.unhealthy' })}>
              <EditableUrl
                className="w-full xl:w-3/4"
                url={baseRpc.url}
                onChange={baseRpc.onChange}
                checkUrl$={baseRpc.checkUrl$}
                successMsg={intl.formatMessage({ id: 'settings.evm.rpc.valid' })}
              />
            </SubSection>
          )}
        </div>
      </Section>
      <Section title={intl.formatMessage({ id: 'settings.expert.gasMultiplier.title' })}>
        <SubSection title={intl.formatMessage({ id: 'settings.expert.gasMultiplier.description' })}>
          <RadioGroup
            options={GAS_MULTIPLIER_OPTIONS.map((m) => ({
              label: `${m}x`,
              value: m
            }))}
            activeIndex={GAS_MULTIPLIER_OPTIONS.indexOf(gasMultiplier)}
            onChange={(index) => onChangeGasMultiplier(GAS_MULTIPLIER_OPTIONS[index] as GasMultiplier)}
          />
        </SubSection>
      </Section>
    </div>
  )
}
