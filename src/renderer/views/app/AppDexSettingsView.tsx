import { useCallback } from 'react'
import type { Protocol } from '@xchainjs/xchain-aggregator/lib/types'
import { function as FP, option as O } from 'fp-ts'

import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { SettingsSection } from '../../components/settings/SettingsSection'
import { SettingsSelect } from '../../components/settings/SettingsSelect'
import { ProviderIcon } from '../../components/swap/ProviderIcon'
import { SLIP_TOLERANCE_KEY } from '../../components/swap/SelectableSlipTolerance'
import { SwitchButton } from '../../components/uielements/button/SwitchButton'
import { useAppContext } from '../../contexts/AppContext'
import { DEFAULT_SLIP_TOLERANCE } from '../../services/const'
import { useAggregator } from '../../store/aggregator/hooks'
import { isSlipTolerance, SlipTolerance } from '../../types/asgardex'

const AllProtocols: Protocol[] = ['Thorchain', 'Mayachain', 'Chainflip', 'OneClick']

export const AppDexSettingsView = (): JSX.Element => {
  const { protocols, setAggProtocol } = useAggregator()
  const { streamingSlipTolerance$, changeStreamingSlipTolerance, tradeSlipTolerance$, changeTradeSlipTolerance } =
    useAppContext()

  const intl = useIntl()

  const getStoredSlipTolerance = (key: string): SlipTolerance =>
    FP.pipe(
      localStorage.getItem(key),
      O.fromNullable,
      O.map((s) => {
        const itemAsNumber = Number(s)
        return isSlipTolerance(itemAsNumber) ? itemAsNumber : DEFAULT_SLIP_TOLERANCE
      }),
      O.getOrElse(() => DEFAULT_SLIP_TOLERANCE)
    )

  const streamingSlipTolerance = useObservableState<SlipTolerance>(
    streamingSlipTolerance$,
    getStoredSlipTolerance(`${SLIP_TOLERANCE_KEY}_STREAMING`)
  )
  const tradeSlipTolerance = useObservableState<SlipTolerance>(
    tradeSlipTolerance$,
    getStoredSlipTolerance(`${SLIP_TOLERANCE_KEY}_TRADE`)
  )

  const streamingSlipOptions: SlipTolerance[] = [1, 3, 5, 10, 15, 20]
  const tradeSlipOptions: SlipTolerance[] = [0.5, 1, 3, 5, 10, 15, 20]
  // No onClick on the row. Headless UI activates the menu item on Enter/Space, which runs `onSelect`.
  const slipMenu = (options: SlipTolerance[]) =>
    options.map((slip) => (
      <div key={slip} className="flex min-w-[102px] items-center px-2 py-1">
        <span className="font-main-semi-bold text-[14px] text-text0 dark:text-text0d">{slip} %</span>
      </div>
    ))
  const applySlip = (options: SlipTolerance[], index: number, kind: 'streaming' | 'trade') => {
    const slip = options[index]
    if (slip === undefined) return
    if (kind === 'streaming') changeStreamingSlipTolerance(slip)
    else changeTradeSlipTolerance(slip)
    localStorage.setItem(`${SLIP_TOLERANCE_KEY}_${kind === 'streaming' ? 'STREAMING' : 'TRADE'}`, slip.toString())
  }

  const onToggleSwitch = useCallback(
    (protocol: Protocol, isActive: boolean) => {
      setAggProtocol(protocol, isActive)
    },
    [setAggProtocol]
  )

  return (
    <div className="flex flex-col gap-3">
      <SettingsSection
        title={intl.formatMessage({ id: 'settings.protocols.title' })}
        subtitle={intl.formatMessage({ id: 'settings.protocols.subtitle' })}>
        <div className="flex w-full flex-col gap-2">
          {AllProtocols.map((protocol) => (
            <div key={protocol} className="flex items-center justify-between">
              <div className="mr-4 flex items-center gap-2">
                <ProviderIcon className="h-8 w-8" protocol={protocol} />
                <span className="font-main text-[14px] text-text0 dark:text-text0d">{protocol}</span>
              </div>
              <SwitchButton
                active={protocols.includes(protocol)}
                onChange={(active) => onToggleSwitch(protocol, active)}
              />
            </div>
          ))}
        </div>
      </SettingsSection>
      <SettingsSection title={intl.formatMessage({ id: 'settings.slippage.title' })}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <span className="font-main text-[13px] text-gray1 dark:text-gray1d">
              {intl.formatMessage({ id: 'settings.slippage.streaming' })}
            </span>
            <SettingsSelect
              value={`${streamingSlipTolerance} %`}
              triggerClassName="min-w-[120px]"
              options={slipMenu(streamingSlipOptions)}
              onSelect={(index) => applySlip(streamingSlipOptions, index, 'streaming')}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="font-main text-[13px] text-gray1 dark:text-gray1d">
              {intl.formatMessage({ id: 'settings.slippage.trade' })}
            </span>
            <SettingsSelect
              value={`${tradeSlipTolerance} %`}
              triggerClassName="min-w-[120px]"
              anchor={{ to: 'bottom', gap: 4, padding: 8 }}
              options={slipMenu(tradeSlipOptions)}
              onSelect={(index) => applySlip(tradeSlipOptions, index, 'trade')}
            />
          </div>
        </div>
      </SettingsSection>
    </div>
  )
}
