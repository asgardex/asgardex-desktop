import { Meta } from '@storybook/react'

import baseMeta from './BaseButton.stories'
import textMeta from './FlatButton.stories'
import { RefreshButton as Component, Props } from './RefreshButton'

export const RefreshButton = (props: Props) => <Component {...props} />

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/button/RefreshButton',
  argTypes: {
    color: textMeta.argTypes?.color ?? {},
    size: baseMeta.argTypes?.size ?? {},
    onClick: {
      action: 'onClicked'
    }
  },
  args: {
    color: 'primary',
    size: 'normal',
    label: 'Label',
    disabled: false
  },
  decorators: [
    (Story) => (
      <div className="flex h-screen items-center justify-center bg-white">
        <Story />
      </div>
    )
  ]
}

export default meta
