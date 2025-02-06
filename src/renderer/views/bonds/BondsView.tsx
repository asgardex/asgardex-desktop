import { THORChain } from '@xchainjs/xchain-thorchain'

import { ProtocolSwitch } from '../../components/uielements/protocolSwitch'
import { useApp } from '../../store/app/hooks'
import { ThorBondsView } from './ThorBondsView'

export const BondsView = () => {
  const { protocol, setProtocol } = useApp()

  return (
    <>
      <div className="flex w-full justify-end pb-10px">
        <ProtocolSwitch protocol={protocol} setProtocol={setProtocol} />
      </div>
      {protocol === THORChain ? <ThorBondsView /> : <span className="text-text0 dark:text-text0d">MAYAChain</span>}
    </>
  )
}
