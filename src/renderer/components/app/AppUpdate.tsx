import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { useIntl } from 'react-intl'

import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Button } from '../uielements/button'
import { ExternalLinkIcon } from '../uielements/common'
import { Label } from '../uielements/label'

export type AppUpdateModalProps =
  | {
      isOpen: true
      goToUpdates: () => void
      version: string
      close: () => void
    }
  | {
      isOpen: false
    }

export const AppUpdate = (props: AppUpdateModalProps) => {
  const intl = useIntl()
  const isDesktopView = useBreakpoint()?.lg ?? false

  if (props.isOpen) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-solid border-turquoise bg-turquoise/10 p-2">
        <div className="flex items-center gap-2">
          <ArrowDownTrayIcon className="h-6 w-6 text-turquoise" />
          <span className="uppercase text-turquoise">
            {intl.formatMessage({ id: 'update.description' }, { version: props.version })}
          </span>
        </div>
        <Button className="rounded-lg! flex items-center px-2" sizevalue="normal" onClick={props.goToUpdates}>
          {isDesktopView && <Label color="white">{intl.formatMessage({ id: 'update.link' })}</Label>}
          <ExternalLinkIcon className="ml-0 h-4 w-4 lg:ml-2" />
        </Button>
      </div>
    )
  }

  return null
}
