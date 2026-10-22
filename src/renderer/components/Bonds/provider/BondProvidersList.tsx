import { ReactNode } from 'react'

import { PlusIcon } from '@heroicons/react/24/outline'
import { Network } from '@xchainjs/xchain-client'

import { BaseAmount, baseToAsset } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { THORChain } from '../../../../shared/utils/chainIds'
import { truncateAddress } from '../../../helpers/addressHelper'
import { hiddenString } from '../../../helpers/stringHelper'
import { NodeProviders } from '../../../services/runebond'
import { Providers } from '../../../services/thorchain/types'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { BaseButton, BorderButton } from '../../uielements/button'
import { BondProviderMeta } from './BondProviderMeta'
import { formatRuneAmount } from './helpers'

type Props = {
  network: Network
  isPrivate: boolean
  providers: Providers[]
  nodeBond: BaseAmount
  slotsLabel: string
  isMine: (address: string) => boolean
  onAdd?: () => void
  onRemove?: (provider: Providers) => void
  canRemove?: (provider: Providers) => boolean
  providerMeta?: NodeProviders
  headerExtra?: ReactNode
}

export const BondProvidersList = ({
  network,
  isPrivate,
  providers,
  nodeBond,
  slotsLabel,
  isMine,
  onAdd,
  onRemove,
  canRemove = () => true,
  providerMeta,
  headerExtra
}: Props) => {
  const intl = useIntl()

  const bonded = providers.filter(({ bond }) => bond.gt(0)).length

  const shareLabel = (amount: BaseAmount) => {
    if (amount.lte(0)) return intl.formatMessage({ id: 'bonds.operator.detail.idleSlot' })
    if (nodeBond.lte(0)) return '0%'
    const percent = baseToAsset(amount).amount().div(baseToAsset(nodeBond).amount()).times(100)
    return percent.lt(0.1) ? '<0.1%' : `${percent.toFixed(1)}%`
  }

  return (
    <div className="flex flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
            {intl.formatMessage({ id: 'bonds.provider.detail.providersTitle' })}
          </span>
          <span className="font-main text-[13px] text-gray2 dark:text-gray2d">
            {slotsLabel}
            {' · '}
            {intl.formatMessage(
              { id: 'bonds.provider.detail.bondedIdle' },
              { bonded, idle: providers.length - bonded }
            )}
          </span>
          {headerExtra}
        </div>
        {onAdd && (
          <BorderButton size="normal" onClick={onAdd}>
            <PlusIcon className="mr-1 h-[16px] w-[16px] text-inherit" />
            {intl.formatMessage({ id: 'bonds.operator.addProvider' })}
          </BorderButton>
        )}
      </div>
      <div className="mt-4 flex max-h-[300px] flex-col divide-y divide-gray0 overflow-y-auto pr-3 dark:divide-gray0d">
        {providers.map((provider) => {
          const mine = isMine(provider.bondAddress)
          const removable = !!onRemove && canRemove(provider)
          return (
            <div
              key={provider.bondAddress}
              className={clsx(
                'flex items-center justify-between gap-4 px-2 py-3',
                mine && 'rounded-md bg-turquoise/5 dark:bg-turquoise/10'
              )}>
              <div className="flex min-w-0 flex-col">
                <span
                  className={clsx(
                    'min-w-0 truncate font-main text-[14px]',
                    mine ? 'font-main-semi-bold text-turquoise' : 'text-text0 dark:text-text0d'
                  )}>
                  {truncateAddress(provider.bondAddress, THORChain, network)}
                  {mine && ` (${intl.formatMessage({ id: 'bonds.provider.detail.you' })})`}
                </span>
                {providerMeta && (
                  <BondProviderMeta
                    providerMeta={providerMeta}
                    bondAddress={provider.bondAddress}
                    bond={provider.bond}
                    isPrivate={isPrivate}
                  />
                )}
              </div>
              <div className="flex shrink-0 items-center gap-6">
                <span className="flex items-center gap-2 font-main-semi-bold text-[14px] text-text0 dark:text-text0d">
                  <AssetIcon asset={AssetRuneNative} size="xsmall" network={network} />
                  {isPrivate ? hiddenString : formatRuneAmount(provider.bond)}
                </span>
                <span className="w-[64px] text-right font-main text-[13px] text-gray2 dark:text-gray2d">
                  {isPrivate && provider.bond.gt(0) ? hiddenString : shareLabel(provider.bond)}
                </span>
                {onRemove && (
                  <BaseButton
                    className={clsx(
                      'w-[64px] justify-end !p-0 font-main-semi-bold text-[12px] tracking-[1px] uppercase',
                      removable ? 'text-error0 hover:text-error1 dark:text-error0d' : 'invisible'
                    )}
                    disabled={!removable}
                    onClick={() => onRemove(provider)}>
                    {intl.formatMessage({ id: 'bonds.operator.remove' })}
                  </BaseButton>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
