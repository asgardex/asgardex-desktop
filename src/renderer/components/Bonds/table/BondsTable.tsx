import React, { useMemo, useState } from 'react'

import { Network } from '@xchainjs/xchain-client'
import { Address } from '@xchainjs/xchain-util'
import { ColumnType } from 'antd/lib/table'
import * as FP from 'fp-ts/function'
import * as O from 'fp-ts/Option'
import { FormattedMessage, useIntl } from 'react-intl'

import { NodeInfo, NodeInfos, Providers } from '../../../services/thorchain/types'
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
  goToAction: (action: string) => void
  network: Network
  className?: string
  walletAddresses: Record<'THOR' | 'MAYA', WalletAddressInfo[]>
}

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

  const nodeColumn: ColumnType<NodeInfo> = useMemo(
    () => ({
      key: 'node',
      render: (_, { address }) => <H.NodeAddress network={network} address={address} />,
      title: intl.formatMessage({ id: 'bonds.node' }),
      align: 'left'
    }),
    [network, intl]
  )
  const walletColumn: ColumnType<NodeInfo> = useMemo(
    () => ({
      key: 'walletType',
      width: 150,
      title: intl.formatMessage({ id: 'common.owner' }),
      render: (data) => {
        let walletTypeLabel = 'Not a wallet address'

        const searchWalletAddresses = (addresses: WalletAddressInfo[], chainLabel: string) => {
          const match = addresses.find((addr) => addr.address === data.address)
          if (match) {
            walletTypeLabel = `${match.walletType} (${chainLabel})`
          }
        }

        // Search THOR and MAYA addresses
        searchWalletAddresses(walletAddresses.THOR, 'THOR')
        searchWalletAddresses(walletAddresses.MAYA, 'MAYA')

        return (
          <div className="text-sm text-text2 dark:text-text2d">
            <Styled.WalletTypeLabel>{walletTypeLabel}</Styled.WalletTypeLabel>
          </div>
        )
      },
      align: 'right'
    }),
    // Ensure the dependency array is updated to reflect the new structure of walletAddresses
    [intl, walletAddresses]
  )

  const bondColumn: ColumnType<NodeInfo> = useMemo(
    () => ({
      key: 'bond',
      width: 150,
      title: intl.formatMessage({ id: 'bonds.bond' }),
      render: (_, data) => <H.BondValue data={data} />,
      align: 'right'
    }),
    [intl]
  )

  const awardColumn: ColumnType<NodeInfo> = useMemo(
    () => ({
      key: 'award',
      width: 150,
      title: intl.formatMessage({ id: 'bonds.award' }),
      align: 'right',
      render: (_, data) => <H.AwardValue data={data} />
    }),
    [intl]
  )
  const statusColumn: ColumnType<NodeInfo> = useMemo(
    () => ({
      key: 'status',
      width: 100,
      title: intl.formatMessage({ id: 'bonds.status' }),
      render: (_, data) => <H.Status data={data} />,
      responsive: ['sm'],
      align: 'center'
    }),
    [intl]
  )
  const infoColumn: ColumnType<NodeInfo> = useMemo(
    () => ({
      key: 'info',
      width: 40,
      title: '',
      render: (_, { address }) => <ExternalLinkIcon onClick={() => goToNode(address)} />,
      responsive: ['md'],
      align: 'center'
    }),
    [goToNode]
  )
  const actionColumn: ColumnType<NodeInfo> = useMemo(
    () => ({
      key: 'actions',
      width: 100, // Adjusted width to accommodate two buttons
      title: intl.formatMessage({ id: 'common.action' }),
      render: (_, { address }) => {
        // Check if the current node's address matches any wallet address
        const isWalletAddress =
          walletAddresses.THOR.some((walletInfo) => walletInfo.address === address) ||
          walletAddresses.MAYA.some((walletInfo) => walletInfo.address === address)

        return (
          <div className="flex-col items-center">
            <TextButton disabled={!isWalletAddress} size="normal" onClick={() => goToAction('bond')}>
              {intl.formatMessage({ id: 'deposit.interact.actions.bond' })}
            </TextButton>
            <div className="flex border-solid border-gray1 dark:border-gray1d">
              <TextButton disabled={!isWalletAddress} size="normal" onClick={() => goToAction('unbond')}>
                {intl.formatMessage({ id: 'deposit.interact.actions.unbond' })}
              </TextButton>
            </div>
          </div>
        )
      },
      responsive: ['md'],
      align: 'center'
    }),
    [goToAction, intl, walletAddresses] // Ensure walletAddresses is included in dependencies
  )

  const [nodeToRemove, setNodeToRemove] = useState<O.Option<Address>>(O.none)

  const removeColumn: ColumnType<NodeInfo> = useMemo(
    () => ({
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
    }),
    [setNodeToRemove]
  )

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

  return (
    <>
      <Styled.Table
        className={className}
        columns={[
          removeColumn,
          nodeColumn,
          actionColumn,
          walletColumn,
          bondColumn,
          awardColumn,
          statusColumn,
          infoColumn
        ]}
        dataSource={nodes.map((node) => ({ ...node, key: node.address }))}
        loading={loading}
        expandedRowRender={(record) => {
          return (
            <Styled.Table
              columns={[
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
                  render: (_, { address }) => {
                    // Check if the current bond_providers address matches any wallet address
                    const isWalletAddress =
                      walletAddresses.THOR.some((walletInfo) => walletInfo.address === address) ||
                      walletAddresses.MAYA.some((walletInfo) => walletInfo.address === address)

                    return (
                      <div className="flex-col items-center">
                        <TextButton disabled={!isWalletAddress} size="normal" onClick={() => goToAction('bond')}>
                          {intl.formatMessage({ id: 'deposit.interact.actions.bond' })}
                        </TextButton>
                        <div className="flex border-solid border-gray1 dark:border-gray1d">
                          <TextButton disabled={!isWalletAddress} size="normal" onClick={() => goToAction('unbond')}>
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
                }
              ]}
              dataSource={record.bondProviders.providers.map((provider: Providers, index: string) => ({
                key: index,
                bondAddress: provider.bondAddress,
                action: provider.bondAddress,
                bond: provider.bond
              }))}
              pagination={false}
            />
          )
        }}
      />
      <ConfirmationModal {...removeConfirmationProps} />
    </>
  )
}
