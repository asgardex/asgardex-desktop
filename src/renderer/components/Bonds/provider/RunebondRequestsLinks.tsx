import * as RD from '@devexperts/remote-data-ts'
import { ArrowRightIcon } from '@heroicons/react/20/solid'
import { Address } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { useNodeWhitelistRequests } from '../../../hooks/useRunebondListing'
import { OperatorWhitelistRequestsRD } from '../../../services/runebond'
import { BaseButton } from '../../uielements/button'

const LINK = 'group !p-0 font-main-semi-bold text-[12px] tracking-[1px] text-turquoise uppercase whitespace-nowrap'
const ARROW = 'ml-1 h-[14px] w-[14px] text-inherit transition-transform group-hover:translate-x-[2px]'

type TileProps = {
  requestsRD: OperatorWhitelistRequestsRD
  onOpen: () => void
}

export const RunebondRequestsTile = ({ requestsRD, onOpen }: TileProps) => {
  const intl = useIntl()

  if (!RD.isSuccess(requestsRD) || requestsRD.value.counts.pending === 0) return null

  return (
    <button
      type="button"
      className="group flex w-full cursor-pointer appearance-none items-center gap-4 rounded-lg border border-solid border-turquoise bg-transparent px-5 py-4 text-left transition-colors hover:bg-turquoise/5 focus-visible:bg-turquoise/5 focus-visible:outline-none lg:basis-full @min-[1150px]:w-auto @min-[1150px]:basis-auto dark:border-turquoise dark:hover:bg-turquoise/10 dark:focus-visible:bg-turquoise/10"
      onClick={onOpen}>
      <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-turquoise font-main-semi-bold text-[19px] text-white">
        {requestsRD.value.counts.pending}
      </span>
      <span className="flex min-w-0 flex-col items-start gap-[2px]">
        <span className="font-main text-[15px] text-text0 dark:text-text0d">
          {intl.formatMessage(
            { id: 'bonds.runebond.requests.tile.waiting' },
            { count: requestsRD.value.counts.pending }
          )}
        </span>
        <span className="flex items-center font-main text-[13px] text-gray2 dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.runebond.requests.tile.review' })}
          <ArrowRightIcon className={ARROW} />
        </span>
      </span>
    </button>
  )
}

type NodeLinkProps = {
  nodeAddress: Address
  onOpen: (nodeAddress: Address) => void
  className?: string
}

export const NodeRunebondRequestsLink = ({ nodeAddress, onOpen, className }: NodeLinkProps) => {
  const intl = useIntl()
  const requestsRD = useNodeWhitelistRequests(nodeAddress)

  if (!RD.isSuccess(requestsRD) || requestsRD.value.counts.pending === 0) return null

  return (
    <BaseButton className={clsx('self-start', LINK, className)} onClick={() => onOpen(nodeAddress)}>
      {intl.formatMessage({ id: 'bonds.runebond.requests.nodeLink' }, { count: requestsRD.value.counts.pending })}
      <ArrowRightIcon className={ARROW} />
    </BaseButton>
  )
}
