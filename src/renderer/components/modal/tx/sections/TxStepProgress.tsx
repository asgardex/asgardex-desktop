import clsx from 'clsx'

type Props = {
  current: number
  total: number
  descriptions: string[]
}

export const TxStepProgress = ({ current, total, descriptions }: Props): JSX.Element => {
  return (
    <div className="flex w-full flex-col items-center gap-2 px-6 py-3">
      {/* Segmented progress bar */}
      <div className="flex w-full gap-1">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={clsx(
              'h-1.5 flex-1 rounded-full transition-colors duration-300',
              i < current ? 'bg-turquoise' : 'bg-gray0 dark:bg-gray0d'
            )}
          />
        ))}
      </div>
      {/* Step description */}
      {current > 0 && current <= descriptions.length && (
        <span className="text-center font-main text-xs text-text2 uppercase dark:text-text2d">
          {descriptions[current - 1]}
        </span>
      )}
    </div>
  )
}
