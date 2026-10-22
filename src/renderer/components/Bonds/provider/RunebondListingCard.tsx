import { ReactNode } from 'react'

import * as RD from '@devexperts/remote-data-ts'
import { InformationCircleIcon } from '@heroicons/react/20/solid'
import { Network } from '@xchainjs/xchain-client'
import { Address, BaseAmount } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { THORChain } from '../../../../shared/utils/chainIds'
import { truncateAddress } from '../../../helpers/addressHelper'
import { hiddenString } from '../../../helpers/stringHelper'
import { useLastSuccess } from '../../../hooks/useLastSuccess'
import { NodeListing, NodeListingRD, OperatorFinderFeeVault, RUNEBOND_URL } from '../../../services/runebond'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { BaseButton, BorderButton, FlatButton } from '../../uielements/button'
import { Tooltip } from '../../uielements/tooltip'
import { canTopUpVault, formatBpsAsPercent, formatChurnDate, formatRuneAmount, isVaultDepleted } from './helpers'
import { RunebondRefreshButton } from './RunebondRefreshButton'
import { RunebondVaultOnBehalfDetails } from './RunebondVaultOnBehalfNotice'
import { VAULT_LEVEL_TEXT_CLASS } from './RunebondVaultTopUpModal'

const RUNEBOND_PRICING_DOCS_URL = 'https://runebond.com/docs/runebond-finder-fee-vault/'

type ListingState = 'listed' | 'notListed' | 'delisted' | 'vaultDepleted' | 'removed' | 'previousOperator'

const listingState = ({ listed, listing }: NodeListing, operatorAddress: Address): ListingState => {
  const listedByPreviousOperator =
    listing !== null &&
    listing.delistReason !== 'removed' &&
    listing.operatorAddress.toLowerCase() !== operatorAddress.toLowerCase()
  if (listedByPreviousOperator) return 'previousOperator'
  if (listed) return 'listed'
  if (!listing?.delisted) return 'notListed'
  if (listing.delistReason === 'vault_depleted') return 'vaultDepleted'
  if (listing.delistReason === 'removed') return 'removed'
  return 'delisted'
}

type PillStyle = { pill: string; dot: string }

const NEUTRAL_PILL: PillStyle = {
  pill: 'bg-gray2/10 text-gray2 dark:bg-gray2d/15 dark:text-gray2d',
  dot: 'bg-gray2 dark:bg-gray2d'
}

const PILL_CLASS: Record<ListingState, PillStyle> = {
  listed: { pill: 'bg-turquoise/10 text-turquoise', dot: 'bg-turquoise' },
  notListed: NEUTRAL_PILL,
  delisted: NEUTRAL_PILL,
  vaultDepleted: {
    pill: 'bg-warning0/10 text-warning0 dark:bg-warning0d/10 dark:text-warning0d',
    dot: 'bg-warning0 dark:bg-warning0d'
  },
  removed: NEUTRAL_PILL,
  previousOperator: NEUTRAL_PILL
}

type Props = {
  network: Network
  isPrivate: boolean
  listingRD: NodeListingRD
  operatorAddress: Address
  canOperate: boolean
  awaiting?: boolean
  refreshing?: boolean
  vault?: OperatorFinderFeeVault
  vaultTopUpReceived?: boolean
  onList: () => void
  onDelist: () => void
  onTopUp?: () => void
  onTopUpOnBehalf?: () => void
  className?: string
}

const Kicker = ({ children }: { children: ReactNode }) => (
  <span className="font-main-semi-bold text-[11px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
    {children}
  </span>
)

const VaultBox = ({ children }: { children: ReactNode }) => (
  <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border border-solid border-gray0 p-4 dark:border-gray0d">
    {children}
  </div>
)

export const RunebondListingCard = ({
  network,
  isPrivate,
  listingRD,
  operatorAddress,
  canOperate,
  awaiting = false,
  refreshing = false,
  vault,
  vaultTopUpReceived = false,
  onList,
  onDelist,
  onTopUp,
  onTopUpOnBehalf,
  className
}: Props) => {
  const intl = useIntl()
  const aboutRunebond = intl.formatMessage({ id: 'bonds.runebond.listing.about' })

  const listing = O.toNullable(useLastSuccess(listingRD, undefined, { resetOnFailure: true }))
  const failed = RD.isFailure(listingRD) && listing === null
  const state = listing ? listingState(listing, operatorAddress) : null
  const unknownVault = canOperate && state === 'vaultDepleted' && vault !== undefined && !vault.known

  const amount = (value: BaseAmount | null) => (
    <span className="flex items-center gap-2 font-main-semi-bold text-[18px] leading-tight text-text0 dark:text-text0d">
      <AssetIcon asset={AssetRuneNative} size="xsmall" network={network} />
      {value === null ? '—' : isPrivate ? hiddenString : formatRuneAmount(value)}
    </span>
  )

  const renderTag = () => {
    if (state === null) return null
    const { pill, dot } = PILL_CLASS[state]
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-main-semi-bold text-[11px] leading-none tracking-[1px] whitespace-nowrap uppercase',
          pill
        )}>
        <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
        {intl.formatMessage({
          id:
            state === 'delisted' && !canOperate
              ? 'bonds.runebond.listing.state.delistedByOperator'
              : `bonds.runebond.listing.state.${state}`
        })}
      </span>
    )
  }

  const renderSkeleton = () => (
    <div className="mt-4 flex flex-col gap-3">
      <div className="h-[18px] w-1/2 animate-pulse rounded bg-gray0 dark:bg-gray0d" />
      <div className="h-[14px] w-full animate-pulse rounded bg-gray0 dark:bg-gray0d" />
      <div className="h-[14px] w-3/4 animate-pulse rounded bg-gray0 dark:bg-gray0d" />
    </div>
  )

  const renderContent = (current: NodeListing, currentState: ListingState) => {
    const details = current.listing
    return (
      <>
        <span className="mt-4 font-main text-[16px] text-text0 dark:text-text0d">
          {intl.formatMessage({ id: `bonds.runebond.listing.headline.${currentState}` })}
        </span>
        <span className="mt-1.5 font-main text-[13px] leading-relaxed text-gray2 dark:text-gray2d">
          {currentState === 'previousOperator' && details
            ? intl.formatMessage(
                { id: 'bonds.runebond.listing.blurb.previousOperator' },
                { operator: truncateAddress(details.operatorAddress, THORChain, network) }
              )
            : intl.formatMessage({
                id:
                  currentState === 'listed' || currentState === 'vaultDepleted' || currentState === 'removed'
                    ? `bonds.runebond.listing.blurb.${currentState}`
                    : 'bonds.runebond.listing.blurb.notListed'
              })}
          {currentState === 'listed' &&
            details &&
            ` ${intl.formatMessage(
              { id: 'bonds.runebond.listing.since' },
              { date: formatChurnDate(details.listedDate, intl.locale) }
            )}`}
        </span>
        {currentState === 'listed' && details && (
          <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-6 gap-y-4 rounded-lg bg-bg2 p-4 dark:bg-bg2d">
            <div className="flex flex-col gap-1.5">
              <Kicker>{intl.formatMessage({ id: 'bonds.runebond.listing.minBond' })}</Kicker>
              {amount(details.minBond)}
            </div>
            <div className="flex flex-col gap-1.5">
              <Kicker>{intl.formatMessage({ id: 'bonds.runebond.listing.targetBond' })}</Kicker>
              {amount(details.targetTotalBond)}
            </div>
            <div className="flex flex-col gap-1.5">
              <Kicker>{intl.formatMessage({ id: 'bonds.runebond.listing.fee' })}</Kicker>
              <span className="font-main-semi-bold text-[18px] leading-tight text-text0 dark:text-text0d">
                {formatBpsAsPercent(details.feeBps, intl.locale)}
              </span>
            </div>
          </div>
        )}
      </>
    )
  }

  const renderVault = () => {
    if (state === 'previousOperator') return null
    if (!canOperate && isVaultDepleted(vault)) {
      return (
        <VaultBox>
          <RunebondVaultOnBehalfDetails
            network={network}
            isPrivate={isPrivate}
            vault={vault}
            received={vaultTopUpReceived}
            onTopUp={onTopUpOnBehalf}
          />
        </VaultBox>
      )
    }
    if (unknownVault) {
      return (
        <VaultBox>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Kicker>{intl.formatMessage({ id: 'bonds.runebond.vault.title' })}</Kicker>
            <span className="font-main text-[13px] leading-relaxed text-gray2 dark:text-gray2d">
              {intl.formatMessage(
                { id: 'bonds.runebond.vault.unknownOperator' },
                { operator: truncateAddress(operatorAddress, THORChain, network) }
              )}
            </span>
          </div>
        </VaultBox>
      )
    }
    if (!canOperate || !canTopUpVault(vault)) return null
    const footerTopUp = state === 'vaultDepleted' && isVaultDepleted(vault)
    return (
      <VaultBox>
        <div className="flex flex-col gap-1.5">
          <Kicker>{intl.formatMessage({ id: 'bonds.runebond.vault.title' })}</Kicker>
          <span
            className={clsx(
              'flex items-center gap-2 font-main-semi-bold text-[18px] leading-tight',
              vault.balance.lt(0) ? VAULT_LEVEL_TEXT_CLASS.depleted : 'text-text0 dark:text-text0d'
            )}>
            <AssetIcon asset={AssetRuneNative} size="xsmall" network={network} />
            {isPrivate ? hiddenString : formatRuneAmount(vault.balance)}
          </span>
        </div>
        {onTopUp && !footerTopUp && (
          <BorderButton size="normal" onClick={onTopUp}>
            {intl.formatMessage({ id: 'bonds.runebond.listing.vaultTopUp' })}
          </BorderButton>
        )}
      </VaultBox>
    )
  }

  const renderPrimary = () => {
    if (state === null || state === 'removed') return null
    if (!canOperate) return null
    if (state === 'previousOperator' || unknownVault) {
      return (
        <FlatButton size="normal" disabled={awaiting} onClick={onList}>
          {intl.formatMessage({ id: 'bonds.runebond.listing.list' })}
        </FlatButton>
      )
    }
    if (state === 'vaultDepleted') {
      return (
        <>
          <Tooltip size="big" title={intl.formatMessage({ id: 'bonds.runebond.vault.listDisabled' })}>
            <BorderButton size="normal" disabled>
              {intl.formatMessage({ id: 'bonds.runebond.listing.list' })}
            </BorderButton>
          </Tooltip>
          {onTopUp && isVaultDepleted(vault) && (
            <FlatButton size="normal" onClick={onTopUp}>
              {intl.formatMessage({ id: 'bonds.runebond.vault.topUp' })}
            </FlatButton>
          )}
        </>
      )
    }
    return (
      <FlatButton size="normal" disabled={awaiting} onClick={onList}>
        {intl.formatMessage({
          id: state === 'listed' ? 'bonds.runebond.listing.update' : 'bonds.runebond.listing.list'
        })}
      </FlatButton>
    )
  }

  const showRemove = canOperate && state === 'listed'

  return (
    <div
      className={clsx(
        'flex flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d',
        className
      )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.runebond.listing.title' })}
          <Tooltip size="big" title={aboutRunebond}>
            <button
              type="button"
              aria-label={aboutRunebond}
              onClick={() => window.apiUrl.openExternal(RUNEBOND_URL)}
              className="flex cursor-pointer items-center justify-center rounded-sm text-gray2 transition-colors hover:text-turquoise focus-visible:text-turquoise focus-visible:outline focus-visible:outline-1 focus-visible:outline-turquoise dark:text-gray2d">
              <InformationCircleIcon className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <RunebondRefreshButton loading={refreshing} />
          {renderTag()}
        </div>
      </div>
      <div className="mb-5 flex flex-col">
        {failed ? (
          <span className="mt-4 font-main text-[13px] leading-relaxed text-gray2 dark:text-gray2d">
            {intl.formatMessage({ id: 'bonds.runebond.listing.unavailable' })}
          </span>
        ) : listing && state ? (
          renderContent(listing, state)
        ) : (
          renderSkeleton()
        )}
        {listing && state && renderVault()}
        {vaultTopUpReceived && (
          <span className="mt-3 font-main text-[13px] leading-relaxed text-turquoise">
            {intl.formatMessage({
              id:
                state === 'vaultDepleted' || (vault?.delistedByVault ?? 0) > 0
                  ? 'bonds.runebond.vault.received'
                  : 'bonds.runebond.vault.receivedBalance'
            })}
          </span>
        )}
        {awaiting && (
          <span className="mt-3 font-main text-[13px] leading-relaxed text-turquoise">
            {intl.formatMessage({ id: 'bonds.runebond.listing.awaiting' })}
          </span>
        )}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-solid border-gray0 pt-5 dark:border-gray0d">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {renderPrimary()}
          <BaseButton
            uppercase={false}
            className="!p-0 font-main-semi-bold text-[13px] text-turquoise hover:underline"
            onClick={() => window.apiUrl.openExternal(RUNEBOND_PRICING_DOCS_URL)}>
            {intl.formatMessage({ id: 'bonds.runebond.listing.pricing' })}
          </BaseButton>
        </div>
        {showRemove && (
          <BaseButton
            className="!p-0 font-main-semi-bold text-[12px] tracking-[1px] text-gray2 uppercase enabled:hover:text-error0 dark:text-gray2d dark:enabled:hover:text-error0d"
            disabled={awaiting}
            onClick={onDelist}>
            {intl.formatMessage({ id: 'bonds.runebond.listing.remove' })}
          </BaseButton>
        )}
      </div>
    </div>
  )
}
