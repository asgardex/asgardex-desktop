import { useCallback, useMemo, useState, useRef } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { PlusIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'
import { MAYAChain } from '@xchainjs/xchain-mayachain'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { Address } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useForm } from 'react-hook-form'
import { useIntl } from 'react-intl'

import { ExtendedNodeInfoThor } from '../../hooks/useNodeInfos'
import { ExtendedNodeInfoMaya } from '../../hooks/useNodeInfosMaya'
import { AddressValidation } from '../../services/clients'
import { NodeInfos as NodeInfosMaya } from '../../services/mayachain/types'
import { NodeInfos } from '../../services/thorchain/types'
import { useApp } from '../../store/app/hooks'
import { WalletAddressInfo } from '../../views/bonds/types'
import { ErrorView } from '../shared/error'
import { Button, FilterButton, ReloadButton } from '../uielements/button'
import { Input } from '../uielements/input'
import { BondsTable } from './table'

type Props = {
  nodesThor: RD.RemoteData<Error, ExtendedNodeInfoThor[]>
  nodesMaya: RD.RemoteData<Error, ExtendedNodeInfoMaya[]>
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

type FormValues = {
  address: string
}

export const Bonds = ({
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
}: Props) => {
  const [viewMode, setViewMode] = useState(BondsViewMode.All)
  const { protocol } = useApp()
  const intl = useIntl()

  // Initialize react-hook-form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormValues>({
    defaultValues: {
      address: ''
    }
  })

  const prevNodesThor = useRef<O.Option<ExtendedNodeInfoThor[]>>(O.none)
  const prevNodesMaya = useRef<O.Option<ExtendedNodeInfoMaya[]>>(O.none)

  const nodesThor: ExtendedNodeInfoThor[] = useMemo(
    () =>
      FP.pipe(
        nodesThorRD,
        RD.getOrElse(() => [] as ExtendedNodeInfoThor[])
      ),
    [nodesThorRD]
  )

  const nodesMaya: ExtendedNodeInfoMaya[] = useMemo(
    () =>
      FP.pipe(
        nodesMayaRD,
        RD.getOrElse(() => [] as ExtendedNodeInfoMaya[])
      ),
    [nodesMayaRD]
  )

  const nodes = protocol === THORChain ? nodesThor : nodesMaya

  // Validation function for react-hook-form
  const addressValidator = useCallback(
    (value: string) => {
      if (!value) {
        return intl.formatMessage({ id: 'wallet.errors.address.empty' })
      }
      const loweredCaseValue = value.toLowerCase()
      const validAddress =
        protocol === THORChain ? addressValidationThor(loweredCaseValue) : addressValidationMaya(loweredCaseValue)

      if (!validAddress) {
        return intl.formatMessage({ id: 'wallet.errors.address.invalid' })
      }

      if (
        nodes.findIndex(
          ({ address, isUserStoredNodeAddress }) =>
            address.toLowerCase() === loweredCaseValue && isUserStoredNodeAddress
        ) > -1
      ) {
        return intl.formatMessage({ id: 'bonds.validations.nodeAlreadyAdded' })
      }

      return true
    },
    [addressValidationMaya, addressValidationThor, intl, nodes, protocol]
  )

  const onSubmit = useCallback(
    ({ address }: FormValues) => {
      addNode(address, network)
      reset()
    },
    [addNode, network, reset]
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
    const emptyList: ExtendedNodeInfoThor[] = []
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
    const emptyList: ExtendedNodeInfoMaya[] = []
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
    <div className={clsx('bg-bg0 dark:bg-bg0d', className)}>
      <form className="flex items-center" onSubmit={handleSubmit(onSubmit)}>
        <div className="flex w-full flex-row items-center justify-between px-4 pb-2">
          <div className="flex items-start space-x-2">
            <div className="flex flex-col">
              <Input
                className="border border-solid border-gray0 dark:border-gray0d"
                uppercase={false}
                type="text"
                placeholder={intl.formatMessage({ id: 'bonds.node.enterMessage' })}
                {...register('address', {
                  required: true,
                  validate: addressValidator
                })}
                error={!!errors.address}
                disabled={disableForm}
              />
              {errors.address && (
                <span className="text-error0 dark:text-error0d text-xs mt-1">{errors.address.message}</span>
              )}
            </div>
            <Button className="space-x-1" htmlType="submit" disabled={disableForm} typevalue="transparent">
              <PlusIcon className="bg-turquoise rounded-full w-4 h-4 stroke-text3 dark:stroke-text3d" />
              {intl.formatMessage({ id: 'bonds.node.add' })}
            </Button>
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
      </form>
      {protocol === THORChain ? renderNodeInfos : renderNodeInfosMaya}
    </div>
  )
}
