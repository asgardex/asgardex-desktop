import { ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { Label } from '../../uielements/label'

export type Props = {
  title?: string
  subTitle?: string
  extra?: React.ReactNode
}

export const WarningView = ({ title, subTitle, extra }: Props): JSX.Element => (
  <div className="flex flex-col items-center bg-bg1 dark:bg-bg1d py-8 space-y-4 rounded-xl">
    <div className="flex items-center justify-center w-20 h-20 rounded-full bg-warning0/10">
      <ExclamationCircleIcon className="w-16 h-16 text-warning0" />
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
