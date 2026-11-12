import { useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'

import { GasMultiplier } from '../../../shared/api/types'
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
import EditableUrl from './EditableUrl'
import { SettingsRadioGroup } from './SettingsRadioGroup'
import { SettingsSection, SettingsSubsection } from './SettingsSection'

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
}

const expertModeDefault: Record<string, boolean> = {
  thorchain: false,
  mayachain: false,
  evm: false
}

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
    onChangeGasMultiplier
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

  const advancedToggle = (key: 'thorchain' | 'mayachain' | 'evm') => (
    <div className="flex items-center justify-end gap-2">
      <TextButton
        className={clsx(
          'mb-0 !py-0 !pr-2 !pl-0 font-main !text-14 text-text0 dark:text-text0d',
          advancedActive[key] ? 'opacity-100' : 'opacity-60'
        )}
        onClick={() => setAdvancedActive((prev) => ({ ...prev, [key]: !prev[key] }))}>
        {intl.formatMessage({ id: 'common.advanced' })}
      </TextButton>
      <SwitchButton
        active={advancedActive[key]}
        onChange={(active) => setAdvancedActive((prev) => ({ ...prev, [key]: active }))}
      />
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <SettingsSection
        title={intl.formatMessage({ id: 'settings.expert.thorchain.title' })}
        action={advancedToggle('thorchain')}>
        <div
          className={clsx(
            'flex-col transition-all duration-300 ease-in-out',
            advancedActive.thorchain ? 'flex' : 'hidden'
          )}>
          <SettingsSubsection title={intl.formatMessage({ id: 'settings.expert.midgard.title' })}>
            <EditableUrl
              className="w-full xl:w-3/4"
              url={midgardUrl}
              onChange={onChangeMidgardUrl}
              loading={RD.isPending(midgardUrlRD)}
              checkUrl$={checkMidgardUrl$}
              successMsg={intl.formatMessage({ id: 'midgard.url.valid' })}
            />
          </SettingsSubsection>
          <SettingsSubsection title={intl.formatMessage({ id: 'settings.expert.thornodeApi.title' })}>
            <EditableUrl
              className="w-full xl:w-3/4"
              url={thornodeNodeUrl}
              onChange={onChangeThornodeNodeUrl}
              checkUrl$={checkThornodeNodeUrl$}
              successMsg={intl.formatMessage({ id: 'settings.thornode.node.valid' })}
            />
          </SettingsSubsection>
          <SettingsSubsection title={intl.formatMessage({ id: 'settings.expert.thornodeRpc.title' })}>
            <EditableUrl
              className="w-full xl:w-3/4"
              url={thornodeRpcUrl}
              onChange={onChangeThornodeRpcUrl}
              checkUrl$={checkThornodeRpcUrl$}
              successMsg={intl.formatMessage({ id: 'settings.thornode.rpc.valid' })}
            />
          </SettingsSubsection>
        </div>
      </SettingsSection>
      <SettingsSection
        title={intl.formatMessage({ id: 'settings.expert.mayachain.title' })}
        action={advancedToggle('mayachain')}>
        <div
          className={clsx(
            'flex-col transition-all duration-300 ease-in-out',
            advancedActive.mayachain ? 'flex' : 'hidden'
          )}>
          <SettingsSubsection title={intl.formatMessage({ id: 'settings.expert.midgardMaya.title' })}>
            <EditableUrl
              className="w-full"
              url={midgardMayaUrl}
              onChange={onChangeMidgardMayaUrl}
              loading={RD.isPending(midgardMayaUrlRD)}
              checkUrl$={checkMidgardMayaUrl$}
              successMsg={intl.formatMessage({ id: 'midgard.url.valid' })}
            />
          </SettingsSubsection>
          <SettingsSubsection title={intl.formatMessage({ id: 'settings.expert.mayanodeApi.title' })}>
            <EditableUrl
              className="w-full xl:w-3/4"
              url={mayanodeNodeUrl}
              onChange={onChangeMayanodeNodeUrl}
              checkUrl$={checkMayanodeNodeUrl$}
              successMsg={intl.formatMessage({ id: 'settings.mayanode.node.valid' })}
            />
          </SettingsSubsection>
          <SettingsSubsection title={intl.formatMessage({ id: 'settings.expert.mayanodeRpc.title' })}>
            <EditableUrl
              className="w-full xl:w-3/4"
              url={mayanodeRpcUrl}
              onChange={onChangeMayanodeRpcUrl}
              checkUrl$={checkMayanodeRpcUrl$}
              successMsg={intl.formatMessage({ id: 'settings.mayanode.rpc.valid' })}
            />
          </SettingsSubsection>
        </div>
      </SettingsSection>
      <SettingsSection title={intl.formatMessage({ id: 'settings.expert.evm.title' })} action={advancedToggle('evm')}>
        <div
          className={clsx('flex-col transition-all duration-300 ease-in-out', advancedActive.evm ? 'flex' : 'hidden')}>
          {ethRpc && (
            <SettingsSubsection
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
            </SettingsSubsection>
          )}
          {bscRpc && (
            <SettingsSubsection
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
            </SettingsSubsection>
          )}
          {arbRpc && (
            <SettingsSubsection
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
            </SettingsSubsection>
          )}
          {avaxRpc && (
            <SettingsSubsection
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
            </SettingsSubsection>
          )}
          {baseRpc && (
            <SettingsSubsection
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
            </SettingsSubsection>
          )}
        </div>
      </SettingsSection>
      <SettingsSection title={intl.formatMessage({ id: 'settings.expert.gasMultiplier.title' })}>
        <SettingsSubsection title={intl.formatMessage({ id: 'settings.expert.gasMultiplier.description' })}>
          <SettingsRadioGroup
            ariaLabel={intl.formatMessage({ id: 'settings.expert.gasMultiplier.title' })}
            options={GAS_MULTIPLIER_OPTIONS.map((multiplier) => ({ value: multiplier, label: `${multiplier}x` }))}
            value={gasMultiplier}
            onChange={(multiplier) => onChangeGasMultiplier(multiplier as GasMultiplier)}
          />
        </SettingsSubsection>
      </SettingsSection>
    </div>
  )
}
