import { ExclamationCircleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { Label } from '../../uielements/label'

export type Props = {
  className?: string
  title?: string
  subTitle?: string
  extra?: React.ReactNode
}

export const ErrorView = ({ className, title, subTitle, extra }: Props): JSX.Element => (
  <div className={clsx('flex flex-col items-center bg-bg1 dark:bg-bg1d py-8 space-y-4 rounded-xl', className)}>
    <div className="flex items-center justify-center bg-error0/10 w-20 h-20 rounded-full">
      <ExclamationCircleIcon className="w-16 h-16 text-error0" />
    </div>
    {title && (
      <Label className="!w-auto" color="gray" size="big" textTransform="uppercase" weight="bold">
        {title}
      </Label>
    )}
    {subTitle && (
      <Label className="!w-auto" color="gray" textTransform="uppercase">
        {subTitle}
      </Label>
    )}
    {extra && extra}
  </div>
)
