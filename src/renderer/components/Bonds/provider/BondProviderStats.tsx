import * as RD from '@devexperts/remote-data-ts'
import { ArrowRightIcon } from '@heroicons/react/20/solid'
import { Network } from '@xchainjs/xchain-client'
import { BaseAmount } from '@xchainjs/xchain-util'
import { function as FP, option as O } from 'fp-ts'
import { useIntl } from 'react-intl'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { hiddenString } from '../../../helpers/stringHelper'
import { AssetIcon } from '../../uielements/assets/assetIcon'
import { BaseButton, RefreshButton } from '../../uielements/button'
import { formatRuneAmount } from './helpers'

type Props = {
  network: Network
  isPrivate: boolean
  totalBond: BaseAmount
  totalBondPrice: O.Option<string>
  freeToBond: BaseAmount
  paidLastChurn: RD.RemoteData<Error, BaseAmount>
  onHistoryClick: () => void
  onReload: () => void
  reloading: boolean
}

export const BondProviderStats = ({
  network,
  isPrivate,
  totalBond,
  totalBondPrice,
  freeToBond,
  paidLastChurn,
  onHistoryClick,
  onReload,
  reloading
}: Props) => {
  const intl = useIntl()

  const subtitle = FP.pipe(
    totalBondPrice,
    O.map((price) => `≈ ${price}`),
    O.toNullable
  )

  return (
    <div className="flex w-full flex-col gap-6 rounded-lg border border-solid border-gray0 bg-bg0 p-6 lg:flex-row lg:items-start lg:justify-between dark:border-gray0d dark:bg-bg0d">
      <div className="flex flex-col">
        <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.provider.yourBond' })}
        </span>
        <div className="mt-2 flex items-center gap-3">
          <AssetIcon asset={AssetRuneNative} size="normal" network={network} />
          <span className="font-main-bold text-[44px] leading-none text-text0 dark:text-text0d">
            {isPrivate ? hiddenString : formatRuneAmount(totalBond)}
          </span>
        </div>
        {subtitle && !isPrivate && (
          <span className="mt-2 font-main text-[14px] text-gray2 dark:text-gray2d">{subtitle}</span>
        )}
      </div>

      <div className="flex flex-col">
        <span className="font-main-semi-bold text-[12px] tracking-[2px] text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.provider.freeToBond' })}
        </span>
        <div className="mt-2 flex items-center gap-2">
          <AssetIcon asset={AssetRuneNative} size="small" network={network} />
          <span className="font-main-bold text-[32px] leading-none text-text0 dark:text-text0d">
            {isPrivate ? hiddenString : formatRuneAmount(freeToBond)}
          </span>
        </div>
        <span className="mt-2 font-main text-[14px] text-gray2 dark:text-gray2d">
          {intl.formatMessage({ id: 'bonds.provider.idleInWallet' })}
        </span>
      </div>

      <div className="flex flex-col items-start gap-4 lg:items-end lg:justify-between lg:self-stretch">
        <div className="flex flex-col items-start lg:items-end">
          <BaseButton
            className="group !p-0 font-main-semi-bold text-[12px] tracking-[2px] text-turquoise uppercase"
            onClick={onHistoryClick}>
            {intl.formatMessage({ id: 'bonds.provider.paidLastChurn' })}
            {' · '}
            {intl.formatMessage({ id: 'bonds.provider.history' })}
            <ArrowRightIcon className="ml-1 h-[14px] w-[14px] text-inherit transition-transform group-hover:translate-x-[2px]" />
          </BaseButton>
          <div className="mt-2 flex items-center gap-2">
            <AssetIcon asset={AssetRuneNative} size="small" network={network} />
            <span className="font-main-bold text-[32px] leading-none text-text0 dark:text-text0d">
              {isPrivate
                ? hiddenString
                : FP.pipe(
                    paidLastChurn,
                    RD.fold(
                      () => '—',
                      () => '—',
                      () => '—',
                      (amount) => formatRuneAmount(amount)
                    )
                  )}
            </span>
          </div>
        </div>
        <RefreshButton onClick={onReload} disabled={reloading} />
      </div>
    </div>
  )
}
