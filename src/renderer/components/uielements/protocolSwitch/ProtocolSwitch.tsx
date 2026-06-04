import { useCallback, useMemo } from 'react'

import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { useBreakpoint } from '../../../hooks/useBreakpoint'
import { Dropdown } from '../dropdown'
import { RadioGroup } from '../radioGroup'
import { Tooltip } from '../tooltip'
import { Props, Protocol, Protocols, ProtocolsWithAll } from './types'

const PROTOCOL_LABEL: Record<string, string> = {
  [Protocol.All]: 'All',
  [THORChain]: 'THORChain',
  [MAYAChain]: 'MAYAChain',
  [Protocol.Chainflip]: 'Chainflip'
}

export const ProtocolSwitch = ({ protocol, setProtocol, withAll = false, protocols: customProtocols }: Props) => {
  const intl = useIntl()
  const { md } = useBreakpoint()
  const protocols = useMemo(
    () => customProtocols ?? (withAll ? ProtocolsWithAll : Protocols),
    [customProtocols, withAll]
  )

  const activeIndex = useMemo(() => {
    const currentIndex = protocols.findIndex((availableProtocol) => availableProtocol === protocol)

    if (currentIndex === -1) {
      setProtocol(protocols[0])
      return 0
    }

    return currentIndex
  }, [protocol, protocols, setProtocol])

  const onChange = useCallback(
    (index: number) => {
      setProtocol(protocols[index])
    },
    [protocols, setProtocol]
  )

  const protocolOptions = useMemo(() => {
    return protocols.map((p) => {
      const label = p === Protocol.All ? intl.formatMessage({ id: 'common.all' }) : (PROTOCOL_LABEL[p] ?? p)
      return {
        value: p,
        label: (
          <Tooltip
            title={intl.formatMessage({ id: 'common.protocolSwitch.switchTo' }, { protocol: label })}
            placement="bottom">
            <span>{label}</span>
          </Tooltip>
        )
      }
    })
  }, [protocols, intl])

  // Dropdown on small screens (below md) since 3+ radio options crowd the row
  if (!md) {
    const activeLabel =
      protocol === Protocol.All ? intl.formatMessage({ id: 'common.all' }) : (PROTOCOL_LABEL[protocol] ?? protocol)
    return (
      <Dropdown
        trigger={
          <button
            type="button"
            className={clsx(
              'flex items-center gap-2 rounded-lg border border-solid border-gray0 px-3 py-2',
              'font-main-semi-bold text-sm text-text0 dark:border-gray0d dark:text-text0d',
              'hover:bg-bg1 dark:hover:bg-bg1d'
            )}>
            {activeLabel}
            <ChevronDownIcon className="h-4 w-4" />
          </button>
        }
        options={protocols.map((p) => {
          const label = p === Protocol.All ? intl.formatMessage({ id: 'common.all' }) : (PROTOCOL_LABEL[p] ?? p)
          return (
            <button
              key={p}
              type="button"
              onClick={() => setProtocol(p)}
              className={clsx(
                'w-full px-3 py-2 text-left text-sm text-text0 dark:text-text0d',
                protocol === p && 'font-main-semi-bold text-turquoise'
              )}>
              {label}
            </button>
          )
        })}
      />
    )
  }

  return (
    <div>
      <RadioGroup options={protocolOptions} activeIndex={activeIndex} onChange={onChange} />
    </div>
  )
}
