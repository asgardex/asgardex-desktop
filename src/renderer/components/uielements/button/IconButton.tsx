import clsx from 'clsx'

export const IconButton = ({
  className,
  children,
  disabled = false,
  onClick
}: {
  className?: string
  children: React.ReactNode
  disabled?: boolean
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}) => {
  return (
    <div
      className={clsx(
        'flex flex-col items-center p-1',
        'rounded-lg border border-solid border-gray1 dark:border-gray1d',
        'text-text2 dark:text-text2d',
        'hover:bg-gray1 dark:hover:bg-bg2d',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className
      )}
      onClick={disabled ? undefined : onClick}>
      {children}
    </div>
  )
}
