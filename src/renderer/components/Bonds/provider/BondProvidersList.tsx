import { Network } from '@xchainjs/xchain-client'
import { THORChain } from '@xchainjs/xchain-thorchain'
import { BaseAmount, baseToAsset } from '@xchainjs/xchain-util'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { truncateAddress } from '../../../helpers/addressHelper'
import { hiddenString } from '../../../helpers/stringHelper'
import { Providers } from '../../../services/thorchain/types'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { formatRuneAmount } from './helpers'

type Props = {
  network: Network
  isPrivate: boolean
  providers: Providers[]
  nodeBond: BaseAmount
  slotsLabel: string
  isMine: (address: string) => boolean
}

export const BondProvidersList = ({ network, isPrivate, providers, nodeBond, slotsLabel, isMine }: Props) => {
  const intl = useIntl()

  const bonded = providers.filter(({ bond }) => bond.gt(0)).length

  const percentOf = (amount: BaseAmount) =>
    nodeBond.gt(0) ? `${baseToAsset(amount).amount().div(baseToAsset(nodeBond).amount()).times(100).toFixed(1)}%` : '0%'

  return (
    <div className="flex flex-col rounded-lg border border-solid border-gray0 bg-bg0 p-6 dark:border-gray0d dark:bg-bg0d">
      <div className="flex flex-col gap-1">
        <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.provider.detail.providersTitle' })}
        </span>
        <span className="font-main text-[13px] text-gray2 dark:text-gray2d">
          {slotsLabel}
          {' · '}
          {intl.formatMessage({ id: 'bonds.provider.detail.bondedIdle' }, { bonded, idle: providers.length - bonded })}
        </span>
      </div>
      <div className="mt-4 flex max-h-[300px] flex-col divide-y divide-gray0 overflow-y-auto pr-3 dark:divide-gray0d">
        {providers.map((provider) => {
          const mine = isMine(provider.bondAddress)
          return (
            <div
              key={provider.bondAddress}
              title={mine ? intl.formatMessage({ id: 'bonds.provider.detail.you' }) : undefined}
              className={clsx(
                'flex items-center justify-between gap-4 px-2 py-3',
                mine && 'rounded-md bg-turquoise/5 dark:bg-turquoise/10'
              )}>
              <span
                className={clsx(
                  'min-w-0 truncate font-main text-[14px]',
                  mine ? 'font-main-semi-bold text-turquoise' : 'text-text0 dark:text-text0d'
                )}>
                {truncateAddress(provider.bondAddress, THORChain, network)}
              </span>
              <div className="flex shrink-0 items-center gap-6">
                <span className="flex items-center gap-2 font-main-semi-bold text-[14px] text-text0 dark:text-text0d">
                  <AssetIcon asset={AssetRuneNative} size="xsmall" network={network} />
                  {isPrivate ? hiddenString : formatRuneAmount(provider.bond)}
                </span>
                <span className="w-[56px] text-right font-main text-[13px] text-gray2 dark:text-gray2d">
                  {percentOf(provider.bond)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
