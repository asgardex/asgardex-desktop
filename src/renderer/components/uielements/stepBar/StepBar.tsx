import clsx from 'clsx'

export type Props = {
  size?: number
  className?: string
}

export const StepBar = ({ size = 150, className }: Props): JSX.Element => {
  return (
    <div className={clsx('flex w-[9px] flex-col justify-center', className)}>
      <div className="h-[9px] w-[9px] rounded-full bg-gray1 dark:bg-gray1d" />
      <div className="w-5px border-r border-solid border-gray1 dark:border-gray1d" style={{ height: `${size}px` }} />
      <div className="h-[9px] w-[9px] rounded-full bg-gray1 dark:bg-gray1d" />
    </div>
  )
}
