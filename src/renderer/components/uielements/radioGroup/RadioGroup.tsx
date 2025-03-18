import clsx from 'clsx'

export const RadioGroup = ({
  options,
  activeIndex = 0,
  onChange
}: {
  options: { label: React.ReactNode; value: string | number }[]
  activeIndex?: number
  onChange: (index: number) => void
}) => {
  return (
    <div className="h-fit">
      <div className="flex gap-x-[2px] rounded-lg border border-solid border-gray1 bg-bg0 p-[1px] dark:border-gray0d dark:bg-bg0d">
        {options.map((option, index) => (
          <div
            key={option.value}
            className={clsx(
              'flex min-w-[64px] cursor-pointer items-center justify-center rounded-lg p-2',
              activeIndex === index
                ? 'bg-turquoise text-white'
                : 'bg-bg0 text-text2 hover:bg-turquoise/20 hover:text-turquoise dark:bg-bg0d dark:text-text2d'
            )}
            onClick={() => onChange(index)}>
            {option.label}
          </div>
        ))}
      </div>
    </div>
  )
}
