import { useCallback, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { PlusIcon } from '@heroicons/react/24/outline'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { AddNodeModal, OperatorNodeCard, formatRuneAmount } from '../../../components/Bonds/provider'
import { ErrorView } from '../../../components/shared/error'
import { AssetIcon } from '../../../components/uielements/assets/assetIcon'
import { BorderButton, FlatButton, RefreshButton } from '../../../components/uielements/button'
import { Spin } from '../../../components/uielements/spin'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { useUserNodesContext } from '../../../contexts/UserNodesContext'
import { hiddenString } from '../../../helpers/stringHelper'
import { useNetwork } from '../../../hooks/useNetwork'
import { OperatorNodeInfo, useOperatorNodes } from '../../../hooks/useOperatorNodes'
import { useValidateAddress } from '../../../hooks/useValidateAddress'
import * as bondsRoutes from '../../../routes/bonds'
import { useApp } from '../../../store/app/hooks'
import { useBondProviderData } from './useBondProviderData'

export const NodeOperatorView = (): JSX.Element => {
  const intl = useIntl()
  const navigate = useNavigate()
  const { network } = useNetwork()
  const { isPrivate } = useApp()

  const { getNodeInfos$, reloadNodeInfos } = useThorchainContext()
  const { userNodes$, addNodeAddress, removeNodeByAddress } = useUserNodesContext()
  const { validateAddress } = useValidateAddress(THORChain)
  const { walletInfos, hasMultipleWalletTypes, reload } = useBondProviderData()

  const [showAddNode, setShowAddNode] = useState(false)

  const walletAddresses = useMemo(() => walletInfos.map(({ address }) => address), [walletInfos])

  // the operator address tells which wallet will sign this node's operator actions
  const operatorWalletType = useCallback(
    (nodeOperatorAddress: Address) =>
      hasMultipleWalletTypes
        ? walletInfos.find(({ address }) => address.toLowerCase() === nodeOperatorAddress.toLowerCase())?.walletType
        : undefined,
    [hasMultipleWalletTypes, walletInfos]
  )

  const nodesRD = useOperatorNodes({ walletAddresses, userNodes$, getNodeInfos$ })
  const monitoredNodes = useObservableState<Address[]>(userNodes$, [])

  const [allNodesRD] = useObservableState(() => getNodeInfos$, RD.initial)
  const oNodeAddresses: O.Option<Address[]> = useMemo(
    () =>
      FP.pipe(
        allNodesRD,
        RD.toOption,
        O.map((nodes) => nodes.map(({ address }) => address))
      ),
    [allNodesRD]
  )

  const openAddNode = useCallback(() => setShowAddNode(true), [])
  const closeAddNode = useCallback(() => setShowAddNode(false), [])
  const onAddNode = useCallback(
    (nodeAddress: Address) => addNodeAddress(nodeAddress, network),
    [addNodeAddress, network]
  )

  const onRemoveMonitored = useCallback(
    (nodeAddress: Address) => removeNodeByAddress(nodeAddress, network),
    [network, removeNodeByAddress]
  )

  const onOpenDetail = useCallback(
    (nodeAddress: Address) =>
      navigate(bondsRoutes.node.path({ nodeAddress }), { state: { tab: bondsRoutes.BondsTab.NodeOperator } }),
    [navigate]
  )

  const renderStats = useCallback(
    (nodes: OperatorNodeInfo[]) => {
      const operated = nodes.filter(({ isOperator }) => isOperator)
      const bondUnderManagement = operated.reduce((acc, { bond }) => acc.plus(bond), ZERO_BASE_AMOUNT)
      const providersCount = operated.reduce((acc, node) => acc + node.bondProviders.providers.length, 0)

      return (
        <div className="flex flex-col">
          <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
            {intl.formatMessage({ id: 'bonds.operator.bondUnderManagement' })}
          </span>
          <div className="mt-2 flex items-center gap-3">
            <AssetIcon asset={AssetRuneNative} size="normal" network={network} />
            <span className="font-main-bold text-[44px] leading-none text-text0 dark:text-text0d">
              {isPrivate ? hiddenString : formatRuneAmount(bondUnderManagement)}
            </span>
          </div>
          <span className="mt-2 font-main text-[14px] text-gray2 dark:text-gray2d">
            {intl.formatMessage(
              { id: 'bonds.operator.nodesAndProviders' },
              { nodes: operated.length, providers: providersCount }
            )}
          </span>
        </div>
      )
    },
    [intl, isPrivate, network]
  )

  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full flex-col gap-6 rounded-lg border border-solid border-gray0 bg-bg0 p-6 lg:flex-row lg:items-start lg:justify-between dark:border-gray0d dark:bg-bg0d">
        {FP.pipe(
          nodesRD,
          RD.fold(
            () => renderStats([]),
            () => renderStats([]),
            () => renderStats([]),
            renderStats
          )
        )}
        <div className="flex flex-col gap-3 lg:items-end lg:justify-between lg:self-stretch">
          <BorderButton size="normal" onClick={openAddNode}>
            <PlusIcon className="mr-1 h-[16px] w-[16px] text-inherit" />
            {intl.formatMessage({ id: 'bonds.node.add' })}
          </BorderButton>
          <RefreshButton className="self-end" onClick={reload} disabled={RD.isPending(nodesRD)} />
        </div>
      </div>

      <div className="mt-6 w-full">
        {FP.pipe(
          nodesRD,
          RD.fold(
            () => <Spin className="m-auto" />,
            () => <Spin className="m-auto" />,
            (error) => (
              <ErrorView
                title={intl.formatMessage({ id: 'bonds.nodes.error' })}
                subTitle={error?.message ?? error.toString()}
                extra={<FlatButton onClick={reloadNodeInfos}>{intl.formatMessage({ id: 'common.retry' })}</FlatButton>}
              />
            ),
            (nodes) => {
              if (nodes.length === 0) {
                return (
                  <div className="flex w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-gray0 p-10 dark:border-gray0d">
                    <span className="text-center font-main text-[14px] text-gray2 dark:text-gray2d">
                      {intl.formatMessage({ id: 'bonds.operator.empty' })}
                    </span>
                    <FlatButton size="normal" onClick={openAddNode}>
                      <PlusIcon className="mr-1 h-[16px] w-[16px] text-inherit" />
                      {intl.formatMessage({ id: 'bonds.node.add' })}
                    </FlatButton>
                  </div>
                )
              }
              return (
                <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">
                  {nodes.map((node) => (
                    <OperatorNodeCard
                      key={node.address}
                      network={network}
                      isPrivate={isPrivate}
                      node={node}
                      operatorWalletType={operatorWalletType(node.nodeOperatorAddress)}
                      onRemoveMonitored={onRemoveMonitored}
                      onOpenDetail={onOpenDetail}
                    />
                  ))}
                </div>
              )
            }
          )
        )}
      </div>

      {showAddNode && (
        <AddNodeModal
          monitoredNodes={monitoredNodes}
          oNodeAddresses={oNodeAddresses}
          validateAddress={validateAddress}
          onAdd={onAddNode}
          onClose={closeAddNode}
        />
      )}
    </div>
  )
}
