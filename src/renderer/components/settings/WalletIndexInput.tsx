import clsx from 'clsx'

type WalletIndexInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> & {
  value?: number | string | null
  onChange?: (value: number | null) => void
  onPressEnter?: () => void
}

export const WalletIndexInput = ({ value, className = '', onChange, onPressEnter, ...rest }: WalletIndexInputProps) => {
  const displayValue = value === null || value === undefined ? '' : String(value)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.currentTarget.value
    if (v === '') {
      onChange?.(null)
      return
    }
    const n = Number(v)
    if (!Number.isNaN(n)) onChange?.(n)
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      className={clsx(
        'rounded-lg border border-bg2 bg-bg1 py-0.5 pr-0 pl-2 text-text2 dark:border-bg2d dark:bg-bg1d dark:text-text2d',
        'focus:ring-0 focus:outline-hidden',
        className
      )}
      value={displayValue}
      onChange={handleChange}
      onKeyDown={({ key }) => {
        if (key === 'Enter' && onPressEnter) onPressEnter()
      }}
      {...rest}
    />
  )
}
