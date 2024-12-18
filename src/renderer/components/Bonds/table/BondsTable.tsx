import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { DesktopOutlined } from '@ant-design/icons'
import { Network } from '@xchainjs/xchain-client'
import { AssetCacao, MAYAChain } from '@xchainjs/xchain-mayachain'
import { AssetRuneNative, THORChain } from '@xchainjs/xchain-thorchain'
import { Address, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import { ColumnType } from 'antd/lib/table'
import clsx from 'clsx'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import { FormattedMessage, useIntl } from 'react-intl'

import { truncateAddress } from '../../../helpers/addressHelper'
import { useMimirConstants } from '../../../hooks/useMimirConstants'
import { NodeInfo, NodeInfos, Providers } from '../../../services/thorchain/types'
import { WalletAddressInfo } from '../../../views/wallet/BondsView'
import { ConfirmationModal } from '../../modal/confirmation'
import { RemoveAddressIcon } from '../../settings/WalletSettings.styles'
import { BaseButton, TextButton } from '../../uielements/button'
import { ExternalLinkIcon, Tooltip } from '../../uielements/common/Common.styles'
import * as Styled from './BondsTable.styles'
import * as H from './helpers'

type Props = {
  nodes: NodeInfos
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
interface CustomExpandIconProps {
  expanded: boolean
  onExpand: (record: string, event: React.MouseEvent<HTMLSpanElement, MouseEvent>) => void // Adjusted for <span>// Adjust YourRecordType accordingly
  record: string
}

export const BondsTable: React.FC<Props> = ({
  nodes,
  watchlist = [],
  addWatchlist,
  removeWatchlist,
  removeNode,
  network,
  goToNode,
  goToAction,
  walletAddresses,
  loading = false,
  className
}) => {
  const intl = useIntl()
  const { MINIMUMBONDINRUNE: minBondInRune } = useMimirConstants(['MINIMUMBONDINRUNE'])
  const [nodeToRemove, setNodeToRemove] = useState<O.Option<Address>>(O.none)

  const isMyAddress = useCallback(
    (bondAddress: string) => {
      const match = [...walletAddresses.THOR, ...walletAddresses.MAYA].find((addr) => addr.address === bondAddress)

      return match !== undefined
    },
    [walletAddresses]
  )

  const columns: ColumnType<NodeInfo>[] = useMemo(
    () => [
      {
        key: 'watch',
        width: 40,
        title: '',
        render: (_, { address }) => (
          <H.Watchlist
            addWatchlist={() => {
              addWatchlist(address, network)
            }}
          />
        ),
        align: 'right'
      },
      {
        key: 'remove',
        width: 40,
        title: '',
        render: (_, { address }) => (
          <H.Delete
            deleteNode={() => {
              setNodeToRemove(O.some(address))
            }}
          />
        ),
        align: 'right'
      },
      {
        key: 'node',
        title: intl.formatMessage({ id: 'bonds.node' }),
        dataIndex: 'address',
        render: (_, { address }) => <H.NodeAddress network={network} address={address} />,
        align: 'left'
      },
      {
        key: 'bond',
        width: 150,
        title: intl.formatMessage({ id: 'bonds.bond' }),
        render: (_, data) => <H.BondValue data={data} />,
        align: 'right'
      },
      {
        key: 'award',
        width: 150,
        title: intl.formatMessage({ id: 'bonds.award' }),
        align: 'right',
        render: (_, data) => <H.AwardValue data={data} />
      },
      {
        key: 'status',
        width: 100,
        title: intl.formatMessage({ id: 'bonds.status' }),
        render: (_, data) => <H.Status data={data} />,
        responsive: ['sm'],
        align: 'center'
      },
      {
        key: 'info',
        width: 40,
        title: '',
        render: (_, { address }) => <ExternalLinkIcon onClick={() => goToNode(address)} />,
        responsive: ['md'],
        align: 'center'
      }
    ],
    [intl, network, addWatchlist, goToNode]
  )
  const networkPrefix = network === 'mainnet' ? '' : 's'

  const getNodeChain = useCallback(
    (address: string) => {
      if (address.startsWith(`${networkPrefix}maya`)) {
        return MAYAChain
      } else if (address.startsWith(`${networkPrefix}thor`)) {
        return THORChain
      } else {
        return null // or throw an error if unexpected format
      }
    },
    [networkPrefix]
  )

  const [matchedNodeAddress, setMatchedNodeAddress] = useState<string[]>([])
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([])
  const [collapseAll, setCollapseAll] = useState(false)

  const handleCollapseAll = useCallback(() => {
    if (collapseAll) {
      setExpandedRowKeys([])
    } else {
      const nodeAddy = nodes.map((node) => node.address)
      setExpandedRowKeys(nodeAddy)
    }
    setCollapseAll(!collapseAll)
  }, [collapseAll, nodes])

  useEffect(() => {
    const chains: (keyof typeof walletAddresses)[] = ['THOR', 'MAYA']

    // Initialize an array to store all matched keys
    const matchedKeys: string[] = []

    for (const node of nodes) {
      node.bondProviders.providers.some((provider) =>
        chains.some((chain) =>
          walletAddresses[chain].some((walletAddress) => {
            const networkPrefix = network === 'mainnet' ? '' : 's'
            const isMatch =
              (walletAddress.address.startsWith(`${networkPrefix}thor`) ||
                walletAddress.address.startsWith(`${networkPrefix}maya`)) &&
              walletAddress.address === provider.bondAddress

            if (isMatch) {
              matchedKeys.push(node.address) // Store each matched key
            }

            return isMatch // Continue to check all providers and chains
          })
        )
      )
    }

    if (matchedKeys.length > 0) {
      setMatchedNodeAddress(matchedKeys)
      setExpandedRowKeys(matchedKeys) // Expand all matched rows
    } else {
      setMatchedNodeAddress([])
      setExpandedRowKeys([])
    }
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
        <Styled.ConfirmationModalText>
          <FormattedMessage
            id="bonds.node.removeMessage"
            values={{
              node: <Styled.ConfirmationModalAddress>{nodeAddress}</Styled.ConfirmationModalAddress>
            }}
          />
        </Styled.ConfirmationModalText>
      ),
      visible: !!nodeAddress
    }
  }, [nodeToRemove, removeNode])

  const CustomExpandIcon: React.FC<CustomExpandIconProps> = ({ expanded, onExpand, record }) => (
    <Styled.ExpandIcon onClick={(e) => onExpand(record, e)} rotate={expanded ? 90 : 0}></Styled.ExpandIcon>
  )

  const renderSubWalletType = useCallback(
    (bondAddress: string) => {
      let walletTypeLabel = 'Not a wallet address'

      const searchWalletAddresses = (addresses: WalletAddressInfo[], chainLabel: string) => {
        const match = addresses.find((addr) => addr.address === bondAddress)
        if (match) {
          walletTypeLabel = `${match.walletType} (${chainLabel})`
        }
      }

      // Search in both THOR and MAYA wallet addresses
      searchWalletAddresses(walletAddresses.THOR, 'THOR')
      searchWalletAddresses(walletAddresses.MAYA, 'MAYA')

      // Conditionally render the output based on whether a match was found
      return (
        <div className="flex w-full items-center justify-between !text-11 text-text2 dark:text-text2d">
          {walletTypeLabel !== 'Not a wallet address' && (
            <Styled.TextLabel className="!text-11">{intl.formatMessage({ id: 'common.owner' })}</Styled.TextLabel>
          )}
          {walletTypeLabel}
        </div>
      )
    },
    [intl, walletAddresses.MAYA, walletAddresses.THOR]
  )

  const renderSubActions = useCallback(
    (record) => {
      const { bondAddress, bondAmount, status, signMembership, nodeAddress } = record

      // Check if the bond address matches a wallet address in either THOR or MAYA
      const matchedWalletInfo =
        walletAddresses.THOR.find((walletInfo) => walletInfo.address === bondAddress) ||
        walletAddresses.MAYA.find((walletInfo) => walletInfo.address === bondAddress)

      // Check if the bond address belongs to the current user's wallet
      const isWalletAddress = !!matchedWalletInfo

      const nodeChain = getNodeChain(bondAddress)
      const matchedAddresses = matchedNodeAddress.filter((address) => {
        const addressChain = getNodeChain(address)
        return addressChain === nodeChain
      })

      const isLeaveEligible = bondAmount.amount().gte(minBondInRune)

      const unbondDisabled =
        status === 'Active' || (status === 'Standby' && signMembership && signMembership.includes(nodeAddress))

      // Store walletType for the address and pass it to bond/unbond actions
      const walletType = matchedWalletInfo?.walletType || 'Unknown'

      return (
        <div className="mt-4 flex flex-grow items-end justify-center">
          <TextButton
            disabled={!isWalletAddress}
            size="normal"
            onClick={() => goToAction('bond', matchedAddresses[0], walletType)}>
            {intl.formatMessage({ id: 'deposit.interact.actions.bond' })}
          </TextButton>
          <TextButton
            disabled={!isWalletAddress || unbondDisabled}
            size="normal"
            onClick={() => goToAction('unbond', matchedAddresses[0], walletType)}>
            {intl.formatMessage({ id: 'deposit.interact.actions.unbond' })}
          </TextButton>
          <TextButton
            disabled={!isWalletAddress || !isLeaveEligible}
            size="normal"
            onClick={() => goToAction('leave', matchedAddresses[0], walletType)}>
            {intl.formatMessage({ id: 'deposit.interact.actions.leave' })}
          </TextButton>
        </div>
      )
    },
    [walletAddresses.THOR, walletAddresses.MAYA, getNodeChain, matchedNodeAddress, minBondInRune, intl, goToAction]
  )

  return (
    <>
      <div className="flex justify-end">
        <BaseButton
          size="normal"
          className="mx-4 mb-4 rounded-md border border-solid border-turquoise p-1 text-14 capitalize text-gray2 dark:border-gray1d dark:text-gray2d"
          onClick={handleCollapseAll}>
          {collapseAll
            ? intl.formatMessage({ id: 'common.collapseAll' })
            : intl.formatMessage({ id: 'common.expandAll' })}
        </BaseButton>
      </div>
      <Styled.Table
        className={className}
        columns={columns}
        dataSource={nodes.map((node) => ({ ...node, key: node.address }))}
        loading={loading}
        expandable={{
          expandedRowRender: (record) => (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {record.bondProviders.providers.map((provider: Providers, index: string) => {
                const isMonitoring = watchlist.includes(provider.bondAddress)
                const isMyAddy = isMyAddress(provider.bondAddress)

                return (
                  <div
                    key={`${record.address}-${index}`}
                    className={clsx(
                      'flex flex-col rounded-lg border border-solid border-gray0 p-4 dark:border-gray0d',
                      { ' bg-gray0 dark:bg-gray0d': !isMonitoring && !isMyAddy },
                      { 'bg-transparent': isMonitoring && !isMyAddy },
                      { 'bg-turquoise/20': isMyAddy }
                    )}>
                    <div className="flex items-center justify-between">
                      <Styled.TextLabel className="!text-18">
                        {formatAssetAmountCurrency({
                          asset: provider.bondAddress.startsWith('thor') ? AssetRuneNative : AssetCacao,
                          amount: baseToAsset(provider.bond),
                          trimZeros: true,
                          decimal: 0
                        })}
                      </Styled.TextLabel>
                      {/* TODO: locale (cinnamoroll) */}
                      {isMonitoring ? (
                        <Styled.DeleteButton>
                          <Tooltip title="Remove this bond provider from the watch list">
                            <RemoveAddressIcon onClick={() => removeWatchlist(provider.bondAddress, network)} />
                          </Tooltip>
                        </Styled.DeleteButton>
                      ) : (
                        <Styled.WatchlistButton>
                          <Tooltip title="Add this bond provider to the watch list">
                            <DesktopOutlined onClick={() => addWatchlist(provider.bondAddress, network)} />
                          </Tooltip>
                        </Styled.WatchlistButton>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <Styled.TextLabel className="!text-11">
                        {intl.formatMessage({ id: 'bonds.bondProvider' })}
                      </Styled.TextLabel>
                      <span className="!text-14 lowercase text-text2 dark:text-text2d">
                        {truncateAddress(
                          provider.bondAddress,
                          provider.bondAddress.startsWith('thor') ? THORChain : MAYAChain,
                          network
                        )}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      {renderSubWalletType(provider.bondAddress)}
                    </div>
                    {renderSubActions({
                      bondAddress: provider.bondAddress,
                      bondAmount: provider.bond,
                      bond: record.status,
                      signMembership: record.signMembership,
                      nodeAddress: record.nodeAddress
                    })}
                    {record.nodeAddress}
                  </div>
                )
              })}
            </div>
          ),
          rowExpandable: (record) => record.bondProviders.providers.length > 0,
          expandedRowKeys: expandedRowKeys,
          expandIcon: ({ expanded, onExpand, record }) => CustomExpandIcon({ expanded, onExpand, record }),
          onExpand: (expanded, record) => {
            if (expanded) {
              setExpandedRowKeys((prevKeys) => [...prevKeys, record.address])
            } else {
              setExpandedRowKeys((prevKeys) => prevKeys.filter((key) => key !== record.address))
            }
          }
        }}
      />
      <ConfirmationModal {...removeConfirmationProps} />
    </>
  )
}
