import { StoryFn, Meta } from '@storybook/react'

import { AssetRuneNative } from '../../../../../shared/utils/asset'
import { AssetLabel as Component } from './AssetLabel'

export const Default: StoryFn = () => <Component asset={AssetRuneNative} />

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/Assets/AssetLabel'
}

export default meta
