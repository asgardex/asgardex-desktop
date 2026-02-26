import { InboxIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

type Props = {
  title?: string
  className?: string
}

export const EmptyResult = ({ title = '', className = '' }: Props): JSX.Element => {
  return (
    <div className={clsx('flex flex-col items-center justify-center p-20px', className)}>
      <InboxIcon className="h-[40px] w-[40px] text-gray1 lg:h-[60px] lg:w-[60px] dark:text-gray1d" />
      {!!title && (
        <h3 className="font-mainFont pt-10px text-center text-14 text-gray2 uppercase lg:text-16 dark:text-gray2d">
          {title}
        </h3>
      )}
    </div>
  )
}
