import { useCallback } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { Protocol } from '@xchainjs/xchain-aggregator/lib/types'
import clsx from 'clsx'

import { ProviderIcon } from '../../components/swap/ProviderIcon'
import { SwitchButton } from '../../components/uielements/button/SwitchButton'
import { Dropdown } from '../../components/uielements/dropdown'
import { Label } from '../../components/uielements/label'
import { useAggregator } from '../../store/aggregator/hooks'
import { useApp } from '../../store/app/hooks'

type SectionProps = {
  title: string
  subtitle: string
  children?: React.ReactNode
  className?: string
}

const AllProtocols: Protocol[] = ['Thorchain', 'Mayachain', 'Chainflip']
const slipTolerance = [0.1, 0.5, 1]

const Section = ({ title, subtitle, className, children }: SectionProps) => (
  <div
    className={clsx(
      'flex w-full items-start justify-between py-6 px-4',
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

export const AppDexSettingsView = (): JSX.Element => {
  const { protocols, setAggProtocol } = useAggregator()
  const { streamingSlip, instantSlip, tradeSlip, setStreamingSlip, setInstantSlip, setTradeSlip } = useApp()

  const slipMenu = useCallback((onClick: (slip: number) => void) => {
    return slipTolerance.map((slip) => {
      return (
        <div key={slip} className="flex items-center space-x-4 px-2 py-1 min-w-[102px]" onClick={() => onClick(slip)}>
          <div className="flex flex-col">
            <Label
              className="pr-5 tracking-tight"
              color="normal"
              size="big"
              weight="bold"
              textTransform="uppercase"
              nowrap>
              {slip} %
            </Label>
          </div>
        </div>
      )
    })
  }, [])

  const onToggleSwitch = useCallback(
    (protocol: Protocol, isActive: boolean) => {
      setAggProtocol(protocol, isActive)
    },
    [setAggProtocol]
  )

  return (
    <div>
      <Section title="Protocols" subtitle="Select protocols for optimal swap routing.">
        <div className="flex flex-col w-full gap-2">
          {AllProtocols.map((protocol) => (
            <div key={protocol} className="flex items-center justify-between">
              <div className="flex items-center gap-2 mr-4">
                <ProviderIcon className="w-8 h-8" protocol={protocol} />
                <span className="text-text2 dark:text-text2d">{protocol}</span>
              </div>
              <SwitchButton
                active={protocols.includes(protocol)}
                onChange={(active) => onToggleSwitch(protocol, active)}
              />
            </div>
          ))}
        </div>
      </Section>
      <div
        className={clsx(
          'flex flex-col w-full py-6 px-4',
          'border-b border-solid border-gray0 last:border-none dark:border-gray0d'
        )}>
        <div className="flex flex-col">
          <h2 className="mb-5px font-main text-[16px] uppercase text-text2 dark:text-text2d">Slippage Tolerance</h2>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="font-main text-gray1 dark:text-gray1d">Streaming Swaps</span>
            <Dropdown
              trigger={
                <div className="flex items-center justify-between px-2 py-1 min-w-[120px] border border-solid border-gray0 dark:border-gray0d rounded-md">
                  <Label>{streamingSlip} %</Label>
                  <ChevronDownIcon className="w-4 h-4 text-turquoise" />
                </div>
              }
              options={slipMenu(setStreamingSlip)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-main text-gray1 dark:text-gray1d">Instant Swaps</span>
            <Dropdown
              anchor={{ to: 'bottom', gap: 4, padding: 8 }}
              trigger={
                <div className="flex items-center justify-between px-2 py-1 min-w-[120px] border border-solid border-gray0 dark:border-gray0d rounded-md">
                  <Label>{instantSlip} %</Label>
                  <ChevronDownIcon className="w-4 h-4 text-turquoise" />
                </div>
              }
              options={slipMenu(setInstantSlip)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-main text-gray1 dark:text-gray1d">Trade Swaps</span>
            <Dropdown
              anchor={{ to: 'bottom', gap: 4, padding: 8 }}
              trigger={
                <div className="flex items-center justify-between px-2 py-1 min-w-[120px] border border-solid border-gray0 dark:border-gray0d rounded-md">
                  <Label>{tradeSlip} %</Label>
                  <ChevronDownIcon className="w-4 h-4 text-turquoise" />
                </div>
              }
              options={slipMenu(setTradeSlip)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
