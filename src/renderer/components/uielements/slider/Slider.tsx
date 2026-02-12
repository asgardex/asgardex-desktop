import clsx from 'clsx'

type Props = {
  min?: number
  max?: number
  step?: number
  value?: number
  defaultValue?: number
  disabled?: boolean
  labels?: string[]
  error?: boolean
  onChange?: (value: number) => void
  onAfterChange?: (value?: number) => void
}

export const Slider = ({
  min,
  max,
  step,
  value,
  defaultValue,
  disabled = false,
  labels = ['0%', '50%', '100%'],
  error = false,
  onChange,
  onAfterChange
}: Props) => {
  return (
    <div className="relative">
      <input
        id="minmax-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        className={clsx(
          'h-2 w-full cursor-pointer appearance-none rounded-lg',
          error ? 'bg-error0/40' : 'bg-gray0 dark:bg-gray0d'
        )}
        onChange={(e) => onChange?.(parseInt(e.target.value))}
        onMouseUp={() => onAfterChange?.()}
        onTouchEnd={() => onAfterChange?.()}
      />

      <div className="mt-2 flex items-center justify-between">
        {labels.map((label, idx) => {
          const leftPercent = labels.length === 1 ? 0 : (idx / (labels.length - 1)) * 100

          return (
            <span
              key={idx}
              className="-bottom-6 text-sm text-gray1 dark:text-gray1d"
              style={{ left: `${leftPercent}%` }}>
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
