import { baseAmount, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import type { AnyAsset } from '@xchainjs/xchain-util'
import type { UTXO } from '@xchainjs/xchain-utxo-providers'
import clsx from 'clsx'
import { useIntl } from 'react-intl'

type Props = {
  selectedUtxos: UTXO[]
  asset: AnyAsset
  targetAmount?: number // in base units (satoshis)
}

export const CoinControlSummary = ({ selectedUtxos, asset, targetAmount }: Props): JSX.Element => {
  const intl = useIntl()
  // UTXO chains are always 8 decimal (satoshi-based)
  const decimal = 8
  const totalValue = selectedUtxos.reduce((sum, u) => sum + u.value, 0)

  const isInsufficient = targetAmount !== undefined && totalValue < targetAmount

  const totalFormatted = formatAssetAmountCurrency({
    amount: baseToAsset(baseAmount(totalValue, decimal)),
    asset,
    trimZeros: true
  })

  return (
    <div className="flex flex-col gap-1 rounded-lg bg-bg1 px-3 py-2 dark:bg-bg1d">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'wallet.send.coinControl.selected' }, { count: selectedUtxos.length })}
        </span>
        <span className="text-xs text-gray2 uppercase dark:text-gray2d">
          {intl.formatMessage({ id: 'wallet.send.coinControl.totalSelected' })}
        </span>
      </div>
      <div className="flex items-center justify-end">
        <span
          className={clsx(
            'text-sm font-medium',
            isInsufficient ? 'text-error0 dark:text-error0d' : 'text-text0 dark:text-text0d'
          )}>
          {totalFormatted}
        </span>
      </div>
      {isInsufficient && (
        <span className="text-xs text-error0 dark:text-error0d">
          {intl.formatMessage({ id: 'wallet.send.coinControl.insufficient' })}
        </span>
      )}
    </div>
  )
}
