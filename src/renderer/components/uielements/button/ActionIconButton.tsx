import clsx from 'clsx'

export const ActionIconButton = ({
  className,
  icon,
  text,
  disabled = false,
  onClick
}: {
  className?: string
  icon?: React.ReactNode
  text: string
  disabled?: boolean
  onClick?: () => void
}) => {
  return (
    <div
      className={clsx(
        'flex min-w-[100px] flex-col items-center',
        'space-y-2 px-4 py-2',
        'rounded-lg border border-solid border-bg2 dark:border-bg2d',
        'text-text2 dark:text-text2d',
        'hover:bg-bg2 dark:hover:bg-bg2d',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
        className
      )}
      onClick={disabled ? undefined : onClick}>
      {icon}
      <span>{text}</span>
    </div>
  )
}
