import { Meta } from '@storybook/react'

import { AssetRuneNative } from '../../../../shared/utils/asset'
import { ManageButton as Component, Props } from './ManageButton'

export const ManageButton = (args: Props) => <Component {...args} />

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/button/ManageButton',
  argTypes: {
    size: {
      control: {
        type: 'select',
        options: ['small', 'medium', 'normal', 'large']
      }
    }
  },
  args: {
    isTextView: true,
    asset: AssetRuneNative,
    variant: 'manage',
    disabled: false,
    size: 'normal',
    useBorderButton: true
  }
}

export default meta
