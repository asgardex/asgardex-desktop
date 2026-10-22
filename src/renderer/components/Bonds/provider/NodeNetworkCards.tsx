import { option as O } from 'fp-ts'

import { NodeInfo, NodeStatusEnum } from '../../../services/thorchain/types'
import { NodeChainsCard } from './NodeChainsCard'
import { NodeNetworkContext } from './nodeNetwork'

type Props = {
  node: NodeInfo
  ctx: O.Option<NodeNetworkContext>
}

export const NodeNetworkCards = ({ node, ctx }: Props) =>
  node.status === NodeStatusEnum.Active ? (
    <div className="mt-6 grid w-full grid-cols-1 gap-6 xl:grid-cols-2">
      <NodeChainsCard node={node} ctx={ctx} />
    </div>
  ) : null
