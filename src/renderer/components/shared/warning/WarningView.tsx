import { ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { Label } from '../../uielements/label'

export type Props = {
  title?: string
  subTitle?: string
  extra?: React.ReactNode
}

export const WarningView = ({ title, subTitle, extra }: Props): JSX.Element => (
  <div className="flex flex-col items-center gap-4 rounded-xl bg-bg1 py-8 dark:bg-bg1d">
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-warning0/10">
      <ExclamationCircleIcon className="h-16 w-16 text-warning0" />
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
