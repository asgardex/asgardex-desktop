import { Network } from '@xchainjs/xchain-client'
import { Address } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { IntlShape } from 'react-intl'
import { THORChain } from '../../../../../shared/utils/chainIds'

import { truncateAddress } from '../../../../helpers/addressHelper'
import { NextChurn } from '../../../../hooks/useNextChurn'
import { NodeInfo, NodeStatusEnum } from '../../../../services/thorchain/types'
import { formatDuration, operatorFeeBps } from '../helpers'
import { addProviderSpec } from './addProvider'
import { approveRequestSpec } from './approveRequest'
import { changeFeeSpec } from './changeFee'
import { leaveSpec } from './leave'
import { maintenanceSpec } from './maintenance'
import { removeProviderSpec } from './removeProvider'
import { NodeOperatorAction, OperatorActionContext, OperatorActionSpec } from './types'

export * from './types'
export * from './SummaryRow'

export const operatorActionSpec = (action: NodeOperatorAction): OperatorActionSpec => {
  switch (action.type) {
    case 'leave':
      return leaveSpec
    case 'changeFee':
      return changeFeeSpec
    case 'addProvider':
      return addProviderSpec
    case 'removeProvider':
      return removeProviderSpec(action.provider)
    case 'maintenance':
      return maintenanceSpec
    case 'approveRequest':
      return approveRequestSpec(action.request)
  }
}

export const operatorActionContext = ({
  node,
  network,
  intl,
  maxBondProviders,
  nextChurn,
  validateAddress
}: {
  node: NodeInfo
  network: Network
  intl: IntlShape
  maxBondProviders: number
  nextChurn: O.Option<NextChurn>
  validateAddress: (address: Address) => boolean
}): OperatorActionContext => ({
  node,
  network,
  intl,
  isActive: node.status === NodeStatusEnum.Active,
  currentFeeBps: operatorFeeBps(node.bondProviders.nodeOperatorFee),
  maxBondProviders,
  nodeLabel: truncateAddress(node.address, THORChain, network),
  nextChurnLabel: FP.pipe(
    nextChurn,
    O.fold(
      () => intl.formatMessage({ id: 'bonds.operator.modal.nextChurn' }),
      (churn) =>
        churn.halted
          ? intl.formatMessage({ id: 'bonds.churn.whenResumes' })
          : intl.formatMessage({ id: 'bonds.provider.modal.nextChurn' }, { time: formatDuration(churn.msLeft) })
    )
  ),
  validateAddress
})
