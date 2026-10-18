import { useCallback, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { PlusIcon } from '@heroicons/react/24/outline'

import { Address } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { THORChain } from '../../../../shared/utils/chainIds'
import {
  AddNodeModal,
  NodeOperatorActionModal,
  OperatorNodeCard,
  SegmentedTabs,
  formatRuneAmount,
  isBondActionLocked
} from '../../../components/Bonds/provider'
import { OperatorFeesTile } from '../../../components/Bonds/provider/OperatorFeesTile'
import { groupNodesByOperator } from '../../../components/Bonds/provider/OperatorGroupsTable'
import { ErrorView } from '../../../components/shared/error'
import { AssetIcon } from '../../../components/uielements/assets/assetIcon'
import { BorderButton, FlatButton, RefreshButton } from '../../../components/uielements/button'
import { Spin } from '../../../components/uielements/spin'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { useUserNodesContext } from '../../../contexts/UserNodesContext'
import { useWalletContext } from '../../../contexts/WalletContext'
import { liveData } from '../../../helpers/rx/liveData'
import { hiddenString } from '../../../helpers/stringHelper'
import { useChurnConstants } from '../../../hooks/useChurnConstants'
import { useNetwork } from '../../../hooks/useNetwork'
import { useNextChurn } from '../../../hooks/useNextChurn'
import { useNodeNetworkContext } from '../../../hooks/useNodeNetworkContext'
import { useOpenExplorerTxUrl } from '../../../hooks/useOpenExplorerTxUrl'
import { operatorAddressesOf } from '../../../hooks/useOperatorFees'
import { OperatorNodeInfo, useOperatorNodes } from '../../../hooks/useOperatorNodes'
import { useReloadUntil } from '../../../hooks/useReloadUntil'
import { useValidateAddress } from '../../../hooks/useValidateAddress'
import * as bondsRoutes from '../../../routes/bonds'
import { FeeRD } from '../../../services/chain/types'
import { NodeInfo } from '../../../services/thorchain/types'
import { useApp } from '../../../store/app/hooks'
import { BondProviderPosition } from '../types'
import { OperatorNodesByOperator } from './OperatorNodesByOperator'
import { useBondProviderData } from './useBondProviderData'

enum NodesViewMode {
  ByNode = 'byNode',
  ByOperator = 'byOperator'
}

export const NodeOperatorView = (): JSX.Element => {
  const intl = useIntl()
  const navigate = useNavigate()
  const { network } = useNetwork()
  const { isPrivate } = useApp()

  const { getNodeInfos$, reloadNodeInfos, interact$, fees$ } = useThorchainContext()
  const { userNodes$, addNodeAddress, removeNodeByAddress } = useUserNodesContext()
  const {
    keystoreService: { validatePassword$ }
  } = useWalletContext()
  const { validateAddress } = useValidateAddress(THORChain)
  const { walletInfos, hasMultipleWalletTypes, balanceByAddress, positionsRD, reload } = useBondProviderData()
  const networkCtx = useNodeNetworkContext()
  const { openExplorerTxUrl, getExplorerTxUrl } = useOpenExplorerTxUrl(O.some(THORChain))
  const nextChurn = useNextChurn()
  const { maxBondProviders } = useChurnConstants()

  const [feeRD] = useObservableState<FeeRD>(
    () =>
      FP.pipe(
        fees$(),
        liveData.map((fees) => fees.fast)
      ),
    RD.initial
  )

  const [showAddNode, setShowAddNode] = useState(false)
  const [feeNodeAddress, setFeeNodeAddress] = useState<Address | null>(null)
  const [viewMode, setViewMode] = useState(NodesViewMode.ByNode)

  const walletAddresses = useMemo(() => walletInfos.map(({ address }) => address), [walletInfos])

  const operatorWalletType = useCallback(
    (nodeOperatorAddress: Address) =>
      hasMultipleWalletTypes
        ? walletInfos.find(({ address }) => address.toLowerCase() === nodeOperatorAddress.toLowerCase())?.walletType
        : undefined,
    [hasMultipleWalletTypes, walletInfos]
  )

  const nodesRD = useOperatorNodes({ walletAddresses, userNodes$, getNodeInfos$ })
  const monitoredNodes = useObservableState<Address[]>(userNodes$, [])
  const operatorAddresses = useMemo(
    () =>
      FP.pipe(
        nodesRD,
        RD.map(operatorAddressesOf),
        RD.getOrElse<Error, Address[]>(() => [])
      ),
    [nodesRD]
  )

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

  const closeFeeModal = useCallback(() => setFeeNodeAddress(null), [])
  const reloadUntil = useReloadUntil(nodesRD, reload, reloadNodeInfos)
  const finishFeeModal = useCallback(
    (settled: (node: NodeInfo) => boolean) => {
      const target = feeNodeAddress
      setFeeNodeAddress(null)
      reloadUntil((nodes) => {
        const fresh = nodes.find(({ address }) => address === target)
        return fresh !== undefined && settled(fresh)
      })
    },
    [feeNodeAddress, reloadUntil]
  )

  const oFeeTarget = useMemo(
    () =>
      FP.pipe(
        nodesRD,
        RD.toOption,
        O.chain((nodes) => O.fromNullable(nodes.find(({ address }) => address === feeNodeAddress))),
        O.chain((node) =>
          FP.pipe(
            O.fromNullable(
              walletInfos.find(({ address }) => address.toLowerCase() === node.nodeOperatorAddress.toLowerCase())
            ),
            O.map((signer) => ({ node, signer }))
          )
        )
      ),
    [feeNodeAddress, nodesRD, walletInfos]
  )

  const onOpenDetail = useCallback(
    (nodeAddress: Address, signer?: Address) =>
      navigate(bondsRoutes.node.path({ nodeAddress }), { state: { tab: bondsRoutes.BondsTab.NodeOperator, signer } }),
    [navigate]
  )

  const operatorGroups = useMemo(
    () =>
      groupNodesByOperator({
        nodes: RD.toNullable(allNodesRD) ?? [],
        operatorNodes: RD.toNullable(nodesRD) ?? [],
        positions: FP.pipe(
          positionsRD,
          RD.getOrElse<Error, BondProviderPosition[]>(() => [])
        )
      }),
    [allNodesRD, nodesRD, positionsRD]
  )

  const renderStats = useCallback(
    (nodes: OperatorNodeInfo[]) => {
      const operated = nodes.filter(({ isOperator }) => isOperator)
      const bondUnderManagement = operated.reduce((acc, { bond }) => acc.plus(bond), ZERO_BASE_AMOUNT)
      const providersCount = operated.reduce((acc, node) => acc + node.bondProviders.providers.length, 0)
      const ownBond = operated.reduce(
        (acc, node) =>
          node.bondProviders.providers
            .filter(({ bondAddress }) => bondAddress.toLowerCase() === node.nodeOperatorAddress.toLowerCase())
            .reduce((sum, { bond }) => sum.plus(bond), acc),
        ZERO_BASE_AMOUNT
      )
      const fromProviders = bondUnderManagement.minus(ownBond)

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
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-main text-[14px]">
            <span className="flex items-center gap-1.5">
              <span className="font-main-semi-bold text-[10px] tracking-[1.5px] text-gray2 uppercase dark:text-gray2d">
                {intl.formatMessage({ id: 'bonds.operator.ownBond' })}
              </span>
              <span className="text-text0 dark:text-text0d">
                ᚱ{isPrivate ? hiddenString : formatRuneAmount(ownBond)}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-main-semi-bold text-[10px] tracking-[1.5px] text-gray2 uppercase dark:text-gray2d">
                {intl.formatMessage({ id: 'bonds.operator.fromProviders' })}
              </span>
              <span className="text-gray2 dark:text-gray2d">
                ᚱ{isPrivate ? hiddenString : formatRuneAmount(fromProviders)}
              </span>
            </span>
          </div>
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
        {operatorAddresses.length > 0 && (
          <OperatorFeesTile
            network={network}
            isPrivate={isPrivate}
            operatorAddresses={operatorAddresses}
            onViewHistory={() => navigate(bondsRoutes.operatorFees.path())}
          />
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
                <>
                  <div className="flex w-full flex-wrap items-center justify-between gap-4">
                    <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
                      {viewMode === NodesViewMode.ByNode
                        ? intl.formatMessage({ id: 'bonds.byOperator.titleCards' }, { count: nodes.length })
                        : intl.formatMessage({ id: 'bonds.byOperator.titleTable' }, { count: operatorGroups.length })}
                    </span>
                    <SegmentedTabs
                      options={[
                        {
                          label: intl.formatMessage({ id: 'bonds.byOperator.tab.byNode' }),
                          value: NodesViewMode.ByNode
                        },
                        {
                          label: intl.formatMessage({ id: 'bonds.byOperator.tab.byOperator' }),
                          value: NodesViewMode.ByOperator
                        }
                      ]}
                      value={viewMode}
                      onChange={setViewMode}
                    />
                  </div>
                  <div className="mt-4 w-full">
                    {viewMode === NodesViewMode.ByNode ? (
                      <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-2">
                        {nodes.map((node) => (
                          <OperatorNodeCard
                            key={node.address}
                            network={network}
                            isPrivate={isPrivate}
                            node={node}
                            networkCtx={networkCtx}
                            operatorWalletType={operatorWalletType(node.nodeOperatorAddress)}
                            onChangeFee={isBondActionLocked(node) ? undefined : setFeeNodeAddress}
                            onRemoveMonitored={onRemoveMonitored}
                            onOpenDetail={onOpenDetail}
                          />
                        ))}
                      </div>
                    ) : (
                      <OperatorNodesByOperator
                        groups={operatorGroups}
                        network={network}
                        isPrivate={isPrivate}
                        networkCtx={networkCtx}
                        onOpenDetail={onOpenDetail}
                      />
                    )}
                  </div>
                </>
              )
            }
          )
        )}
      </div>

      {FP.pipe(
        oFeeTarget,
        O.fold(
          () => null,
          ({ node, signer }) => (
            <NodeOperatorActionModal
              action={{ type: 'changeFee' }}
              network={network}
              node={node}
              signer={signer}
              walletBalance={balanceByAddress(signer.address)}
              maxBondProviders={maxBondProviders}
              nextChurn={nextChurn}
              fee={feeRD}
              interact$={interact$}
              validatePassword$={validatePassword$}
              validateAddress={validateAddress}
              openExplorerTxUrl={openExplorerTxUrl}
              getExplorerTxUrl={getExplorerTxUrl}
              onClose={closeFeeModal}
              onFinish={finishFeeModal}
            />
          )
        )
      )}

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
