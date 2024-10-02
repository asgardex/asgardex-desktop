import React, { useEffect, useMemo, useState } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address } from '@xchainjs/xchain-util'
import { ColumnType } from 'antd/lib/table'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import { FormattedMessage, useIntl } from 'react-intl'

import { NodeInfo, NodeInfos, Providers, NodeStatusEnum } from '../../../services/thorchain/types'
import { WalletAddressInfo } from '../../../views/wallet/BondsView'
import { ConfirmationModal } from '../../modal/confirmation'
import { TextButton } from '../../uielements/button'
import { ExternalLinkIcon } from '../../uielements/common/Common.styles'
import * as Styled from './BondsTable.styles'
import * as H from './helpers'

type Props = {
  nodes: NodeInfos
  loading?: boolean
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
type ProvidersWithStatus = Providers & { status: NodeStatusEnum; signMembership: string[]; nodeAddress: Address }

export const BondsTable: React.FC<Props> = ({
  nodes,
  removeNode,
  network,
  goToNode,
  goToAction,
  walletAddresses,
  loading = false,
  className
}) => {
  const intl = useIntl()
  const [nodeToRemove, setNodeToRemove] = useState<O.Option<Address>>(O.none)

  const columns: ColumnType<NodeInfo>[] = useMemo(
    () => [
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
    [intl, network, goToNode]
  )
  const networkPrefix = network === 'mainnet' ? '' : 's'
  const getNodeChain = (address: string) => {
    if (address.startsWith(`${networkPrefix}maya`)) {
      return MAYAChain
    } else if (address.startsWith(`${networkPrefix}thor`)) {
      return THORChain
    } else {
      return null // or throw an error if unexpected format
    }
  }

  const expandedTableColumns: ColumnType<ProvidersWithStatus>[] = [
    {
      title: intl.formatMessage({ id: 'bonds.bondProvider' }),
      dataIndex: 'bondAddress',
      key: 'bondAddress',
      render: (text) => <H.NodeAddress network={network} address={text} />
    },
    {
      title: intl.formatMessage({ id: 'common.action' }),
      dataIndex: 'action',
      key: 'action',
      render: (_, record) => {
        const { bondAddress, status, signMembership, nodeAddress } = record

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

        const unbondDisabled =
          status === 'Active' || (status === 'Standby' && signMembership && signMembership.includes(nodeAddress))

        // Store walletType for the address and pass it to bond/unbond actions
        const walletType = matchedWalletInfo?.walletType || 'Unknown'

        return (
          <div className="flex">
            <TextButton
              disabled={!isWalletAddress}
              size="normal"
              onClick={() => goToAction('bond', matchedAddresses[0], walletType)}>
              {intl.formatMessage({ id: 'deposit.interact.actions.bond' })}
            </TextButton>
            <div className="flex border-solid border-gray1 dark:border-gray1d">
              <TextButton
                disabled={!isWalletAddress || unbondDisabled}
                size="normal"
                onClick={() => goToAction('unbond', matchedAddresses[0], walletType)}>
                {intl.formatMessage({ id: 'deposit.interact.actions.unbond' })}
              </TextButton>
            </div>
          </div>
        )
      }
    },
    {
      title: intl.formatMessage({ id: 'bonds.bond' }),
      dataIndex: 'bond',
      key: 'bond',
      render: (_, data) => <H.BondProviderValue providers={data} />
    },
    {
      key: 'walletType',
      dataIndex: 'walletType',
      title: intl.formatMessage({ id: 'common.owner' }),
      render: (_, { bondAddress }) => {
        let walletTypeLabel = 'Not a wallet address'

        const searchWalletAddresses = (addresses: WalletAddressInfo[], chainLabel: string) => {
          const match = addresses.find((addr) => addr.address === bondAddress)
          if (match) {
            walletTypeLabel = `${match.walletType} (${chainLabel})`
          }
        }
        searchWalletAddresses(walletAddresses.THOR, 'THOR')
        searchWalletAddresses(walletAddresses.MAYA, 'MAYA')
        return (
          <div className="text-sm text-text2 dark:text-text2d">
            <Styled.WalletTypeLabel>{walletTypeLabel}</Styled.WalletTypeLabel>
          </div>
        )
      }
    }
    // Add other columns for the expanded table as needed
  ]

  const [matchedNodeAddress, setMatchedNodeAddress] = useState<string[]>([])
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([])

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

  return (
    <>
      <Styled.Table
        className={className}
        columns={columns}
        dataSource={nodes.map((node) => ({ ...node, key: node.address }))}
        loading={loading}
        expandable={{
          expandedRowRender: (record) => (
            <Styled.Table
              columns={expandedTableColumns}
              dataSource={record.bondProviders.providers.map((provider: Providers, index: string) => ({
                bondAddress: provider.bondAddress,
                bond: provider.bond,
                status: record.status,
                member: record.signMembership,
                nodeAddres: record.nodeAddress,
                key: `${record.address}-${index}`
              }))}
              pagination={false}
            />
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
