import { baseAmount, baseToAsset, formatAssetAmountCurrency } from '@xchainjs/xchain-util'
import type { AnyAsset } from '@xchainjs/xchain-util'
import type { UTXO } from '@xchainjs/xchain-utxo-providers'
import clsx from 'clsx'

type Props = {
  utxo: UTXO
  asset: AnyAsset
  selected: boolean
  disabled: boolean
  onToggle: (utxo: UTXO) => void
}

const truncateHash = (hash: string): string => `${hash.slice(0, 6)}...${hash.slice(-4)}`

export const UTXOListItem = ({ utxo, asset, selected, disabled, onToggle }: Props): JSX.Element => {
  // UTXO chains are always 8 decimal (satoshi-based)
  const amountFormatted = formatAssetAmountCurrency({
    amount: baseToAsset(baseAmount(utxo.value, 8)),
    asset,
    trimZeros: true
  })

  return (
    <label
      className={clsx(
        'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
        selected
          ? 'border-turquoise bg-turquoise/10'
          : 'border-gray0 bg-bg0 hover:border-gray1 dark:border-gray0d dark:bg-bg0d dark:hover:border-gray1d',
        disabled && 'pointer-events-none opacity-50'
      )}>
      <input
        type="checkbox"
        checked={selected}
        disabled={disabled}
        onChange={() => onToggle(utxo)}
        className="h-4 w-4 accent-turquoise"
      />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-mono text-sm text-text0 dark:text-text0d">
            {truncateHash(utxo.hash)}:{utxo.index}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-medium text-text0 dark:text-text0d">{amountFormatted}</span>
        </div>
      </div>
    </label>
  )
}
