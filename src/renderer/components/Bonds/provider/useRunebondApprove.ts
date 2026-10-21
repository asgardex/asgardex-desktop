import { ComponentProps, useCallback, useMemo, useState } from 'react'

import { Address, BaseAmount } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'

import { RUNEBOND_RELOAD_DELAYS_MS, useReloadUntil } from '../../../hooks/useReloadUntil'
import {
  OperatorWhitelistRequests,
  OperatorWhitelistRequestsRD,
  WhitelistRequest,
  reloadRewards
} from '../../../services/runebond'
import { NodeInfo, NodeInfosRD } from '../../../services/thorchain/types'
import { BondWalletInfo } from '../../../views/bonds/types'
import { NodeOperatorAction, NodeOperatorActionModal } from './NodeOperatorActionModal'

type ApproveModalProps = ComponentProps<typeof NodeOperatorActionModal>

type Params = {
  requestsRD: OperatorWhitelistRequestsRD
  nodeInfosRD: NodeInfosRD
  reload: () => void
  reloadNodeInfos: () => void
  nodeByAddress: Map<Address, NodeInfo>
  signerFor: (node: NodeInfo) => O.Option<BondWalletInfo>
  balanceByAddress: (address: Address) => BaseAmount
  modal: Omit<ApproveModalProps, 'action' | 'node' | 'signer' | 'walletBalance' | 'onClose' | 'onFinish'>
}

export type RunebondApprove = {
  approve: (request: WhitelistRequest) => void
  oModalProps: O.Option<ApproveModalProps>
}

export const useRunebondApprove = ({
  requestsRD,
  nodeInfosRD,
  reload,
  reloadNodeInfos,
  nodeByAddress,
  signerFor,
  balanceByAddress,
  modal
}: Params): RunebondApprove => {
  const reloadNodesUntil = useReloadUntil(nodeInfosRD, reload, reloadNodeInfos)
  const reloadRequestsUntil = useReloadUntil(requestsRD, FP.constVoid, reloadRewards, RUNEBOND_RELOAD_DELAYS_MS)

  const [approving, setApproving] = useState<WhitelistRequest | null>(null)

  const closeApprove = useCallback(() => setApproving(null), [])
  const finishApprove = useCallback(
    (settled: (node: NodeInfo) => boolean) => {
      if (!approving) return
      const { id, nodeAddress } = approving
      setApproving(null)
      reloadRequestsUntil(
        ({ requests }: OperatorWhitelistRequests) =>
          !requests.some((request) => request.id === id && request.status === 'pending')
      )
      reloadNodesUntil((nodes) => {
        const fresh = nodes.find(({ address }) => address === nodeAddress)
        return fresh !== undefined && settled(fresh)
      })
    },
    [approving, reloadNodesUntil, reloadRequestsUntil]
  )

  const approveAction = useMemo(
    (): O.Option<NodeOperatorAction> =>
      FP.pipe(
        O.fromNullable(approving),
        O.map((request) => ({ type: 'approveRequest', request }))
      ),
    [approving]
  )

  const oModalProps = FP.pipe(
    O.fromNullable(approving),
    O.chain((request) =>
      FP.pipe(
        O.fromNullable(nodeByAddress.get(request.nodeAddress)),
        O.chain((node) =>
          FP.pipe(
            signerFor(node),
            O.chain((signer) =>
              FP.pipe(
                approveAction,
                O.map((action): ApproveModalProps => ({
                  ...modal,
                  action,
                  node,
                  signer,
                  walletBalance: balanceByAddress(signer.address),
                  onClose: closeApprove,
                  onFinish: finishApprove
                }))
              )
            )
          )
        )
      )
    )
  )

  return { approve: setApproving, oModalProps }
}
