import React, { useCallback, useMemo, useState, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { Network } from '@xchainjs/xchain-client'
import { Address } from '@xchainjs/xchain-util'
import { Form } from 'antd'
import * as FP from 'fp-ts/lib/function'
import * as O from 'fp-ts/lib/Option'
import { useIntl } from 'react-intl'

import { AddressValidation } from '../../services/clients'
import { NodeInfos, NodeInfosRD } from '../../services/thorchain/types'
import { WalletAddressInfo } from '../../views/wallet/BondsView'
import { ErrorView } from '../shared/error'
import { FilterButton, ReloadButton } from '../uielements/button'
import * as Styled from './Bonds.styles'
import { BondsTable } from './table'

type Props = {
  nodes: NodeInfosRD
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
  nodes: nodesRD,
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
  const intl = useIntl()
  const [form] = Form.useForm()
  const prevNodes = useRef<O.Option<NodeInfos>>(O.none)

  const nodes: NodeInfos = useMemo(
    () =>
      FP.pipe(
        nodesRD,
        RD.getOrElse(() => [] as NodeInfos)
      ),
    [nodesRD]
  )

  const addressValidator = useCallback(
    async (_: unknown, value: string) => {
      if (!value) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.empty' }))
      }
      const loweredCaseValue = value.toLowerCase()
      const validAddress = loweredCaseValue.startsWith('t')
        ? addressValidationThor(loweredCaseValue)
        : addressValidationMaya(loweredCaseValue)
      if (!validAddress) {
        return Promise.reject(intl.formatMessage({ id: 'wallet.errors.address.invalid' }))
      }

      if (nodes.findIndex(({ address }) => address.toLowerCase() === loweredCaseValue) > -1) {
        return Promise.reject(intl.formatMessage({ id: 'bonds.validations.nodeAlreadyAdded' }))
      }
    },
    [addressValidationMaya, addressValidationThor, intl, nodes]
  )

  const onSubmit = useCallback(
    ({ address }: { address: string }) => {
      addNode(address, network)
      form.resetFields()
    },
    [addNode, form, network]
  )

  const renderTable = useCallback(
    (nodes: NodeInfos, loading = false) => (
      <BondsTable
        className="border-b-1 mb-[25px] border-solid border-gray1 dark:border-gray1d"
        nodes={nodes}
        watchlist={watchList}
        addWatchlist={addWatchlist}
        removeWatchlist={removeWatchlist}
        removeNode={removeNode}
        goToNode={goToNode}
        goToAction={goToAction}
        network={network}
        walletAddresses={walletAddresses}
        loading={loading}
      />
    ),
    [watchList, addWatchlist, removeWatchlist, removeNode, goToNode, goToAction, network, walletAddresses]
  )
  const filteredNodes = useMemo(() => {
    if (viewMode === BondsViewMode.Watchlist) {
      return nodes
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
    return nodes
  }, [viewMode, nodes, watchList])

  const renderNodeInfos = useMemo(() => {
    const emptyList: NodeInfos = []
    return FP.pipe(
      nodesRD,
      RD.fold(
        () => renderTable(emptyList),
        () => {
          const data = FP.pipe(
            prevNodes.current,
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
          prevNodes.current = O.some(nodes)
          return renderTable(filteredNodes)
        }
      )
    )
  }, [filteredNodes, intl, nodesRD, reloadNodeInfos, renderTable])

  const disableForm = useMemo(() => RD.isPending(nodesRD) || RD.isFailure(nodesRD), [nodesRD])

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
            <Styled.SubmitButton htmlType={'submit'} disabled={disableForm}>
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
      {renderNodeInfos}
    </Styled.Container>
  )
}
