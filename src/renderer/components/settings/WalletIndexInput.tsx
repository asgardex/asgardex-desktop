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
        'rounded-lg pl-2 pr-0 py-0.5 bg-bg1 dark:bg-bg1d text-text2 dark:text-text2d border border-bg2 dark:border-bg2d',
        'focus:outline-none focus:ring-none',
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
