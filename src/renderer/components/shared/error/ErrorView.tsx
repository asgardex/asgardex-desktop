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
  <div
    className={clsx(
      'flex flex-col items-center justify-center space-y-4 rounded-xl bg-bg1 py-8 dark:bg-bg1d',
      className
    )}>
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-error0/10">
      <ExclamationCircleIcon className="h-16 w-16 text-error0" />
    </div>
    {title && (
      <Label className="w-auto!" color="gray" size="big" textTransform="uppercase" weight="bold">
        {title}
      </Label>
    )}
    {subTitle && (
      <Label className="w-auto!" color="gray" textTransform="uppercase">
        {subTitle}
      </Label>
    )}
    {extra && extra}
  </div>
)
