import { Fragment } from 'react'

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
      <div className="flex rounded-lg border border-solid border-gray1 dark:border-gray0d">
        {options.map((option, index) => (
          <Fragment key={option.value}>
            {index !== 0 && <div className="h-10 w-[1px] bg-gray0 dark:bg-gray0d" />}
            <div
              className={clsx(
                'cursor-pointer p-2 hover:bg-gray1 hover:dark:bg-gray1d',
                'first:rounded-l-md last:rounded-r-md',
                activeIndex === index ? 'bg-gray1 dark:bg-gray0d' : 'bg-transparent'
              )}
              onClick={() => onChange(index)}>
              {option.label}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
