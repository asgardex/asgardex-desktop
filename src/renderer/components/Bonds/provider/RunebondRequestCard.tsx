import { Network } from '@xchainjs/xchain-client'
import { Address } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { THORChain } from '../../../../shared/utils/chainIds'
import { truncateAddress } from '../../../helpers/addressHelper'
import { hiddenString } from '../../../helpers/stringHelper'
import { WhitelistRequest } from '../../../services/runebond'
import { NodeInfo } from '../../../services/thorchain/types'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { BaseButton, FlatButton } from '../../uielements/button'
import { CopyLabel } from '../../uielements/label'
import { Tooltip } from '../../uielements/tooltip'
import { addressExplorerUrl, formatChurnDate, formatRuneAmount, hasBondProvider, isBondActionLocked } from './helpers'

const RUNEBOND_REQUEST_TTL_DAYS = 15
const DAY_MS = 24 * 60 * 60 * 1000

const CARD = 'rounded-lg border border-solid border-gray0 bg-bg0 dark:border-gray0d dark:bg-bg0d'
const TAG = 'font-main-semi-bold text-[12px] tracking-[1px] uppercase'

const daysLeft = ({ requestedDate }: WhitelistRequest) =>
  Math.max(0, RUNEBOND_REQUEST_TTL_DAYS - Math.floor((Date.now() - requestedDate.getTime()) / DAY_MS))

type Props = {
  request: WhitelistRequest
  network: Network
  isPrivate: boolean
  nodesLoaded: boolean
  node: NodeInfo | undefined
  hasSigner: (node: NodeInfo) => boolean
  maxBondProviders: number
  onOpenNode: (nodeAddress: Address) => void
  onApprove: (request: WhitelistRequest) => void
}

export const RunebondRequestCard = ({
  request,
  network,
  isPrivate,
  nodesLoaded,
  node,
  hasSigner,
  maxBondProviders,
  onOpenNode,
  onApprove
}: Props) => {
  const intl = useIntl()

  const renderApprove = () => {
    const label = intl.formatMessage({ id: 'bonds.runebond.requests.approve' })
    if (!nodesLoaded) {
      return (
        <FlatButton size="normal" className="w-full" disabled>
          {label}
        </FlatButton>
      )
    }
    if (node && hasBondProvider(node, request.providerAddress)) {
      return (
        <span
          className={clsx(
            TAG,
            'w-full rounded-lg bg-bg1 py-[11px] text-center text-gray2 dark:bg-bg1d dark:text-gray2d'
          )}>
          {intl.formatMessage({ id: 'bonds.runebond.requests.whitelisted' })}
        </span>
      )
    }
    const disabledReason = (() => {
      if (!node || !hasSigner(node)) return 'bonds.runebond.requests.noSigner' as const
      if (isBondActionLocked(node)) return 'bonds.operator.readyLocked' as const
      if (node.bondProviders.providers.length >= maxBondProviders) return 'bonds.operator.noFreeSlots' as const
      return null
    })()
    if (disabledReason) {
      return (
        <Tooltip size="big" title={intl.formatMessage({ id: disabledReason })}>
          <FlatButton size="normal" className="w-full" disabled>
            {label}
          </FlatButton>
        </Tooltip>
      )
    }
    return (
      <FlatButton size="normal" className="w-full" onClick={() => onApprove(request)}>
        {label}
      </FlatButton>
    )
  }

  return (
    <div className={`flex flex-col p-[22px] ${CARD}`}>
      <div className="flex items-center gap-2">
        <BaseButton
          uppercase={false}
          className="!p-0 text-text0 hover:text-turquoise dark:text-text0d dark:hover:text-turquoise"
          title={intl.formatMessage({ id: 'bonds.provider.detail.viewOnExplorer' })}
          onClick={() => window.apiUrl.openExternal(addressExplorerUrl(request.providerAddress))}>
          {truncateAddress(request.providerAddress, THORChain, network)}
        </BaseButton>
        <CopyLabel textToCopy={request.providerAddress} iconClassName="!h-4 !w-4" />
      </div>
      <span className="mt-[3px] font-main text-[13px] text-gray2 dark:text-gray2d">
        {intl.formatMessage(
          { id: 'bonds.runebond.requests.forNodeShort' },
          {
            node: (
              <BaseButton
                key="node"
                uppercase={false}
                className="!inline-flex !p-0 !text-[13px] text-gray2 hover:text-turquoise dark:text-gray2d"
                onClick={() => onOpenNode(request.nodeAddress)}>
                {truncateAddress(request.nodeAddress, THORChain, network)}
              </BaseButton>
            )
          }
        )}
      </span>
      <div className="mt-[14px] flex items-center gap-2">
        <AssetIcon asset={AssetRuneNative} size="small" network={network} />
        <span className="font-main text-[28px] leading-none text-text0 dark:text-text0d">
          {isPrivate ? hiddenString : formatRuneAmount(request.intendedBond)}
        </span>
      </div>
      <span className="mt-0.5 font-main text-[13px] text-gray2 dark:text-gray2d">
        {intl.formatMessage(
          { id: 'bonds.runebond.requests.age' },
          { date: formatChurnDate(request.requestedDate, intl.locale), days: daysLeft(request) }
        )}
      </span>
      <div className="mt-auto flex w-full flex-col pt-5">{renderApprove()}</div>
    </div>
  )
}
