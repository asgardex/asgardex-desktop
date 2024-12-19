import { useCallback, useMemo } from 'react'

import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Chain } from '@xchainjs/xchain-util'

import { AVAILABLE_DEXS } from '../../../services/const'
import { Tooltip } from '../common/Common.styles'
import { RadioGroup } from '../radioGroup'

export type Props = {
  protocol: Chain
  setProtocol: (protocol: Chain) => void
}

export const ProtocolSwitch = ({ protocol, setProtocol }: Props) => {
  const activeIndex = useMemo(() => {
    const currentIndex = AVAILABLE_DEXS.findIndex((availableDex) => availableDex.chain === protocol)
    return currentIndex ?? 0
  }, [protocol])

  const onChange = useCallback(
    (index: number) => {
      setProtocol(AVAILABLE_DEXS[index].chain)
    },
    [setProtocol]
  )

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

  return (
    <div>
      <RadioGroup options={protocolOptions} activeIndex={activeIndex} onChange={onChange} />
    </div>
  )
}
