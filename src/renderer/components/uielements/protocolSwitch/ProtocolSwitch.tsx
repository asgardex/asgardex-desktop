import { useMemo } from 'react'

import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'

import { Tooltip } from '../common/Common.styles'
import { RadioGroup } from '../radioGroup'

export type Props = {
  activeIndex: number
  toggleProtocol: (index: number) => void
}

export const ProtocolSwitch = ({ activeIndex, toggleProtocol }: Props) => {
  const protocolOptions = useMemo(() => {
    return [
      {
        label: (
          <Tooltip title="Switch pools to THORChain" placement="bottom">
            <span className="px-1 text-text2 dark:text-text2d">THORChain</span>
          </Tooltip>
        ),
        value: THORChain
      },
      {
        label: (
          <Tooltip title="Switch pools to MAYAChain" placement="bottom">
            <span className="px-1 text-text2 dark:text-text2d">MAYAChain</span>
          </Tooltip>
        ),
        value: MAYAChain
      }
    ]
  }, [])

  return <RadioGroup options={protocolOptions} activeIndex={activeIndex} onChange={toggleProtocol} />
}
