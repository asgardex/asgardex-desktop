import { useCallback, useMemo } from 'react'

import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { useIntl } from 'react-intl'

import { RadioGroup } from '../radioGroup'
import { Tooltip } from '../tooltip'
import { Props, Protocol, Protocols, ProtocolsWithAll } from './types'

export const ProtocolSwitch = ({ protocol, setProtocol, withAll = false }: Props) => {
  const intl = useIntl()
  const protocols = useMemo(() => (withAll ? ProtocolsWithAll : Protocols), [withAll])

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
    return [
      ...(withAll
        ? [
            {
              label: (
                <Tooltip title="All" placement="bottom">
                  <span>{intl.formatMessage({ id: 'common.all' })}</span>
                </Tooltip>
              ),
              value: Protocol.All
            }
          ]
        : []),
      {
        label: (
          <Tooltip title="Switch pools to THORChain" placement="bottom">
            <span>THORChain</span>
          </Tooltip>
        ),
        value: THORChain
      },
      {
        label: (
          <Tooltip title="Switch pools to MAYAChain" placement="bottom">
            <span>MAYAChain</span>
          </Tooltip>
        ),
        value: MAYAChain
      }
    ]
  }, [withAll, intl])

  return (
    <div>
      <RadioGroup options={protocolOptions} activeIndex={activeIndex} onChange={onChange} />
    </div>
  )
}
