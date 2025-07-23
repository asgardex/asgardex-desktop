import { useCallback, useEffect, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { TvIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { ColumnDef, ExpandedState } from '@tanstack/react-table'
import { Network } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import { Address, assetToString, BaseAmount, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useObservableState } from 'observable-hooks'
import { FormattedMessage, useIntl } from 'react-intl'

import RemoveIcon from '../../../assets/svg/icon-remove.svg?react'
import { useMidgardMayaContext } from '../../../contexts/MidgardMayaContext'
import { truncateAddress } from '../../../helpers/addressHelper'
import { getChainAsset } from '../../../helpers/chainHelper'
import { useMimirConstants } from '../../../hooks/useMimirConstants'
import { usePricePoolMaya } from '../../../hooks/usePricePoolMaya'
import {
  NodeInfo as MayaNodeInfo,
  NodeInfos as MayaNodeInfos,
  Providers as MayaProviders
} from '../../../services/mayachain/types'
import { NodeInfo as ThorNodeInfo, NodeInfos as ThorNodeInfos, Providers } from '../../../services/thorchain/types'
import { FixmeType } from '../../../types/asgardex'
import { WalletAddressInfo } from '../../../views/bonds/types'
import { ConfirmationModal } from '../../modal/confirmation'
import { Table } from '../../table'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { BaseButton, TextButton } from '../../uielements/button'
import { ExternalLinkIcon, Tooltip } from '../../uielements/common/Common.styles'
import { Label } from '../../uielements/label'
import { BondProviderInfo } from './BondProviderInfo'
import * as H from './helpers'

type Props = {
  nodes: ThorNodeInfos | MayaNodeInfos
  protocol: string // THORChain or MAYAChain
  watchlist?: string[]
  loading?: boolean
  addWatchlist: (nodeOrBond: Address, network: Network) => void
  removeWatchlist: (bondProviders: Address, network: Network) => void
  removeNode: (node: Address) => void
  goToNode: (node: Address) => void
  goToAction: (action: string, node: string, walletType: string) => void
  network: Network
  className?: string
  walletAddresses: Record<'THOR' | 'MAYA', WalletAddressInfo[]>
}

export const BondsTable = ({
  nodes,
  protocol,
  watchlist = [],
  addWatchlist,
  removeWatchlist,
  removeNode,
  network,
  goToNode,
  goToAction,
  walletAddresses,
  loading = false
}: Props) => {
  const intl = useIntl()
  const { MINIMUMBONDINRUNE: minBondInRune } = useMimirConstants(['MINIMUMBONDINRUNE'])
  const [nodeToRemove, setNodeToRemove] = useState<O.Option<Address>>(O.none)
  const pricePoolMaya = usePricePoolMaya()
  const {
    service: {
      pools: { allPoolDetails$: allPoolDetailsMaya$ }
    }
  } = useMidgardMayaContext()

  const poolDetailsRD = useObservableState(allPoolDetailsMaya$, RD.pending)

  const isMyAddress = useCallback(
    (bondAddress: string) => {
      const match = [...walletAddresses.THOR, ...walletAddresses.MAYA].find((addr) => addr.address === bondAddress)
      return match !== undefined
    },
    [walletAddresses]
  )

  const baseColumns: ColumnDef<ThorNodeInfo | MayaNodeInfo, FixmeType>[] = useMemo(
    () => [
      {
        accessorKey: 'watch',
        header: '',
        cell: ({ row }) => {
          return (
            <div className="flex items-center justify-around space-x-2">
              {row.original.bondProviders.providers.length > 0 && (
                <div className="flex items-center justify-center" onClick={() => row.toggleExpanded()}>
                  <ChevronRightIcon
                    className={clsx(
                      'mt-0 w-5 h-5 stroke-turquoise cursor-pointer',
                      row.getIsExpanded() ? 'rotate-90' : 'rotate-0'
                    )}
                  />
                </div>
              )}
              <H.Watchlist
                addWatchlist={() => {
                  addWatchlist(row.original.address, network)
                }}
              />
              <H.Delete
                deleteNode={() => {
                  setNodeToRemove(O.some(row.original.address))
                }}
              />
            </div>
          )
        },
        enableSorting: false,
        size: 90
      },
      {
        accessorKey: 'node',
        header: intl.formatMessage({ id: 'bonds.node' }),
        cell: ({ row }) => <H.NodeAddress network={network} address={row.original.address} />,
        size: 140,
        enableSorting: false
      },
      {
        accessorKey: 'status',
        size: 100,
        header: () => (
          <Label align="center" color="gray">
            {intl.formatMessage({ id: 'bonds.status' })}
          </Label>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-between">
            <H.Status data={row.original} />
            <ExternalLinkIcon
              className="w-5 h-5 text-text1 dark:text-text1d"
              onClick={() => goToNode(row.original.address)}
            />
          </div>
        ),
        enableSorting: false
      }
    ],
    [addWatchlist, goToNode, intl, network]
  )

  const thorColumns: ColumnDef<ThorNodeInfo | MayaNodeInfo, FixmeType>[] = useMemo(
    () => [
      ...baseColumns,
      {
        accessorKey: 'bond',
        size: 100,
        header: intl.formatMessage({ id: 'bonds.bond' }),
        cell: ({ row }) => <H.BondValue data={row.original} />,
        enableSorting: false
      },
      {
        accessorKey: 'award',
        size: 100,
        header: intl.formatMessage({ id: 'bonds.award' }),
        cell: ({ row }) => <H.AwardValue data={row.original} />,
        enableSorting: false
      }
    ],
    [baseColumns, intl]
  )

  const mayaColumns: ColumnDef<ThorNodeInfo | MayaNodeInfo, FixmeType>[] = useMemo(
    () => [
      ...baseColumns,
      {
        accessorKey: 'bond',
        size: 150,
        header: intl.formatMessage({ id: 'bonds.bond' }),
        cell: ({ row }) => <H.BondValueMaya data={row.original} />,
        enableSorting: false
      },
      {
        accessorKey: 'pools',
        size: 160,
        header: 'Bonded Pools',
        cell: ({ row }) => {
          // Collect all pools from all providers and deduplicate them
          const allPools = (row.original.bondProviders.providers as MayaProviders[]).flatMap((provider) =>
            provider.pools.map((pool) => assetToString(pool.asset))
          )
          const uniquePools = [...new Set(allPools)]

          return (
            <div className="flex flex-row items-center justify-end space-x-1">
              {uniquePools.map((assetPool) => (
                <AssetIcon
                  key={assetPool}
                  asset={getChainAsset(assetPool.split('.')[0])}
                  size="xsmall"
                  network={network}
                />
              ))}
            </div>
          )
        },
        enableSorting: false
      }
    ],
    [baseColumns, intl, network]
  )

  const columns = protocol === THORChain ? thorColumns : mayaColumns

  const networkPrefix = network === 'mainnet' ? '' : 's'

  const getNodeChain = useCallback(
    (address: string) => {
      if (address.startsWith(`${networkPrefix}maya`)) return MAYAChain
      if (address.startsWith(`${networkPrefix}thor`)) return THORChain
      return null
    },
    [networkPrefix]
  )

  const [matchedNodeAddress, setMatchedNodeAddress] = useState<string[]>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [collapseAll, setCollapseAll] = useState(false)

  const handleCollapseAll = useCallback(() => {
    if (collapseAll) {
      setExpanded({})
    } else {
      const expandKeys = nodes.reduce(
        (acc, node) => ({
          ...acc,
          [node.address]: true
        }),
        {}
      )
      setExpanded(expandKeys)
    }
    setCollapseAll(!collapseAll)
  }, [collapseAll, nodes])

  useEffect(() => {
    const updateMatchedNodes = (nodeList: ThorNodeInfo[] | MayaNodeInfo[]) => {
      const chains: (keyof typeof walletAddresses)[] = ['THOR', 'MAYA']
      const matchedKeys: string[] = []

      for (const node of nodeList) {
        node.bondProviders.providers.some((provider) =>
          chains.some((chain) =>
            walletAddresses[chain].some((walletAddress) => {
              const networkPrefix = network === 'mainnet' ? '' : 's'
              const isMatch =
                (walletAddress.address.startsWith(`${networkPrefix}thor`) ||
                  walletAddress.address.startsWith(`${networkPrefix}maya`)) &&
                walletAddress.address === provider.bondAddress

              if (isMatch) matchedKeys.push(node.address)
              return isMatch
            })
          )
        )
      }

      setMatchedNodeAddress(matchedKeys)
      const expandKeys = matchedKeys.reduce(
        (acc, addy) => ({
          ...acc,
          [addy]: true
        }),
        {}
      )
      setExpanded(expandKeys)
    }

    updateMatchedNodes(nodes)
  }, [network, nodes, walletAddresses])

  const removeConfirmationProps = useMemo(() => {
    const nodeAddress = FP.pipe(
      nodeToRemove,
      O.getOrElse(() => '')
    )
    return {
      onClose: () => setNodeToRemove(O.none),
      onSuccess: () => removeNode(nodeAddress),
      content: (
        <Label size="big">
          <FormattedMessage
            id="bonds.node.removeMessage"
            values={{
              node: <span className="text-16 font-bold font-mainBold">{nodeAddress}</span>
            }}
          />
        </Label>
      ),
      visible: !!nodeAddress
    }
  }, [nodeToRemove, removeNode])

  const renderSubWalletType = useCallback(
    (bondAddress: string) => {
      let walletTypeLabel = 'Not a wallet address'
      const searchWalletAddresses = (addresses: WalletAddressInfo[], chainLabel: string) => {
        const match = addresses.find((addr) => addr.address === bondAddress)
        if (match) walletTypeLabel = `${match.walletType} (${chainLabel})`
      }

      searchWalletAddresses(walletAddresses.THOR, 'THOR')
      searchWalletAddresses(walletAddresses.MAYA, 'MAYA')

      return (
        <div className="flex w-full justify-between !text-11 text-text2 dark:text-text2d">
          {walletTypeLabel !== 'Not a wallet address' ? (
            <>
              <Label size="small" textTransform="uppercase">
                {intl.formatMessage({ id: 'common.owner' })}
              </Label>
              <Label size="small" align="right" textTransform="uppercase">
                {walletTypeLabel}
              </Label>
            </>
          ) : (
            <Label size="small" textTransform="uppercase">
              {walletTypeLabel}
            </Label>
          )}
        </div>
      )
    },
    [intl, walletAddresses.MAYA, walletAddresses.THOR]
  )

  const renderSubActions = useCallback(
    (record: {
      bondAddress: string
      bondAmount?: BaseAmount
      status: string
      signMembership: string[]
      nodeAddress: string
    }) => {
      const { bondAddress, bondAmount, status, signMembership, nodeAddress } = record
      const matchedWalletInfo =
        walletAddresses.THOR.find((walletInfo) => walletInfo.address === bondAddress) ||
        walletAddresses.MAYA.find((walletInfo) => walletInfo.address === bondAddress)
      const isWalletAddress = !!matchedWalletInfo
      const nodeChain = getNodeChain(bondAddress)
      const matchedAddresses = matchedNodeAddress.filter((address) => getNodeChain(address) === nodeChain)
      const isLeaveEligible = bondAmount ? baseToAsset(bondAmount).amount().gte(minBondInRune) : false
      const unbondDisabled =
        status === 'Active' || (status === 'Standby' && signMembership && signMembership.includes(nodeAddress))
      const walletType = matchedWalletInfo?.walletType || 'Unknown'

      return (
        <div className="flex flex-grow flex-col">
          <div className="mt-4 w-full">
            <div className="flex items-center justify-between">
              <Label size="small" textTransform="uppercase">
                {intl.formatMessage({ id: 'bonds.bondProvider' })}
              </Label>
              <Label className="!w-auto" textTransform="lowercase" color="gray">
                {truncateAddress(bondAddress, protocol, network)}
              </Label>
            </div>
            <div className="mt-2 flex items-center justify-between">{renderSubWalletType(bondAddress)}</div>
          </div>
          <div className="mt-4 flex items-center justify-center">
            <TextButton
              disabled={!isWalletAddress}
              size="normal"
              onClick={() => goToAction('bond', matchedAddresses[0] || nodeAddress, walletType)}>
              {intl.formatMessage({ id: 'deposit.interact.actions.bond' })}
            </TextButton>
            <TextButton
              disabled={!isWalletAddress || unbondDisabled}
              size="normal"
              onClick={() => goToAction('unbond', matchedAddresses[0] || nodeAddress, walletType)}>
              {intl.formatMessage({ id: 'deposit.interact.actions.unbond' })}
            </TextButton>
            <TextButton
              disabled={!isWalletAddress || !isLeaveEligible}
              size="normal"
              onClick={() => goToAction('leave', matchedAddresses[0] || nodeAddress, walletType)}>
              {intl.formatMessage({ id: 'deposit.interact.actions.leave' })}
            </TextButton>
          </div>
        </div>
      )
    },
    [
      walletAddresses.THOR,
      walletAddresses.MAYA,
      getNodeChain,
      matchedNodeAddress,
      minBondInRune,
      intl,
      protocol,
      network,
      renderSubWalletType,
      goToAction
    ]
  )

  return (
    <>
      <div className="flex justify-end">
        <BaseButton
          size="normal"
          className="mx-4 mb-4 rounded-md border border-solid border-gray1 p-1 text-14 capitalize text-text2 dark:border-gray1d dark:text-text2d"
          onClick={handleCollapseAll}>
          {collapseAll
            ? intl.formatMessage({ id: 'common.collapseAll' })
            : intl.formatMessage({ id: 'common.expandAll' })}
        </BaseButton>
      </div>
      <div className="p-2">
        <Table
          loading={loading}
          columns={columns}
          data={nodes}
          expandable
          expanded={expanded}
          setExpanded={setExpanded}
          getRowId={(row) => row.address}
          renderSubRow={(record) => {
            if (protocol === THORChain) {
              const thorRecord = record as ThorNodeInfo
              return (
                <div className="p-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {thorRecord.bondProviders.providers.map((provider: Providers, index: number) => {
                    const isMonitoring = watchlist.includes(provider.bondAddress)
                    const isMyAddy = isMyAddress(provider.bondAddress)

                    return (
                      <div
                        key={`${record.address}-${index}`}
                        className={clsx(
                          'flex flex-col rounded-lg border border-solid border-gray0 p-4 dark:border-gray0d',
                          { 'bg-gray0 dark:bg-gray0d': !isMonitoring && !isMyAddy },
                          { 'bg-transparent': isMonitoring && !isMyAddy },
                          { 'bg-turquoise/20': isMyAddy }
                        )}>
                        <div className="flex items-center justify-between">
                          <Label size="large" textTransform="uppercase">
                            {formatAssetAmountCurrency({
                              asset: AssetRuneNative,
                              amount: baseToAsset(provider.bond),
                              trimZeros: true,
                              decimal: 0
                            })}
                          </Label>
                          {isMonitoring ? (
                            <Tooltip title="Remove this bond provider from the watch list">
                              <RemoveIcon
                                className="w-4 h-4 cursor-pointer"
                                onClick={() => removeWatchlist(provider.bondAddress, network)}
                              />
                            </Tooltip>
                          ) : (
                            <Tooltip title="Add this bond provider to the watch list">
                              <TvIcon
                                className="cursor-pointer text-turquoise"
                                width={16}
                                height={16}
                                onClick={() => addWatchlist(provider.bondAddress, network)}
                              />
                            </Tooltip>
                          )}
                        </div>
                        {renderSubActions({
                          bondAddress: provider.bondAddress,
                          bondAmount: provider.bond,
                          status: record.status,
                          signMembership: record.signMembership,
                          nodeAddress: record.address
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            } else {
              const mayaRecord = record as MayaNodeInfo
              return (
                <div className="p-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {mayaRecord.bondProviders.providers.map((provider: MayaProviders, index: number) => (
                    <BondProviderInfo
                      key={`${record.address}-${index}`}
                      provider={provider}
                      nodeAddress={mayaRecord.address}
                      network={network}
                      pricePoolData={pricePoolMaya}
                      poolDetails={poolDetailsRD}
                      isMonitoring={watchlist.includes(provider.bondAddress)}
                      isMyAddress={isMyAddress(provider.bondAddress)}
                      addWatchlist={addWatchlist}
                      removeWatchlist={removeWatchlist}
                      renderSubActions={renderSubActions}
                      recordStatus={record.status}
                      recordSignMembership={record.signMembership}
                      recordBond={record.bond}
                    />
                  ))}
                </div>
              )
            }
          }}
        />
      </div>
      <ConfirmationModal {...removeConfirmationProps} />
    </>
  )
}
