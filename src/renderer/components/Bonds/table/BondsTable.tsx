import React, { useEffect, useMemo, useState } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { Address, baseAmount, BaseAmount } from '@xchainjs/xchain-util'
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
  goToAction: (action: string, node: string, bond: BaseAmount) => void
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
        const { bondAddress, bond, status, signMembership, nodeAddress } = record
        const isWalletAddress =
          walletAddresses.THOR.some((walletInfo) => walletInfo.address === bondAddress) ||
          walletAddresses.MAYA.some((walletInfo) => walletInfo.address === bondAddress)

        const unbondDisabled =
          status === 'Active' || (status === 'Standby' && signMembership && signMembership.includes(nodeAddress))

        return (
          <div className="flex">
            <TextButton
              disabled={!isWalletAddress}
              size="normal"
              onClick={() => goToAction('bond', matchedNodeAddress, baseAmount(0))}>
              {intl.formatMessage({ id: 'deposit.interact.actions.bond' })}
            </TextButton>
            <div className="flex border-solid border-gray1 dark:border-gray1d">
              <TextButton
                disabled={!isWalletAddress || unbondDisabled}
                size="normal"
                onClick={() => goToAction('unbond', matchedNodeAddress, bond)}>
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
  const [matchedNodeAddress, setMatchedNodeAddress] = useState<string>('')
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([])

  useEffect(() => {
    const chains: (keyof typeof walletAddresses)[] = ['THOR', 'MAYA']

    let matchedKey: string | undefined // Initialize matchedKey as undefined

    for (const node of nodes) {
      const isMatchFound = node.bondProviders.providers.some((provider) =>
        chains.some((chain) =>
          walletAddresses[chain].some((walletAddress) => {
            const networkPrefix = network === 'mainnet' ? '' : 's'
            return (
              (walletAddress.address.startsWith(`${networkPrefix}thor`) ||
                walletAddress.address.startsWith(`${networkPrefix}maya`)) &&
              walletAddress.address === provider.bondAddress
            )
          })
        )
      )

      if (isMatchFound) {
        matchedKey = node.address
        break
      }
    }

    if (matchedKey) {
      setMatchedNodeAddress(matchedKey)
      setExpandedRowKeys([matchedKey])
    } else {
      setMatchedNodeAddress('')
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
