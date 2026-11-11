import { KeyboardEvent, ReactNode, useCallback, useMemo, useState } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid'
import { SortingState } from '@tanstack/react-table'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP } from 'fp-ts'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

import { THORChain } from '../../../../shared/utils/chainIds'
import {
  RunebondUnavailablePanel,
  SegmentedTabs,
  StatusPill,
  StatusPillTone,
  formatBpsAsPercent,
  formatRuneAmount,
  nodeStatusMessageId
} from '../../../components/Bonds/provider'
import { ErrorView } from '../../../components/shared/error'
import { AppColumnDef, Table } from '../../../components/table'
import { BaseButton, FilterButton, FlatButton } from '../../../components/uielements/button'
import { Spin } from '../../../components/uielements/spin'
import { useThorchainContext } from '../../../contexts/ThorchainContext'
import { truncateAddress } from '../../../helpers/addressHelper'
import { ordBaseAmount } from '../../../helpers/fp/ord'
import { logger } from '../../../helpers/logger'
import { hiddenString } from '../../../helpers/stringHelper'
import { useLastSuccessRD } from '../../../hooks/useLastSuccess'
import { RunebondDirectoryNode, useRunebondDirectory } from '../../../hooks/useRunebondDirectory'
import { MyWhitelistRequest, useMyWhitelistRequests } from '../../../hooks/useRunebondListing'
import * as bondsRoutes from '../../../routes/bonds'
import { NodeStatusEnum } from '../../../services/thorchain/types'
import { useApp } from '../../../store/app/hooks'
import { useBondProviderData } from './useBondProviderData'

type SortKey = 'fee' | 'roomLeft'

type Marker = { label: string; tone: StatusPillTone }

const SORTING: Record<SortKey, SortingState> = {
  fee: [{ id: 'fee', desc: false }],
  roomLeft: [{ id: 'roomLeft', desc: true }]
}

const CARD = 'rounded-lg border border-solid border-gray0 bg-bg0 dark:border-gray0d dark:bg-bg0d'
const COL_LABEL = 'font-main-semi-bold text-[11px] tracking-[1px] text-gray2 uppercase dark:text-gray2d'
const VALUE = 'font-main text-[15px] whitespace-nowrap text-text0 dark:text-text0d'
const RED = '!text-error0 dark:!text-error0d'
const initialsOf = ({ name, nodeAddress }: { name: string | null; nodeAddress: Address }) =>
  (name
    ? name
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word[0])
        .join('')
    : nodeAddress.slice(5)
  )
    .slice(0, 2)
    .toUpperCase()

const NodeAvatar = ({
  name,
  nodeAddress,
  logoUrl
}: {
  name: string | null
  nodeAddress: Address
  logoUrl: string | null
}) => {
  const [failed, setFailed] = useState(false)
  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover"
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-turquoise/10 font-main-semi-bold text-[12px] text-turquoise">
      {initialsOf({ name, nodeAddress })}
    </div>
  )
}

export const FindNodeView = (): JSX.Element => {
  const intl = useIntl()
  const navigate = useNavigate()
  const { isPrivate } = useApp()
  const { network, walletInfos } = useBondProviderData()

  const { reloadNodeInfos } = useThorchainContext()
  const directoryRD = useRunebondDirectory()
  const shownDirectoryRD = useLastSuccessRD(directoryRD)

  const walletAddresses = useMemo(() => walletInfos.map(({ address }) => address), [walletInfos])
  const { myRequests } = useMyWhitelistRequests(walletAddresses)

  const [sorting, setSorting] = useState<SortingState>(SORTING.fee)
  const sort: SortKey | undefined =
    sorting[0]?.id === 'fee' || sorting[0]?.id === 'roomLeft' ? sorting[0].id : undefined
  const [hasRoom, setHasRoom] = useState(false)
  const [activeOnly, setActiveOnly] = useState(false)

  const goBack = useCallback(() => navigate(bondsRoutes.base.path()), [navigate])
  const openNode = useCallback((nodeAddress: Address) => navigate(bondsRoutes.node.path({ nodeAddress })), [navigate])
  const clearFilters = useCallback(() => {
    setHasRoom(false)
    setActiveOnly(false)
  }, [])

  const markerOf = useMemo(() => {
    const own = new Set(walletAddresses.map((address) => address.toLowerCase()))
    const requestByNode = new Map<string, MyWhitelistRequest>()
    myRequests.forEach((request) => {
      const key = request.nodeAddress.toLowerCase()
      if (!requestByNode.has(key)) requestByNode.set(key, request)
    })
    return ({ node }: RunebondDirectoryNode): Marker | null => {
      if (own.has(node.nodeOperatorAddress.toLowerCase())) {
        return { label: intl.formatMessage({ id: 'bonds.directory.marker.yourNode' }), tone: 'accent' }
      }
      const mine = node.bondProviders.providers.filter(({ bondAddress }) => own.has(bondAddress.toLowerCase()))
      if (mine.some(({ bond }) => bond.gt(0))) {
        return { label: intl.formatMessage({ id: 'bonds.directory.marker.bonded' }), tone: 'accent' }
      }
      if (mine.length > 0) {
        return { label: intl.formatMessage({ id: 'bonds.status.whitelisted' }), tone: 'success' }
      }
      const request = requestByNode.get(node.address.toLowerCase())
      if (request?.status === 'sent') {
        return { label: intl.formatMessage({ id: 'bonds.directory.marker.requested' }), tone: 'accent' }
      }
      if (request?.status === 'pending') {
        return {
          label: intl.formatMessage({ id: 'bonds.directory.marker.requested' }),
          tone: 'warning'
        }
      }
      return null
    }
  }, [intl, myRequests, walletAddresses])

  const amount = (value: BaseAmount) => (isPrivate ? hiddenString : `ᚱ${formatRuneAmount(value)}`)

  const renderNodeCell = ({ listing, node }: RunebondDirectoryNode) => {
    const profileLabel = intl.formatMessage({ id: 'bonds.directory.openProfile' })
    const { profileUrl } = listing
    return (
      <div className="flex min-w-0 items-center gap-3">
        <NodeAvatar name={listing.name} nodeAddress={node.address} logoUrl={listing.logoUrl} />
        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-main text-[15px] text-text0 group-hover:text-turquoise dark:text-text0d">
              {listing.name ?? truncateAddress(node.address, THORChain, network)}
            </span>
            {profileUrl && (
              <button
                type="button"
                title={profileLabel}
                aria-label={profileLabel}
                className="flex shrink-0 cursor-pointer text-gray1 hover:text-turquoise dark:text-gray1d"
                onClick={(event) => {
                  event.stopPropagation()
                  window.apiUrl.openExternal(profileUrl).catch((error) => logger.warn(error))
                }}>
                <ArrowTopRightOnSquareIcon className="h-3 w-3" />
              </button>
            )}
          </div>
          {listing.name && (
            <span className="truncate font-mono text-[12px] text-gray1 dark:text-gray1d">
              {truncateAddress(node.address, THORChain, network)}
            </span>
          )}
        </div>
      </div>
    )
  }

  const renderStatus = (status: NodeStatusEnum) => (
    <div className="flex items-center gap-[7px] font-main text-[13px] whitespace-nowrap text-text2 dark:text-text2d">
      <span
        className={clsx(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          status === NodeStatusEnum.Active ? 'bg-success' : 'bg-gray1 dark:bg-gray1d'
        )}
      />
      {intl.formatMessage({ id: nodeStatusMessageId(status) })}
    </div>
  )

  const rowProps = (nodeAddress: Address) => ({
    role: 'button',
    tabIndex: 0,
    onClick: () => openNode(nodeAddress),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        openNode(nodeAddress)
      }
    }
  })

  const columns: AppColumnDef<RunebondDirectoryNode>[] = [
    {
      id: 'node',
      header: intl.formatMessage({ id: 'bonds.directory.col.node' }),
      size: 280,
      enableSorting: false,
      cell: ({ row }) => <div className="px-2 text-left normal-case">{renderNodeCell(row.original)}</div>
    },
    {
      id: 'status',
      header: intl.formatMessage({ id: 'bonds.directory.col.status' }),
      enableSorting: false,
      cell: ({ row }) => <div className="flex justify-center normal-case">{renderStatus(row.original.node.status)}</div>
    },
    {
      id: 'fee',
      header: intl.formatMessage({ id: 'bonds.directory.col.fee' }),
      accessorFn: ({ listing }) => listing.feeBps,
      sortFn: 'basic',
      cell: ({ row }) => <span className={VALUE}>{formatBpsAsPercent(row.original.listing.feeBps, intl.locale)}</span>
    },
    {
      id: 'minBond',
      header: intl.formatMessage({ id: 'bonds.directory.col.minBond' }),
      enableSorting: false,
      cell: ({ row }) => <span className={VALUE}>{amount(row.original.listing.minBond)}</span>
    },
    {
      id: 'roomLeft',
      header: intl.formatMessage({ id: 'bonds.directory.col.roomLeft' }),
      sortFn: (rowA, rowB) => ordBaseAmount.compare(rowA.original.roomLeft, rowB.original.roomLeft),
      cell: ({ row }) => (
        <span className={clsx(VALUE, row.original.roomLeft.lte(0) && RED)}>{amount(row.original.roomLeft)}</span>
      )
    },
    {
      id: 'providers',
      header: intl.formatMessage({ id: 'bonds.directory.col.providers' }),
      enableSorting: false,
      cell: ({ row }) => {
        const { providersCount, maxProviders } = row.original
        return (
          <span className={clsx(VALUE, providersCount >= maxProviders && RED)}>
            {providersCount} / {maxProviders}
          </span>
        )
      }
    },
    {
      id: 'you',
      header: intl.formatMessage({ id: 'bonds.directory.col.you' }),
      size: 200,
      enableSorting: false,
      cell: ({ row }) => {
        const marker = markerOf(row.original)
        return marker ? (
          <StatusPill tone={marker.tone}>{marker.label}</StatusPill>
        ) : (
          <span className="text-gray1 dark:text-gray1d">—</span>
        )
      }
    }
  ]

  const renderTable = (rows: RunebondDirectoryNode[]) => (
    <div className="mt-[18px] hidden xl:block">
      <Table
        data={rows}
        columns={columns}
        sorting={sorting}
        onSortingChange={setSorting}
        hideVerticalBorder
        onClickRow={({ node }) => openNode(node.address)}
      />
      <div className="mt-3.5 font-main text-[12px] text-gray1 dark:text-gray1d">
        {intl.formatMessage({ id: 'bonds.directory.footer' })}
      </div>
    </div>
  )

  const renderTerm = (label: string, value: string, warn = false) => (
    <div className="flex min-w-0 flex-col">
      <span className={COL_LABEL}>{label}</span>
      <span className={clsx(VALUE, 'mt-[3px]', warn && RED)}>{value}</span>
    </div>
  )

  const renderCards = (rows: RunebondDirectoryNode[]) => (
    <div className="mt-[18px] xl:hidden">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
        {rows.map((row) => {
          const { listing, node, roomLeft, providersCount, maxProviders } = row
          const marker = markerOf(row)
          return (
            <div
              key={node.address}
              {...rowProps(node.address)}
              className={clsx(
                CARD,
                'group flex cursor-pointer flex-col px-[22px] py-5 transition-colors hover:border-turquoise focus-visible:border-turquoise focus-visible:outline-none dark:hover:border-turquoise'
              )}>
              <div className="flex items-center justify-between gap-2.5">
                {renderNodeCell(row)}
                {renderStatus(node.status)}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-bg2 px-3.5 py-3 dark:bg-bg2d/40">
                {renderTerm(
                  intl.formatMessage({ id: 'bonds.directory.col.fee' }),
                  formatBpsAsPercent(listing.feeBps, intl.locale)
                )}
                {renderTerm(intl.formatMessage({ id: 'bonds.directory.col.minBond' }), amount(listing.minBond))}
                {renderTerm(
                  intl.formatMessage({ id: 'bonds.directory.col.roomLeft' }),
                  amount(roomLeft),
                  roomLeft.lte(0)
                )}
                {renderTerm(
                  intl.formatMessage({ id: 'bonds.directory.col.providers' }),
                  `${providersCount} / ${maxProviders}`,
                  providersCount >= maxProviders
                )}
              </div>
              {marker && (
                <div className="mt-3">
                  <StatusPill tone={marker.tone}>{marker.label}</StatusPill>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-3.5 font-main text-[12px] text-gray1 dark:text-gray1d">
        {intl.formatMessage({ id: 'bonds.directory.footer' })}
      </div>
    </div>
  )

  const renderHeader = (count?: string, controls?: ReactNode) => (
    <div className="mt-4 flex w-full flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col">
        <span className="font-main text-[28px] leading-tight text-text0 dark:text-text0d">
          {intl.formatMessage({ id: 'bonds.directory.title' })}
        </span>
        {count && <span className="mt-0.5 font-main text-[14px] text-gray2 dark:text-gray2d">{count}</span>}
      </div>
      {controls}
    </div>
  )

  const renderDirectory = (all: RunebondDirectoryNode[]) => {
    const rows = all
      .filter(
        ({ node, roomLeft, providersCount, maxProviders }) =>
          (!hasRoom || (roomLeft.gt(0) && providersCount < maxProviders)) &&
          (!activeOnly || node.status === NodeStatusEnum.Active)
      )
      .sort(
        (a, b) =>
          (sort === 'fee'
            ? a.listing.feeBps - b.listing.feeBps
            : sort === 'roomLeft'
              ? ordBaseAmount.compare(a.roomLeft, b.roomLeft)
              : 0) * (sorting[0]?.desc ? -1 : 1)
      )

    return (
      <>
        {renderHeader(
          intl.formatMessage({ id: 'bonds.directory.count' }, { shown: rows.length, total: all.length }),
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center rounded-full bg-bg0 p-1 dark:bg-bg0d">
              <span className="pr-2 pl-3 font-main-semi-bold text-[10px] tracking-[1px] text-gray1 uppercase dark:text-gray1d">
                {intl.formatMessage({ id: 'bonds.directory.sort' })}
              </span>
              <SegmentedTabs<SortKey | ''>
                options={[
                  { label: intl.formatMessage({ id: 'bonds.directory.sort.fee' }), value: 'fee' },
                  { label: intl.formatMessage({ id: 'bonds.directory.sort.roomLeft' }), value: 'roomLeft' }
                ]}
                value={sort ?? ''}
                onChange={(key) => key && setSorting(SORTING[key])}
              />
            </div>
            <FilterButton active={hasRoom} onClick={() => setHasRoom((value) => !value)}>
              {intl.formatMessage({ id: 'bonds.directory.filter.hasRoom' })}
            </FilterButton>
            <FilterButton active={activeOnly} onClick={() => setActiveOnly((value) => !value)}>
              {intl.formatMessage({ id: 'bonds.directory.filter.activeOnly' })}
            </FilterButton>
          </div>
        )}
        {rows.length === 0 ? (
          <div className={`mt-[18px] flex flex-col items-center px-6 py-[50px] text-center ${CARD}`}>
            <span className="font-main text-[15px] text-text2 dark:text-text2d">
              {intl.formatMessage({ id: 'bonds.directory.empty' })}
            </span>
            {(hasRoom || activeOnly) && (
              <BaseButton
                className="mt-2.5 !p-0 font-main-semi-bold text-[12px] tracking-[1px] text-turquoise"
                onClick={clearFilters}>
                {intl.formatMessage({ id: 'bonds.directory.clearFilters' })}
              </BaseButton>
            )}
          </div>
        ) : (
          <>
            {renderTable(rows)}
            {renderCards(rows)}
          </>
        )}
      </>
    )
  }

  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full items-center">
        <BaseButton className="group !p-0 font-main-semi-bold text-[14px] text-turquoise uppercase" onClick={goBack}>
          <ArrowLeftIcon className="mr-1 h-[16px] w-[16px] text-inherit transition-transform group-hover:-translate-x-[2px]" />
          {intl.formatMessage({ id: 'bonds.provider.detail.back' })}
        </BaseButton>
      </div>
      {FP.pipe(
        shownDirectoryRD,
        RD.fold(
          () => <Spin className="m-auto mt-10" />,
          () => <Spin className="m-auto mt-10" />,
          ({ source, error }) =>
            source === 'thornode' ? (
              <ErrorView
                className="mt-10"
                title={intl.formatMessage({ id: 'bonds.nodes.error' })}
                subTitle={error.message}
                extra={<FlatButton onClick={reloadNodeInfos}>{intl.formatMessage({ id: 'common.retry' })}</FlatButton>}
              />
            ) : (
              <>
                {renderHeader()}
                <RunebondUnavailablePanel
                  className="mt-[18px] min-h-[280px]"
                  message={intl.formatMessage({ id: 'bonds.directory.unavailable' })}
                />
              </>
            ),
          renderDirectory
        )
      )}
    </div>
  )
}
