import React, { useCallback, useMemo, useState, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address } from '@xchainjs/xchain-util'
import { Form } from 'antd'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import { AddressValidation } from '../../services/clients'
import { NodeInfos as NodeInfosMaya, NodeInfosRD as NodeInfosMayaRD } from '../../services/mayachain/types'
import { NodeInfos, NodeInfosRD } from '../../services/thorchain/types'
import { useApp } from '../../store/app/hooks'
import { WalletAddressInfo } from '../../views/bonds/types'
import { ErrorView } from '../shared/error'
import { FilterButton, ReloadButton } from '../uielements/button'
import * as Styled from './Bonds.styles'
import { BondsTable } from './table'

type Props = {
  nodesThor: NodeInfosRD
  nodesMaya: NodeInfosMayaRD
  removeNode: (node: Address) => void
  goToNode: (node: Address) => void
  goToAction: (action: string, node: string, walletType: string) => void
  network: Network
  addNode: (node: Address, network: Network) => void
  addWatchlist: (nodeOrBond: Address, network: Network) => void
  removeWatchlist: (bondProviders: Address, network: Network) => void
  addressValidationThor: AddressValidation
  addressValidationMaya: AddressValidation
  reloadNodeInfos: FP.Lazy<void>
  className?: string
  walletAddresses: Record<'THOR' | 'MAYA', WalletAddressInfo[]>
  watchList: string[]
}

enum BondsViewMode {
  All = 'all',
  Watchlist = 'watchlist'
}

export const Bonds: React.FC<Props> = ({
  addressValidationThor,
  addressValidationMaya,
  nodesThor: nodesThorRD,
  nodesMaya: nodesMayaRD,
  removeNode,
  goToNode,
  goToAction,
  network,
  addNode,
  addWatchlist,
  removeWatchlist,
  reloadNodeInfos,
  walletAddresses,
  className,
  watchList
}) => {
  const [viewMode, setViewMode] = useState(BondsViewMode.All)
  const { protocol } = useApp()
  const intl = useIntl()
  const [form] = Form.useForm()
  const prevNodesThor = useRef<O.Option<NodeInfos>>(O.none)
  const prevNodesMaya = useRef<O.Option<NodeInfosMaya>>(O.none)

  const nodesThor: NodeInfos = useMemo(
    () =>
      FP.pipe(
        nodesThorRD,
        RD.getOrElse(() => [] as NodeInfos)
      ),
    [nodesThorRD]
  )

  const nodesMaya: NodeInfosMaya = useMemo(
    () =>
      FP.pipe(
        nodesMayaRD,
        RD.getOrElse(() => [] as NodeInfosMaya)
      ),
    [nodesMayaRD]
  )

  const nodes = protocol === THORChain ? nodesThor : nodesMaya

  const addressValidator = useCallback(
    async (_: unknown, value: string) => {
      if (!value) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.empty' }))
      }
      const loweredCaseValue = value.toLowerCase()
      const validAddress =
        protocol === THORChain ? addressValidationThor(loweredCaseValue) : addressValidationMaya(loweredCaseValue)

      if (!validAddress) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.invalid' }))
      }

      if (nodes.findIndex(({ address }) => address.toLowerCase() === loweredCaseValue) > -1) {
        return Promise.reject(intl.formatMessage({ id: 'bonds.validations.nodeAlreadyAdded' }))
      }
    },
    [addressValidationMaya, addressValidationThor, intl, nodes, protocol]
  )

  const onSubmit = useCallback(
    ({ address }: { address: string }) => {
      addNode(address, network)
      form.resetFields()
    },
    [addNode, form, network]
  )

  const renderTable = useCallback(
    (nodes: NodeInfos, loading = false) => {
      const filteredNodes = nodes.filter((node) => {
        if (protocol === THORChain && node.address.startsWith('t')) return true
        return false
      })
      const filteredWatchlist = watchList.filter((nodeAddy) => {
        if (protocol === THORChain && nodeAddy.startsWith('t')) return true
        return false
      })

      return (
        <BondsTable
          className="border-b-1 mb-[25px] border-solid border-gray1 dark:border-gray1d"
          nodes={filteredNodes}
          protocol={protocol}
          watchlist={filteredWatchlist}
          addWatchlist={addWatchlist}
          removeWatchlist={removeWatchlist}
          removeNode={removeNode}
          goToNode={goToNode}
          goToAction={goToAction}
          network={network}
          walletAddresses={walletAddresses}
          loading={loading}
        />
      )
    },
    [protocol, watchList, addWatchlist, removeWatchlist, removeNode, goToNode, goToAction, network, walletAddresses]
  )

  const renderTableMaya = useCallback(
    (nodes: NodeInfosMaya, loading = false) => {
      const filteredNodes = nodes.filter((node) => {
        if (protocol === MAYAChain && node.address.startsWith('m')) return true

        return false
      })
      const filteredWatchlist = watchList.filter((nodeAddy) => {
        if (protocol === MAYAChain && nodeAddy.startsWith('m')) return true
        return false
      })

      return (
        <BondsTable
          className="border-b-1 mb-[25px] border-solid border-gray1 dark:border-gray1d"
          nodes={filteredNodes}
          protocol={protocol}
          watchlist={filteredWatchlist}
          addWatchlist={addWatchlist}
          removeWatchlist={removeWatchlist}
          removeNode={removeNode}
          goToNode={goToNode}
          goToAction={goToAction}
          network={network}
          walletAddresses={walletAddresses}
          loading={loading}
        />
      )
    },
    [protocol, watchList, addWatchlist, removeWatchlist, removeNode, goToNode, goToAction, network, walletAddresses]
  )
  const filteredNodesMaya = useMemo(() => {
    if (viewMode === BondsViewMode.Watchlist) {
      return nodesMaya
        .map((node) => ({
          ...node,
          bondProviders: {
            ...node.bondProviders,
            providers: node.bondProviders.providers.filter((provider) =>
              watchList.includes(provider.bondAddress.toLowerCase())
            )
          }
        }))
        .filter((node) => node.bondProviders.providers.length > 0) // Keep nodes with at least one matching provider
    }
    return nodesMaya
  }, [viewMode, nodesMaya, watchList])

  const filteredNodesThor = useMemo(() => {
    if (viewMode === BondsViewMode.Watchlist) {
      return nodesThor
        .map((node) => ({
          ...node,
          bondProviders: {
            ...node.bondProviders,
            providers: node.bondProviders.providers.filter((provider) =>
              watchList.includes(provider.bondAddress.toLowerCase())
            )
          }
        }))
        .filter((node) => node.bondProviders.providers.length > 0) // Keep nodes with at least one matching provider
    }
    return nodesThor
  }, [viewMode, nodesThor, watchList])

  const renderNodeInfos = useMemo(() => {
    const emptyList: NodeInfos = []
    return FP.pipe(
      nodesThorRD,
      RD.fold(
        () => renderTable(emptyList),
        () => {
          const data = FP.pipe(
            prevNodesThor.current,
            O.getOrElse(() => emptyList)
          )
          return renderTable(data, true)
        },
        (error) => (
          <ErrorView
            title={intl.formatMessage({ id: 'bonds.nodes.error' })}
            subTitle={(error.message || error.toString()).toUpperCase()}
            extra={<ReloadButton onClick={reloadNodeInfos} label={intl.formatMessage({ id: 'common.reload' })} />}
          />
        ),
        (nodes) => {
          prevNodesThor.current = O.some(nodes)
          return renderTable(filteredNodesThor)
        }
      )
    )
  }, [filteredNodesThor, intl, nodesThorRD, reloadNodeInfos, renderTable])

  const renderNodeInfosMaya = useMemo(() => {
    const emptyList: NodeInfosMaya = []
    return FP.pipe(
      nodesMayaRD,
      RD.fold(
        () => renderTableMaya(emptyList),
        () => {
          const data = FP.pipe(
            prevNodesMaya.current,
            O.getOrElse(() => emptyList)
          )
          return renderTableMaya(data, true)
        },
        (error) => (
          <ErrorView
            title={intl.formatMessage({ id: 'bonds.nodes.error' })}
            subTitle={(error.message || error.toString()).toUpperCase()}
            extra={<ReloadButton onClick={reloadNodeInfos} label={intl.formatMessage({ id: 'common.reload' })} />}
          />
        ),
        (nodes) => {
          prevNodesMaya.current = O.some(nodes)
          return renderTableMaya(filteredNodesMaya)
        }
      )
    )
  }, [filteredNodesMaya, intl, nodesMayaRD, reloadNodeInfos, renderTableMaya])

  const disableForm = useMemo(
    () =>
      protocol === THORChain
        ? RD.isPending(nodesThorRD) || RD.isFailure(nodesThorRD)
        : RD.isPending(nodesMayaRD) || RD.isFailure(nodesMayaRD),
    [nodesMayaRD, nodesThorRD, protocol]
  )

  return (
    <Styled.Container className={className}>
      <Styled.Form onFinish={onSubmit} form={form} disabled={disableForm}>
        <div className="flex w-full flex-row items-center justify-between px-4 pb-2">
          <div className="flex items-center space-x-2">
            <Form.Item className="!m-0" name="address" rules={[{ required: true, validator: addressValidator }]}>
              <Styled.Input
                type="text"
                placeholder={intl.formatMessage({ id: 'bonds.node.enterMessage' })}
                disabled={disableForm}
              />
            </Form.Item>
            <Styled.SubmitButton htmlType="submit" disabled={disableForm}>
              <Styled.AddIcon /> {intl.formatMessage({ id: 'bonds.node.add' })}
            </Styled.SubmitButton>
          </div>
          <div className="flex items-center">
            <FilterButton
              active={viewMode === BondsViewMode.All ? 'true' : 'false'}
              onClick={() => setViewMode(BondsViewMode.All)}>
              {intl.formatMessage({ id: 'common.all' })}
            </FilterButton>
            <FilterButton
              active={viewMode === BondsViewMode.Watchlist ? 'true' : 'false'}
              onClick={() => setViewMode(BondsViewMode.Watchlist)}>
              {intl.formatMessage({ id: 'common.watchlist' })}
            </FilterButton>
          </div>
        </div>
      </Styled.Form>
      {protocol === THORChain ? renderNodeInfos : renderNodeInfosMaya}
    </Styled.Container>
  )
}
