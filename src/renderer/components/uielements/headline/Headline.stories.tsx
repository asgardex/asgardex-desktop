import React from 'react'

import { Meta, StoryFn } from '@storybook/react'

import { Headline as Component } from './index'

type ArgTypes = { children: React.ReactNode }
const Template: StoryFn<ArgTypes> = (args) => <Component {...args} />
export const Default = Template.bind({})

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/Headline',
  args: {
    children: 'Hello headline'
  }
}

export default meta
