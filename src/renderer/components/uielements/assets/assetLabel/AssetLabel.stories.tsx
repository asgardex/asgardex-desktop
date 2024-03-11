import { StoryFn, Meta } from '@storybook/react'

import { AssetBNB } from '../../../../../shared/utils/asset'
import { AssetLabel as Component } from './AssetLabel'

export const Default: StoryFn = () => <Component asset={AssetBNB} />

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/Assets/AssetLabel'
}

export default meta
