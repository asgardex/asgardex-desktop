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
      <div className="flex rounded-lg border border-solid border-gray0 dark:border-gray0d">
        {options.map((option, index) => (
          <>
            {index !== 0 && <div className="h-10 w-[1px] bg-gray0 dark:bg-gray0d" />}
            <div
              key={option.value}
              className={clsx(
                'cursor-pointer p-2 hover:bg-gray0 hover:dark:bg-gray0d',
                'first:rounded-l-md last:rounded-r-md',
                activeIndex === index ? 'bg-gray0 dark:bg-gray0d' : 'bg-transparent'
              )}
              onClick={() => onChange(index)}>
              {option.label}
            </div>
          </>
        ))}
      </div>
    </div>
  )
}
