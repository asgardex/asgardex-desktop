import { Network } from '@xchainjs/xchain-client'
import { Address } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { THORChain } from '../../../../shared/utils/chainIds'
import { WalletType } from '../../../../shared/wallet/types'
import { truncateAddress } from '../../../helpers/addressHelper'
import { hiddenString } from '../../../helpers/stringHelper'
import { MyWhitelistRequest } from '../../../hooks/useRunebondListing'
import { walletTypeToI18n } from '../../../services/wallet/util'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { WalletTypeLabel } from '../../uielements/common'
import { formatChurnDate, formatRuneAmount, runebondDaysLeft } from './helpers'
import { RunebondRefreshButton } from './RunebondRefreshButton'
import { StatusPill } from './StatusPill'

type Props = {
  network: Network
  isPrivate: boolean
  requests: MyWhitelistRequest[]
  loading: boolean
  nodeName: (nodeAddress: Address) => string | null
  walletTypeOf?: (providerAddress: Address) => WalletType | undefined
  onOpenNode: (nodeAddress: Address) => void
  className?: string
}

export const PendingRequestsCard = ({
  network,
  isPrivate,
  requests,
  loading,
  nodeName,
  walletTypeOf,
  onOpenNode,
  className
}: Props) => {
  const intl = useIntl()

  return (
    <div
      className={clsx(
        'flex w-full flex-col rounded-lg border border-solid border-gray0 bg-bg0 dark:border-gray0d dark:bg-bg0d',
        className
      )}>
      <div className="flex items-center justify-between border-b border-solid border-gray0 px-[26px] py-5 dark:border-gray0d">
        <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.provider.pendingRequests.title' }, { count: requests.length })}
        </span>
        <RunebondRefreshButton loading={loading} />
      </div>
      {requests.map((request) => {
        const { nodeAddress, providerAddress, intendedBond, status, date, expiresDate } = request
        const name = nodeName(nodeAddress)
        const address = truncateAddress(nodeAddress, THORChain, network)
        const walletType = walletTypeOf?.(providerAddress)
        return (
          <div
            key={`${nodeAddress}-${providerAddress}`}
            className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-5 gap-y-2.5 border-b border-solid border-gray0/50 px-[26px] py-4 last:border-b-0 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto_minmax(0,1fr)] dark:border-gray0d/50">
            <div className="flex min-w-0 flex-col">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  className="cursor-pointer truncate text-left font-main text-[15px] text-text0 hover:text-turquoise dark:text-text0d"
                  onClick={() => onOpenNode(nodeAddress)}>
                  {name ?? address}
                </button>
                {walletType && (
                  <WalletTypeLabel className="shrink-0 text-[9px] leading-3">
                    {walletTypeToI18n(walletType, intl)}
                  </WalletTypeLabel>
                )}
              </div>
              {name && <span className="truncate font-mono text-[12px] text-gray1 dark:text-gray1d">{address}</span>}
            </div>
            <div className="flex items-center gap-2 font-main text-[16px] whitespace-nowrap text-text0 dark:text-text0d">
              <AssetIcon asset={AssetRuneNative} size="xsmall" network={network} />
              {isPrivate ? hiddenString : formatRuneAmount(intendedBond)}
            </div>
            <StatusPill
              tone={status === 'sent' ? 'accent' : 'warning'}
              pulse={status === 'sent'}
              className="justify-self-start">
              {intl.formatMessage({ id: `bonds.runebond.provider.state.${status}` })}
            </StatusPill>
            <div className="flex min-w-0 flex-col items-end text-right">
              <span className="font-main text-[14px] text-text2 dark:text-text2d">
                {status === 'sent'
                  ? intl.formatMessage({ id: 'bonds.runebond.provider.sent.line' })
                  : expiresDate
                    ? intl.formatMessage(
                        { id: 'bonds.provider.pendingRequests.daysLeft' },
                        { count: runebondDaysLeft(expiresDate) }
                      )
                    : null}
              </span>
              <span className="mt-0.5 font-main text-[12px] text-gray1 dark:text-gray1d">
                {intl.formatMessage(
                  { id: 'bonds.provider.pendingRequests.requested' },
                  { date: formatChurnDate(date, intl.locale) }
                )}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
