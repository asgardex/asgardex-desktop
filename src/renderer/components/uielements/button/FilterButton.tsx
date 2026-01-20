import { Button } from '@headlessui/react'
import clsx from 'clsx'

type FilterButtonProps = {
  active?: boolean
  className?: string
  children: React.ReactNode
  onClick?: () => void
}

export const FilterButton = ({ active = false, className, children, onClick }: FilterButtonProps) => {
  return (
    <Button
      className={clsx(
        // Base styles
        'mr-10px h-8 min-w-0 rounded-2xl border px-3 text-11 uppercase last:mr-0',
        // Active state
        active === true
          ? 'border-turquoise bg-turquoise text-white hover:bg-turquoise/90'
          : 'border-gray1 bg-bg0 text-text2 hover:bg-bg2/90 dark:border-gray1d dark:bg-bg0d dark:text-text2d hover:dark:bg-bg2d/90',
        className
      )}
      onClick={onClick}>
      {children}
    </Button>
  )
}
