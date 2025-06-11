import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { AlertProps } from 'antd/lib/alert'

import * as Styled from './Alert.styles'

export type Props = Omit<AlertProps, 'showIcon' | 'icon'>

export const Alert = (props: Props): JSX.Element => {
  const { description, ...rest } = props

  return (
    <Styled.Alert
      showIcon
      icon={<InformationCircleIcon width={24} height={24} />}
      description={description}
      {...rest}
    />
  )
}
