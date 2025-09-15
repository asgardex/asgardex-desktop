import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { useIntl } from 'react-intl'

import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Button } from '../uielements/button'
import { ExternalLinkIcon } from '../uielements/common/Common.styles'
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
      <div className="flex items-center justify-between p-2 rounded-xl border border-solid border-turquoise bg-turquoise/10">
        <div className="flex items-center space-x-2">
          <ArrowDownTrayIcon className="w-6 h-6 text-turquoise" />
          <span className="uppercase text-turquoise">
            {intl.formatMessage({ id: 'update.description' }, { version: props.version })}
          </span>
        </div>
        <Button className="flex items-center px-2 !rounded-lg" sizevalue="normal" onClick={props.goToUpdates}>
          {isDesktopView && <Label color="white">{intl.formatMessage({ id: 'update.link' })}</Label>}
          <ExternalLinkIcon className="w-4 h-4 ml-0 lg:ml-2" />
        </Button>
      </div>
    )
  }

  return null
}
