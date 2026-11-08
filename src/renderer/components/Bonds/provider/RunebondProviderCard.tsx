import { ReactNode } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { InformationCircleIcon } from '@heroicons/react/20/solid'
import { Network } from '@xchainjs/xchain-client'
import { BaseAmount } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { ZERO_BASE_AMOUNT } from '../../../const'
import { hiddenString } from '../../../helpers/stringHelper'
import { useLastSuccess } from '../../../hooks/useLastSuccess'
import { MyWhitelistRequest } from '../../../hooks/useRunebondListing'
import { NodeListing, NodeListingRD, RUNEBOND_URL } from '../../../services/runebond'
import { NodeInfo } from '../../../services/thorchain/types'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { FlatButton } from '../../uielements/button'
import { Tooltip } from '../../uielements/tooltip'
import {
  RUNEBOND_DEFAULT_TARGET_TOTAL_BOND,
  RunebondRequestBlock,
  formatBpsAsPercent,
  formatChurnDate,
  formatRuneAmount,
  runebondDaysLeft,
  runebondRequestBlock,
  runebondRoomLeft
} from './helpers'
import { RunebondRefreshButton } from './RunebondRefreshButton'
import { StatusPill, StatusPillTone } from './StatusPill'

type ProviderState = 'yourNode' | 'sent' | 'pending' | 'listed' | 'notListed'

const PILL_TONE: Record<ProviderState, StatusPillTone> = {
  yourNode: 'accent',
  sent: 'accent',
  pending: 'warning',
  listed: 'accent',
  notListed: 'neutral'
}

type Props = {
  network: Network
  isPrivate: boolean
  listingRD: NodeListingRD
  hidden: boolean
  node: NodeInfo
  maxProviders: number
  isOperator: boolean
  request: O.Option<MyWhitelistRequest>
  refreshing?: boolean
  onRequest: () => void
  className?: string
}

const Kicker = ({ children }: { children: ReactNode }) => (
  <span className="font-main-semi-bold text-[11px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
    {children}
  </span>
)

const isLeftNetwork = (listing: NodeListing) => listing.listing?.delistReason === 'removed'

export const RunebondProviderCard = ({
  network,
  isPrivate,
  listingRD,
  hidden,
  node,
  maxProviders,
  isOperator,
  request,
  refreshing = false,
  onRequest,
  className
}: Props) => {
  const intl = useIntl()
  const aboutRunebond = intl.formatMessage({ id: 'bonds.runebond.provider.about' })

  const listing = O.toNullable(useLastSuccess(listingRD, undefined, { resetOnFailure: true }))
  const failed = RD.isFailure(listingRD) && listing === null

  const providersCount = node.bondProviders.providers.length
  const listed = (listing?.listed ?? false) && !hidden
  const details = listing && (listed || isLeftNetwork(listing)) ? listing.listing : null
  const roomLeft = details ? runebondRoomLeft(details.targetTotalBond, node.bond) : null

  const block: O.Option<RunebondRequestBlock> =
    isOperator || listing
      ? runebondRequestBlock({
          isOperator,
          listed,
          leftNetwork: listing ? isLeftNetwork(listing) : false,
          roomLeft: roomLeft ?? ZERO_BASE_AMOUNT,
          providersCount,
          maxProviders
        })
      : O.none

  const state: ProviderState | null = (() => {
    if (isOperator) return 'yourNode'
    if (O.isSome(request)) return request.value.status
    if (listing === null) return null
    return FP.pipe(
      block,
      O.exists((reason) => reason === 'notListed')
    )
      ? 'notListed'
      : 'listed'
  })()

  const formatAmount = (value: BaseAmount) => (isPrivate ? hiddenString : formatRuneAmount(value))

  const lines: { line: string; sub?: string } | null = (() => {
    switch (state) {
      case 'sent':
      case 'pending':
        return FP.pipe(
          request,
          O.fold(
            () => null,
            ({ intendedBond, date, expiresDate }) => {
              const amount = formatAmount(intendedBond)
              if (state === 'sent') {
                return {
                  line: intl.formatMessage({ id: 'bonds.runebond.provider.sent.line' }),
                  sub: intl.formatMessage({ id: 'bonds.runebond.provider.sent.sub' }, { amount })
                }
              }
              return {
                line: intl.formatMessage({ id: 'bonds.runebond.provider.pending.line' }, { amount }),
                sub: expiresDate
                  ? intl.formatMessage(
                      { id: 'bonds.runebond.provider.pending.sub' },
                      { date: formatChurnDate(date, intl.locale), count: runebondDaysLeft(expiresDate) }
                    )
                  : intl.formatMessage(
                      { id: 'bonds.provider.pendingRequests.requested' },
                      { date: formatChurnDate(date, intl.locale) }
                    )
              }
            }
          )
        )
      default:
        return null
    }
  })()

  const amount = (value: BaseAmount | null, className?: string) => (
    <span
      className={clsx(
        'flex items-center gap-2 font-main-semi-bold text-[18px] leading-tight',
        className ?? 'text-text0 dark:text-text0d'
      )}>
      <AssetIcon asset={AssetRuneNative} size="xsmall" network={network} />
      {value === null ? '—' : isPrivate ? hiddenString : formatRuneAmount(value)}
    </span>
  )

  const renderTag = () => {
    if (state === null) return null
    return (
      <StatusPill tone={PILL_TONE[state]} pulse={state === 'sent'}>
        {intl.formatMessage({ id: `bonds.runebond.provider.state.${state}` })}
      </StatusPill>
    )
  }

  const renderTerms = () => {
    if (failed) {
      return (
        <span className="mt-4 font-main text-[13px] leading-relaxed text-gray2 dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.runebond.provider.unavailable' })}
        </span>
      )
    }
    if (listing === null) {
      return (
        <div className="mt-5 flex flex-col gap-3">
          <div className="h-[14px] w-full animate-pulse rounded bg-gray0 dark:bg-gray0d" />
          <div className="h-[14px] w-3/4 animate-pulse rounded bg-gray0 dark:bg-gray0d" />
        </div>
      )
    }
    const noRoom = roomLeft !== null && roomLeft.lte(0)
    return (
      <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-6 gap-y-4 rounded-lg bg-bg2 p-4 dark:bg-bg2d">
        <div className="flex flex-col gap-1.5">
          <Kicker>{intl.formatMessage({ id: 'bonds.runebond.listing.minBond' })}</Kicker>
          {amount(details?.minBond ?? null)}
        </div>
        <div className="flex flex-col gap-1.5">
          <Kicker>{intl.formatMessage({ id: 'bonds.runebond.listing.targetBond' })}</Kicker>
          {amount(details ? (details.targetTotalBond ?? RUNEBOND_DEFAULT_TARGET_TOTAL_BOND) : null)}
        </div>
        <div className="flex flex-col gap-1.5">
          <Kicker>{intl.formatMessage({ id: 'bonds.runebond.listing.fee' })}</Kicker>
          <span className="font-main-semi-bold text-[18px] leading-tight text-text0 dark:text-text0d">
            {details ? formatBpsAsPercent(details.feeBps, intl.locale) : '—'}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Kicker>{intl.formatMessage({ id: 'bonds.runebond.provider.roomLeft' })}</Kicker>
          {amount(roomLeft, noRoom ? 'text-error0 dark:text-error0d' : undefined)}
        </div>
      </div>
    )
  }

  const renderPrimary = () => {
    switch (state) {
      case 'sent':
      case 'pending':
        return (
          <span className="font-main text-[13px] text-gray2 dark:text-gray2d">
            {intl.formatMessage({ id: `bonds.runebond.provider.${state}.note` })}
          </span>
        )
      case 'yourNode':
      case 'listed':
      case 'notListed': {
        const label = intl.formatMessage({ id: 'bonds.runebond.provider.requestSlot' })
        return FP.pipe(
          block,
          O.fold(
            () => (
              <FlatButton size="normal" onClick={onRequest}>
                {label}
              </FlatButton>
            ),
            (reason) => (
              <Tooltip
                size="big"
                title={intl.formatMessage({ id: `bonds.runebond.provider.blocked.${reason}` }, { max: maxProviders })}>
                <FlatButton size="normal" disabled>
                  {label}
                </FlatButton>
              </Tooltip>
            )
          )
        )
      }
      default:
        return null
    }
  }

  return (
    <div
      className={clsx(
        'flex flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d',
        className
      )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.runebond.provider.title' })}
          <Tooltip size="big" title={aboutRunebond}>
            <button
              type="button"
              aria-label={aboutRunebond}
              onClick={() => window.apiUrl.openExternal(RUNEBOND_URL)}
              className="flex cursor-pointer items-center justify-center rounded-sm text-gray2 transition-colors hover:text-turquoise focus-visible:text-turquoise focus-visible:outline focus-visible:outline-1 focus-visible:outline-turquoise dark:text-gray2d">
              <InformationCircleIcon className="h-4 w-4" />
            </button>
          </Tooltip>
          <RunebondRefreshButton loading={refreshing} />
        </div>
        {renderTag()}
      </div>
      <div className="mb-5 flex flex-col">
        {lines && (
          <>
            <span className="mt-4 font-main text-[15px] text-text0 dark:text-text0d">{lines.line}</span>
            {lines.sub && (
              <span className="mt-1 font-main text-[13px] leading-relaxed text-gray2 dark:text-gray2d">
                {lines.sub}
              </span>
            )}
          </>
        )}
        {renderTerms()}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-solid border-gray0 pt-5 dark:border-gray0d">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">{renderPrimary()}</div>
        <span className="font-main text-[13px] whitespace-nowrap text-gray2 dark:text-gray2d">
          {intl.formatMessage(
            { id: 'bonds.runebond.provider.providers' },
            { count: providersCount, max: maxProviders }
          )}
        </span>
      </div>
    </div>
  )
}
