import { useState, FC } from 'react'

import { Meta, StoryObj } from '@storybook/react'

import { EditableWalletName as Component, Props } from './EditableWalletName'

// Wrap the story's state management in a functional component
const StoryComponent: FC<Props> = (props) => {
  const { name, names, onChange, ...otherProps } = props
  const [walletName, setWalletName] = useState(name)

  const onChangeHandler = (newName: string) => {
    setWalletName(newName)
    onChange(newName)
  }

  return <Component name={walletName} onChange={onChangeHandler} names={names} {...otherProps} />
}

export const Default: StoryObj<Props> = {
  render: (args: Props) => <StoryComponent {...args} />,
  args: {
    name: 'my wallet',
    names: ['my wallet1', 'wallet2'],
    onChange: (name: string) => console.log('Name changed to:', name) // Example onChange function
  }
}

const meta: Meta<typeof Component> = {
  component: Component,
  title: 'Components/EditableWalletName',
  decorators: [
    (Story: React.FC) => (
      <div className="flex h-full w-full items-center justify-center">
        <Story />
      </div>
    )
  ],
  argTypes: {
    onChange: { action: 'onChange' }
  }
}

export default meta
