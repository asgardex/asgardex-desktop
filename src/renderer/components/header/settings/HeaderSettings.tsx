import { Cog8ToothIcon } from '@heroicons/react/20/solid'
import { useIntl } from 'react-intl'

import { Tooltip } from '../../uielements/common/Common.styles'
import { Label } from '../../uielements/label'

export type Props = {
  onPress?: () => void
  isDesktopView: boolean
}

export const HeaderSettings = (props: Props): JSX.Element => {
  const { onPress = () => {}, isDesktopView } = props
  const intl = useIntl()

  return (
    <div className="flex items-center justify-between w-full px-4 lg:w-auto lg:px-0" onClick={onPress}>
      {!isDesktopView && (
        <Label size="large" textTransform="uppercase" weight="bold">
          {intl.formatMessage({ id: 'common.settings' })}{' '}
        </Label>
      )}
      <Tooltip title={intl.formatMessage({ id: 'common.settings' })}>
        <Cog8ToothIcon className="ease h-[24px] w-[24px] text-text2 group-hover:rotate-180 dark:text-text2d" />
      </Tooltip>
    </div>
  )
}
