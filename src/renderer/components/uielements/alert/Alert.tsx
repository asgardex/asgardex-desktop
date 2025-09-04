import { ExclamationCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'
import { Label } from '../label'

export type Props = {
  className?: string
  type?: 'info' | 'warning' | 'error'
  title?: string
  description?: string | React.ReactNode
  action?: React.ReactNode
}

export const Alert = ({ className, type, title, description, action }: Props): JSX.Element => {
  return (
    <div className={clsx('bg-bg0 dark:bg-bg0d rounded-lg', className)}>
      <div
        className={clsx(
          'flex justify-between items-start border border-solid p-2 rounded-lg',
          { 'border-turquoise bg-turquoise/10': type === 'info' },
          { 'border-warning0 bg-warning0/10 dark:bg-warning0/10': type === 'warning' },
          { 'border-error0 bg-error0/10 dark:bg-error0/10': type === 'error' }
        )}>
        <div className="flex space-x-2 items-start">
          <div className="w-6 h-6">
            {type === 'info' && <InformationCircleIcon className="text-turquoise" />}
            {type === 'warning' && <ExclamationTriangleIcon className="text-warning0" />}
            {type === 'error' && <ExclamationCircleIcon className="text-error0" />}
          </div>
          <div className="flex flex-col">
            {title && (
              <Label size="big" textTransform="uppercase" weight="bold">
                {title}
              </Label>
            )}
            {description &&
              (typeof description === 'string' ? <Label textTransform="uppercase">{description}</Label> : description)}
          </div>
        </div>
        {action && <div className="ml-2">{action}</div>}
      </div>
    </div>
  )
}
