import { useIntl } from 'react-intl'

import { EstimatedExpiry } from './types'

type Props = {
  name: string
  owner: string
  expireBlockHeight?: number
  estimatedExpiry?: EstimatedExpiry
  preferredAsset?: string
  aliases?: { chain: string; address: string }[]
  nameLabel: string
}

export const NameDetailsCard = ({
  name,
  owner,
  expireBlockHeight,
  estimatedExpiry,
  preferredAsset,
  aliases,
  nameLabel
}: Props) => {
  const intl = useIntl()

  return (
    <div className="rounded-lg border border-gray0 p-4 dark:border-gray0d">
      <div className="flex gap-6">
        <div className="flex-1">
          <div className="text-[11px] text-gray2 dark:text-gray2d">{nameLabel}</div>
          <div className="font-mainSemiBold text-[14px] text-text0 dark:text-text0d">{name}</div>
        </div>
        <div className="flex-1">
          <div className="text-[11px] text-gray2 dark:text-gray2d">{intl.formatMessage({ id: 'common.expiry' })}</div>
          {estimatedExpiry ? (
            <>
              <div className="font-mainSemiBold text-[14px] text-text0 dark:text-text0d">
                {estimatedExpiry.date.toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}{' '}
                <span className="text-[12px] text-gray2 dark:text-gray2d">(~{estimatedExpiry.daysLeft} days)</span>
              </div>
              <div className="text-[11px] text-gray2 dark:text-gray2d">Block {expireBlockHeight?.toLocaleString()}</div>
            </>
          ) : (
            <div className="font-mainSemiBold text-[14px] text-text0 dark:text-text0d">
              Block {expireBlockHeight?.toLocaleString()}
            </div>
          )}
        </div>
      </div>
      <div className="mt-3">
        <div className="text-[11px] text-gray2 dark:text-gray2d">{intl.formatMessage({ id: 'common.owner' })}</div>
        <div className="font-mono text-[12px] break-all text-text0 dark:text-text0d">{owner}</div>
      </div>
      {preferredAsset && (
        <div className="mt-3">
          <div className="text-[11px] text-gray2 dark:text-gray2d">
            {intl.formatMessage({ id: 'common.preferredAsset' })}
          </div>
          <div className="font-mono text-[12px] break-all text-text0 dark:text-text0d">{preferredAsset}</div>
        </div>
      )}
      {aliases && aliases.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] text-gray2 dark:text-gray2d">Chain Aliases ({aliases.length})</div>
          <div className="space-y-1">
            {aliases.map((alias, index) => (
              <div key={index} className="flex items-baseline gap-3 rounded bg-bg1 px-3 py-2 dark:bg-bg1d">
                <span className="font-mainSemiBold w-[50px] shrink-0 text-[12px] text-text0 dark:text-text0d">
                  {alias.chain}
                </span>
                <span className="font-mono text-[12px] break-all text-gray2 dark:text-gray2d">{alias.address}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
